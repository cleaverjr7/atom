import path from 'path';

import State from './state';

import {deleteFileOrFolder} from '../../helpers';
import FilePatch from '../file-patch';
import Hunk from '../hunk';
import HunkLine from '../hunk-line';
import DiscardHistory from '../discard-history';

class Cache {
  constructor() {
    this.storage = new Map();
  }

  getOrSet(key, operation) {
    const existing = this.storage.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const created = operation();
    this.storage.set(key, created);
    return created;
  }

  clear() {
    this.storage.clear();
  }
}

export default class Present extends State {
  constructor(repository, history) {
    super(repository);

    this.cache = new Cache();

    this.discardHistory = new DiscardHistory(
      this.createBlob.bind(this),
      this.expandBlobToFile.bind(this),
      this.mergeFile.bind(this),
      this.workdir.bind(this),
      {maxHistoryLength: 60},
    );
  }

  isPresent() {
    return true;
  }

  destroy() {
    this.transitionTo('Destroyed');
  }

  refresh() {
    this.cache.clear();
    this.didUpdate();
  }

  // Git operations ////////////////////////////////////////////////////////////////////////////////////////////////////

  // Staging and unstaging

  stageFiles(paths) {
    return this.git().stageFiles(paths);
  }

  unstageFiles(paths) {
    return this.git().unstageFiles(paths);
  }

  stageFilesFromParentCommit(paths) {
    return this.git().unstageFiles(paths, 'HEAD~');
  }

  applyPatchToIndex(filePatch) {
    const patchStr = filePatch.getHeaderString() + filePatch.toString();
    return this.git().applyPatch(patchStr, {index: true});
  }

  applyPatchToWorkdir(filePatch) {
    const patchStr = filePatch.getHeaderString() + filePatch.toString();
    return this.git().applyPatch(patchStr);
  }

  // Committing

  commit(message, options) {
    return this.git().commit(formatCommitMessage(message), options);
  }

  // Merging

  merge(branchName) {
    return this.git().merge(branchName);
  }

  async abortMerge() {
    await this.git().abortMerge();
    this.refresh();
  }

  checkoutSide(side, paths) {
    return this.git().checkoutSide(side, paths);
  }

  mergeFile(oursPath, commonBasePath, theirsPath, resultPath) {
    return this.git().mergeFile(oursPath, commonBasePath, theirsPath, resultPath);
  }

  writeMergeConflictToIndex(filePath, commonBaseSha, oursSha, theirsSha) {
    return this.git().writeMergeConflictToIndex(filePath, commonBaseSha, oursSha, theirsSha);
  }

  // Checkout

  checkout(revision, options = {}) {
    return this.git().checkout(revision, options);
  }

  checkoutPathsAtRevision(paths, revision = 'HEAD') {
    return this.git().checkoutFiles(paths, revision);
  }

  // Remote interactions

  fetch(branchName) {
    return this.git().fetch(branchName);
  }

  pull(branchName) {
    return this.git().pull(branchName);
  }

  push(branchName, options) {
    return this.git().push(branchName, options);
  }

  // Configuration

  setConfig(option, value, options) {
    return this.git().setConfig(option, value, options);
  }

  // Direct blob interactions

  createBlob(options) {
    return this.git().createBlob(options);
  }

  expandBlobToFile(absFilePath, sha) {
    return this.git().expandBlobToFile(absFilePath, sha);
  }

  // Discard history

  createDiscardHistoryBlob() {
    return this.discardHistory.createHistoryBlob();
  }

  async updateDiscardHistory() {
    const history = await this.loadHistoryPayload();
    this.discardHistory.updateHistory(history);
  }

  async storeBeforeAndAfterBlobs(filePaths, isSafe, destructiveAction, partialDiscardFilePath = null) {
    const snapshots = await this.discardHistory.storeBeforeAndAfterBlobs(
      filePaths,
      isSafe,
      destructiveAction,
      partialDiscardFilePath,
    );
    if (snapshots) { await this.saveDiscardHistory(); }
    return snapshots;
  }

  restoreLastDiscardInTempFiles(isSafe, partialDiscardFilePath = null) {
    return this.discardHistory.restoreLastDiscardInTempFiles(isSafe, partialDiscardFilePath);
  }

  async popDiscardHistory(partialDiscardFilePath = null) {
    const removed = await this.discardHistory.popHistory(partialDiscardFilePath);
    if (removed) { await this.saveDiscardHistory(); }
  }

  clearDiscardHistory(partialDiscardFilePath = null) {
    this.discardHistory.clearHistory(partialDiscardFilePath);
    return this.saveDiscardHistory();
  }

  async discardWorkDirChangesForPaths(paths) {
    const untrackedFiles = await this.git.getUntrackedFiles();
    const [filesToRemove, filesToCheckout] = partition(paths, f => untrackedFiles.includes(f));
    await this.git.checkoutFiles(filesToCheckout);
    await Promise.all(filesToRemove.map(filePath => {
      const absPath = path.join(this.getWorkingDirectoryPath(), filePath);
      return deleteFileOrFolder(absPath);
    }));
  }

  // Accessors /////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Index queries

  getStatusesForChangedFiles() {
    return this.cache.getOrSet('changed-files', () => {
      return this.git().getStatusesForChangedFiles();
    });
  }

  getStagedChangesSinceParentCommit() {
    return this.cache.getOrSet('staged-changes-since-parent-commit', async () => {
      try {
        const stagedFiles = await this.git().diffFileStatus({staged: true, target: 'HEAD~'});
        return Object.keys(stagedFiles).map(filePath => ({filePath, status: stagedFiles[filePath]}));
      } catch (e) {
        if (e.message.includes('ambiguous argument \'HEAD~\'')) {
          return [];
        } else {
          throw e;
        }
      }
    });
  }

