import path from 'path';

import State from './state';

import {deleteFileOrFolder} from '../../helpers';
import FilePatch from '../file-patch';
import Hunk from '../hunk';
import HunkLine from '../hunk-line';
import DiscardHistory from '../discard-history';
import Branch from '../branch';
import Remote from '../remote';
import Commit from '../commit';

const ALL = Symbol('all');

/**
 * Decorator for an async method that invalidates the cache after execution (regardless of success or failure).
 * Optionally parameterized by a function that accepts the same arguments as the function that returns the list of cache
 * keys to invalidate.
 */
function invalidate(spec = () => ALL) {
  return function(target, name, descriptor) {
    const original = descriptor.value;
    descriptor.value = function(...args) {
      return original.apply(this, args).then(
        result => {
          this.acceptInvalidation(spec, args);
          return result;
        },
        err => {
          this.acceptInvalidation(spec, args);
          return Promise.reject(err);
        },
      );
    };
    return descriptor;
  };
}

/**
 * State used when the working directory contains a valid git repository and can be interacted with. Performs
 * actual git operations, caching the results, and broadcasts `onDidUpdate` events when write actions are
 * performed.
 */
export default class Present extends State {
  constructor(repository, history) {
    super(repository);

    this.cache = new Cache();

    this.discardHistory = new DiscardHistory(
      this.createBlob.bind(this),
      this.expandBlobToFile.bind(this),
      this.mergeFile.bind(this),
      this.workdir(),
      {maxHistoryLength: 60},
    );
  }

  isPresent() {
    return true;
  }

  showStatusBarTiles() {
    return true;
  }

  acceptInvalidation(spec, args) {
    const keys = spec(...args);
    if (keys !== ALL) {
      this.cache.invalidate(keys);
    } else {
      this.cache.clear();
    }
    this.didUpdate();
  }

  observeFilesystemChange(events) {
    const keys = new Set();
    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      const fullPath = path.join(event.directory, event.file || event.newFile);

      const endsWith = (...segments) => fullPath.endsWith(path.join(...segments));
      const includes = (...segments) => fullPath.includes(path.join(...segments));

      if (endsWith('.git', 'index')) {
        keys.add(Keys.changedFiles);
        keys.add(Keys.stagedChangesSinceParentCommit);
        keys.add(Keys.allPartiallyStaged);
        keys.add(Keys.allFilePatches);
        keys.add(Keys.allIndices);
        continue;
      }

      if (endsWith('.git', 'HEAD')) {
        keys.add(Keys.lastCommit);
        keys.add(Keys.currentBranch);
        keys.add(Keys.allAheadCounts);
        keys.add(Keys.allBehindCounts);
        continue;
      }

      if (includes('.git', 'refs', 'heads')) {
        keys.add(Keys.branches);
        continue;
      }

      if (includes('.git', 'refs', 'remotes')) {
        keys.add(Keys.remotes);
        continue;
      }

      if (endsWith('.git', 'config')) {
        keys.add(Keys.allConfigs);
        keys.add(Keys.allAheadCounts);
        keys.add(Keys.allBehindCounts);
        continue;
      }

      // File change within the working directory
      const relativePath = path.relative(this.workdir(), fullPath);
      keys.add(Keys.changedFiles);
      keys.add(Keys.isPartiallyStaged(relativePath));
      keys.add(Keys.filePatch(relativePath, {staged: false, amending: false}));
    }

    this.cache.invalidate(Array.from(keys));
    this.didUpdate();
  }

  refresh() {
    this.cache.clear();
    this.didUpdate();
  }

  init() {
    return super.init().catch(e => {
      e.stdErr = 'This directory already contains a git repository';
      return Promise.reject(e);
    });
  }

  clone() {
    return super.clone().catch(e => {
      e.stdErr = 'This directory already contains a git repository';
      return Promise.reject(e);
    });
  }

  // Git operations ////////////////////////////////////////////////////////////////////////////////////////////////////

  // Staging and unstaging

  @invalidate(paths => Keys.cacheOperationKeys(paths))
  stageFiles(paths) {
    return this.git().stageFiles(paths);
  }

  @invalidate(paths => Keys.cacheOperationKeys(paths))
  unstageFiles(paths) {
    return this.git().unstageFiles(paths);
  }

  @invalidate(paths => Keys.cacheOperationKeys(paths))
  stageFilesFromParentCommit(paths) {
    return this.git().unstageFiles(paths, 'HEAD~');
  }

  @invalidate(filePatch => Keys.cacheOperationKeys([filePatch.getOldPath(), filePatch.getNewPath()]))
  applyPatchToIndex(filePatch) {
    const patchStr = filePatch.getHeaderString() + filePatch.toString();
    return this.git().applyPatch(patchStr, {index: true});
  }

  @invalidate(filePatch => Keys.workdirOperationKeys([filePatch.getOldPath(), filePatch.getNewPath()]))
  applyPatchToWorkdir(filePatch) {
    const patchStr = filePatch.getHeaderString() + filePatch.toString();
    return this.git().applyPatch(patchStr);
  }

  // Committing

  @invalidate(() => Keys.headOperationKeys())
  commit(message, options) {
    return this.git().commit(formatCommitMessage(message), options);
  }

  // Merging

  @invalidate(() => Keys.headOperationKeys())
  merge(branchName) {
    return this.git().merge(branchName);
  }

  @invalidate(() => [
    Keys.changedFiles,
    Keys.stagedChangesSinceParentCommit,
    Keys.allPartiallyStaged,
    Keys.allFilePatches,
    Keys.allIndices,
  ])
  abortMerge() {
    return this.git().abortMerge();
  }

  @invalidate((side, paths) => [
    Keys.changedFiles,
    ...paths.map(Keys.isPartiallyStaged),
    ...Keys.allFilePatchOps(paths),
    ...paths.map(Keys.index),
  ])
  checkoutSide(side, paths) {
    return this.git().checkoutSide(side, paths);
  }

  mergeFile(oursPath, commonBasePath, theirsPath, resultPath) {
    return this.git().mergeFile(oursPath, commonBasePath, theirsPath, resultPath);
  }

  @invalidate(filePath => [
    Keys.changedFiles,
    Keys.stagedChangesSinceParentCommit,
    ...Keys.allFilePatchOps([filePath]),
    Keys.index(filePath),
  ])
  writeMergeConflictToIndex(filePath, commonBaseSha, oursSha, theirsSha) {
    return this.git().writeMergeConflictToIndex(filePath, commonBaseSha, oursSha, theirsSha);
  }

  // Checkout

  @invalidate(() => Keys.headOperationKeys)
  checkout(revision, options = {}) {
    return this.git().checkout(revision, options);
  }

  @invalidate(paths => [
    Keys.changedFiles,
    Keys.stagedChangesSinceParentCommit,
    ...Keys.allFilePatchOps(paths),
  ])
  checkoutPathsAtRevision(paths, revision = 'HEAD') {
    return this.git().checkoutFiles(paths, revision);
  }

  // Remote interactions

  @invalidate(branchName => [
    Keys.aheadCount(branchName),
    Keys.behindCount(branchName),
  ])
  async fetch(branchName) {
    const remote = await this.getRemoteForBranch(branchName);
    if (!remote.isPresent()) {
      return;
    }
    await this.git().fetch(remote.getName(), branchName);
  }

  @invalidate(() => Keys.headOperationKeys)
  async pull(branchName) {
    const remote = await this.getRemoteForBranch(branchName);
    if (!remote.isPresent()) {
      return;
    }
    await this.git().pull(remote.getName(), branchName);
  }

  @invalidate((branchName, options = {}) => {
    const keys = [
      Keys.aheadCount(branchName),
      Keys.behindCount(branchName),
    ];

    if (options.setUpstream) {
      keys.push(Keys.config(`branch.${branchName}.remote`));
    }

    return keys;
  })
  async push(branchName, options) {
    const remote = await this.getRemoteForBranch(branchName);
    return this.git().push(remote.getNameOr('origin'), branchName, options);
  }

  // Configuration

  @invalidate(() => [
    Keys.allConfigs,
  ])
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
    if (snapshots) {
      await this.saveDiscardHistory();
    }
    return snapshots;
  }

  restoreLastDiscardInTempFiles(isSafe, partialDiscardFilePath = null) {
    return this.discardHistory.restoreLastDiscardInTempFiles(isSafe, partialDiscardFilePath);
  }

  async popDiscardHistory(partialDiscardFilePath = null) {
    const removed = await this.discardHistory.popHistory(partialDiscardFilePath);
    if (removed) {
      await this.saveDiscardHistory();
    }
  }

  clearDiscardHistory(partialDiscardFilePath = null) {
    this.discardHistory.clearHistory(partialDiscardFilePath);
    return this.saveDiscardHistory();
  }

  @invalidate(paths => [
    Keys.changedFiles,
    Keys.stagedChangesSinceParentCommit,
    ...paths.map(Keys.isPartiallyStaged),
    ...paths.map(filePath => Keys.filePatch(filePath, {staged: false})),
  ])
  async discardWorkDirChangesForPaths(paths) {
    const untrackedFiles = await this.git().getUntrackedFiles();
    const [filesToRemove, filesToCheckout] = partition(paths, f => untrackedFiles.includes(f));
    await this.git().checkoutFiles(filesToCheckout);
    await Promise.all(filesToRemove.map(filePath => {
      const absPath = path.join(this.workdir(), filePath);
      return deleteFileOrFolder(absPath);
    }));
  }

  // Accessors /////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Index queries

  getStatusesForChangedFiles() {
    return this.cache.getOrSet(Keys.changedFiles, () => {
      return this.git().getStatusesForChangedFiles();
    });
  }

  getStagedChangesSinceParentCommit() {
    return this.cache.getOrSet(Keys.stagedChangesSinceParentCommit, async () => {
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
    return this.cache.getOrSet(Keys.isPartiallyStaged(fileName), () => {
      return this.git().isPartiallyStaged(fileName);
    });
  }

  getFilePatchForPath(filePath, {staged, amending} = {staged: false, amending: false}) {
    return this.cache.getOrSet(Keys.filePatch(filePath, {staged, amending}), async () => {
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
    return this.cache.getOrSet(Keys.index(filePath), () => {
      return this.git().readFileFromIndex(filePath);
    });
  }

  // Commit access

  getLastCommit() {
    return this.cache.getOrSet(Keys.lastCommit, async () => {
      const {sha, message, unbornRef} = await this.git().getHeadCommit();
      return unbornRef ? Commit.createUnborn() : new Commit(sha, message);
    });
  }

  // Branches

  getBranches() {
    return this.cache.getOrSet(Keys.branches, async () => {
      const branchNames = await this.git().getBranches();
      return branchNames.map(branchName => new Branch(branchName));
    });
  }

  getCurrentBranch() {
    return this.cache.getOrSet(Keys.currentBranch, async () => {
      const {name, isDetached} = await this.git().getCurrentBranch();
      return isDetached ? Branch.createDetached(name) : new Branch(name);
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
    return this.cache.getOrSet(Keys.remotes, async () => {
      const remotesInfo = await this.git().getRemotes();
      return remotesInfo.map(({name, url}) => new Remote(name, url));
    });
  }

  getAheadCount(branchName) {
    return this.cache.getOrSet(Keys.aheadCount(branchName), () => {
      return this.git().getAheadCount(branchName);
    });
  }

  getBehindCount(branchName) {
    return this.cache.getOrSet(Keys.behindCount(branchName), () => {
      return this.git().getBehindCount(branchName);
    });
  }

  getConfig(option, {local} = {local: false}) {
    return this.cache.getOrSet(Keys.config(option, {local}), () => {
      return this.git().getConfig(option, {local});
    });
  }

  // Direct blob access

  getBlobContents(sha) {
    return this.cache.getOrSet(Keys.blob(sha), () => {
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

  invalidate(keys) {
    const keyPrefixes = [];
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].startsWith('*')) {
        keyPrefixes.push(keys[i]);
      } else {
        this.storage.delete(keys[i]);
      }
    }

    if (keyPrefixes.length > 0) {
      const keyPattern = new RegExp(`^(?:${keyPrefixes.map(prefix => prefix.substring(1)).join('|')})`);
      for (const existingKey of this.storage.keys()) {
        if (keyPattern.test(existingKey)) {
          this.storage.delete(existingKey);
        }
      }
    }
  }

  clear() {
    this.storage.clear();
  }
}


const Keys = {
  changedFiles: 'changed-files',

  stagedChangesSinceParentCommit: 'staged-changes-since-parent-commit',

  isPartiallyStaged: fileName => `is-partially-staged:${fileName}`,
  allPartiallyStaged: '*is-partially-staged:',

  filePatch: (fileName, {staged, amending}) => {
    let opKey = '';
    if (staged && amending) {
      opKey = 'a';
    } else if (staged) {
      opKey = 's';
    } else {
      opKey = 'u';
    }

    return `file-patch:${opKey}:${fileName}`;
  },
  allFilePatchOps: fileNames => {
    const keys = [];
    for (let i = 0; i < fileNames.length; i++) {
      keys.push(
        Keys.filePatch(fileNames[i], {staged: false}),
        Keys.filePatch(fileNames[i], {staged: true}),
        Keys.filePatch(fileNames[i], {staged: true, amending: true}),
      );
    }
    return keys;
  },
  allFilePatches: '*file-patch:',

  index: fileName => `index:${fileName}`,
  allIndices: '*index:',

  lastCommit: 'last-commit',

  branches: 'branches',

  currentBranch: 'current-branch',

  remotes: 'remotes',

  aheadCount: branchName => `ahead-count:${branchName}`,
  allAheadCounts: '*ahead-count:',

  behindCount: branchName => `behind-count:${branchName}`,
  allBehindCounts: '*behind-count:',

  config: (option, {local}) => {
    const opKey = local ? 'l' : '';
    return `config:${opKey}:${option}`;
  },
  allConfigs: '*config:',

  blob: sha => `blob:${sha}`,

  // Common collections of keys and patterns for use with @invalidate().

  workdirOperationKeys: fileNames => [
    Keys.changedFiles,
    ...fileNames.map(Keys.isPartiallyStaged),
    ...Keys.allFilePatchOps(fileNames),
  ],

  cacheOperationKeys: fileNames => [
    ...Keys.workdirOperationKeys(fileNames),
    Keys.stagedChangesSinceParentCommit,
    ...fileNames.map(Keys.index),
  ],

  headOperationKeys: () => [
    Keys.changedFiles,
    Keys.stagedChangesSinceParentCommit,
    Keys.allPartiallyStaged,
    Keys.allFilePatches,
    Keys.allIndices,
    Keys.lastCommit,
    Keys.allAheadCounts,
    Keys.allBehindCounts,
  ],
};