  isPartiallyStaged(fileName) {
    return this.cache.getOrSet(`is-partially-staged:${fileName}`, () => {
      return this.git().isPartiallyStaged(fileName);
    });
  }

  getFilePatchForPath(filePath, {staged, amending} = {staged: false, amending: false}) {
    let desc = '';
    if (staged && amending) {
      desc = 'p';
    } else if (staged) {
      desc = 's';
    } else {
      desc = 'u';
    }

    return this.cache.getOrSet(`file-patch:${desc}:${filePath}`, async () => {
      const options = {staged, amending};
      if (amending) {
        options.baseCommit = 'HEAD~';
      }

      const rawDiff = await this.git().getDiffForFilePath(filePath, options);
      if (rawDiff) {
        const [filePatch] = buildFilePatchesFromRawDiffs([rawDiff]);
        return filePatch;
      } else {
        return null;
      }
    });
  }

  readFileFromIndex(filePath) {
    return this.cache.getOrSet(`index:${filePath}`, () => {
      return this.git().readFileFromIndex(filePath);
    });
  }

  // Commit access

  getLastCommit() {
    return this.cache.getOrSet('last-commit', () => {
      return this.git().getHeadCommit();
    });
  }

  // Branches

  getBranches() {
    return this.cache.getOrSet('branches', () => {
      return this.git().getBranches();
    });
  }

  getCurrentBranch() {
    return this.cache.getOrSet('current-branch', () => {
      return this.git().getCurrentBranch();
    });
  }

  // Merging and rebasing status

  isMerging() {
    return this.git().isMerging();
  }

  isRebasing() {
    return this.git().isRebasing();
  }

  // Remotes

  getRemotes() {
    return this.cache.getOrSet('remotes', () => {
      return this.git().getRemotes();
    });
  }

  getRemoteForBranch(branchName) {
    return this.cache.getOrSet(`remote-for-branch:${branchName}`, () => {
      return this.git().getRemoteForBranch(branchName);
    });
  }

  getAheadCount(branchName) {
    return this.cache.getOrSet(`ahead-count:${branchName}`, () => {
      return this.git().getAheadCount(branchName);
    });
  }

  getBehindCount(branchName) {
    return this.cache.getOrSet(`behind-count:${branchName}`, () => {
      return this.git().getBehindCount(branchName);
    });
  }

  getConfig(option, {local} = {local: false}) {
    const desc = local ? 'l' : '';
    return this.cache.getOrSet(`config:${desc}:${option}`, () => {
      return this.git().getConfig(option, {local});
    });
  }

  // Direct blob access

  getBlobContents(sha) {
    return this.cache.getOrSet(`blob:${sha}`, () => {
      return this.git().getBlobContents(sha);
    });
  }

  // Discard history

  hasDiscardHistory(partialDiscardFilePath = null) {
    return this.discardHistory.hasHistory(partialDiscardFilePath);
  }

  getDiscardHistory(partialDiscardFilePath = null) {
    return this.discardHistory.getHistory(partialDiscardFilePath);
  }

  getLastHistorySnapshots(partialDiscardFilePath = null) {
    return this.discardHistory.getLastSnapshots(partialDiscardFilePath);
  }
}

State.register(Present);

function partition(array, predicate) {
  const matches = [];
  const nonmatches = [];
  array.forEach(item => {
    if (predicate(item)) {
      matches.push(item);
    } else {
      nonmatches.push(item);
    }
  });
  return [matches, nonmatches];
}

function formatCommitMessage(message) {
  // strip out comments
  const messageWithoutComments = message.replace(/^#.*$/mg, '').trim();

  // hard wrap message (except for first line) at 72 characters
  let results = [];
  messageWithoutComments.split('\n').forEach((line, index) => {
    if (line.length <= 72 || index === 0) {
      results.push(line);
    } else {
      const matches = line.match(/.{1,72}(\s|$)|\S+?(\s|$)/g)
        .map(match => {
          return match.endsWith('\n') ? match.substr(0, match.length - 1) : match;
        });
      results = results.concat(matches);
    }
  });

  return results.join('\n');
}

function buildFilePatchesFromRawDiffs(rawDiffs) {
  let diffLineNumber = 0;
  return rawDiffs.map(patch => {
    const hunks = patch.hunks.map(hunk => {
      let oldLineNumber = hunk.oldStartLine;
      let newLineNumber = hunk.newStartLine;
      const hunkLines = hunk.lines.map(line => {
        const status = HunkLine.statusMap[line[0]];
        const text = line.slice(1);
        let hunkLine;
        if (status === 'unchanged') {
          hunkLine = new HunkLine(text, status, oldLineNumber, newLineNumber, diffLineNumber++);
          oldLineNumber++;
          newLineNumber++;
        } else if (status === 'added') {
          hunkLine = new HunkLine(text, status, -1, newLineNumber, diffLineNumber++);
          newLineNumber++;
        } else if (status === 'deleted') {
          hunkLine = new HunkLine(text, status, oldLineNumber, -1, diffLineNumber++);
          oldLineNumber++;
        } else if (status === 'nonewline') {
          hunkLine = new HunkLine(text.substr(1), status, -1, -1, diffLineNumber++);
        } else {
          throw new Error(`unknow status type: ${status}`);
        }
        return hunkLine;
      });
      return new Hunk(
        hunk.oldStartLine,
        hunk.newStartLine,
        hunk.oldLineCount,
        hunk.newLineCount,
        hunk.heading,
        hunkLines,
      );
    });
    return new FilePatch(patch.oldPath, patch.newPath, patch.status, hunks);
  });
}
