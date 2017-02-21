import path from 'path';
import os from 'os';

import {getTempDir} from '../helpers';

export default class DiscardHistory {
  constructor(createBlob, expandBlobToFile, mergeFile, setConfig) {
    this.createBlob = createBlob;
    this.expandBlobToFile = expandBlobToFile;
    this.mergeFile = mergeFile;
    this.setConfig = setConfig;
    this.blobHistoryForPartialDiscardsByFilePath = {};
    this.blobHistoryForFileDiscards = [];
  }

  getPartialDiscardUndoHistoryForPath(filePath) {
    return this.blobHistoryForPartialDiscardsByFilePath[filePath];
  }

  setPartialDiscardUndoHistoryForPath(filePath, history) {
    this.blobHistoryForPartialDiscardsByFilePath[filePath] = history;
  }

  getFileDiscardUndoHistory() {
    return this.blobHistoryForFileDiscards;
  }

  setFileDiscardUndoHistory(history) {
    this.blobHistoryForFileDiscards = history;
  }

  async storeBlobs(filePaths, isSafe, destructiveAction, partial) {
    if (partial && (filePaths.length === 1)) {
      return await this.storeBlobsForPath(filePaths[0], isSafe, destructiveAction);
    } else {
      return await this.storeBlobsForMultiplePaths(filePaths, isSafe, destructiveAction);
    }
  }

  async storeBlobsForPath(filePath, isSafe, destructiveAction) {
    const beforeSha = await this.createBlob({filePath});
    const isNotSafe = !(await isSafe());
    if (isNotSafe) { return null; }
    await destructiveAction();
    const afterSha = await this.createBlob({filePath});
    const snapshots = {beforeSha, afterSha};
    const history = this.getPartialDiscardUndoHistoryForPath(filePath);
    if (history) {
      history.push(snapshots);
      if (history.length >= 60) { this.setPartialDiscardUndoHistoryForPath(filePath, history.slice(30)); }
    } else {
      this.setPartialDiscardUndoHistoryForPath(filePath, [snapshots]);
    }
    await this.serializeHistory();
    return snapshots;
  }

  async storeBlobsForMultiplePaths(filePaths, isSafe, destructiveAction) {
    const snapshotsByPath = {};
    filePaths.forEach(async filePath => {
      snapshotsByPath[filePath] = {beforeSha: await this.createBlob({filePath})};
    });
    const isNotSafe = !(await isSafe());
    if (isNotSafe) { return null; }
    await destructiveAction();
    filePaths.forEach(async filePath => {
      snapshotsByPath[filePath].afterSha = await this.createBlob({filePath});
    });
    const history = this.getFileDiscardUndoHistory();
    if (history) {
      history.push(snapshotsByPath);
      if (history.length >= 60) { this.setFileDiscardUndoHistory(history.slice(30)); }
    } else {
      this.setFileDiscardUndoHistory([snapshotsByPath]);
    }
    await this.serializeHistory();
    return snapshotsByPath;
  }

  async undoLastDiscardInTempFile(filePath, isSafe, partial) {
    const history = partial ? this.getPartialDiscardUndoHistoryForPath(filePath) : this.getFileDiscardUndoHistory();
    const {beforeSha, afterSha} = history[history.length - 1];
    const tempFolderPath = await getTempDir(path.join(os.tmpdir(), 'github-discard-history-'));
    const otherPath = await this.expandBlobToFile(path.join(tempFolderPath, `${filePath}-before-discard`), beforeSha);
    const basePath = await this.expandBlobToFile(path.join(tempFolderPath, `${filePath}-after-discard`), afterSha);
    const resultPath = path.join(tempFolderPath, `${filePath}-merge-result`);
    // defer safety check until last moment to ensure the answer doesn't change while we perform async operations
    return isSafe() ? await this.mergeFile(filePath, basePath, otherPath, resultPath) : null;
  }

  async popUndoHistoryForFilePath(filePath) {
    this.getPartialDiscardUndoHistoryForPath(filePath).pop();
    await this.serializeHistory();
  }

  hasUndoHistory(filePath, partial) {
    const history = partial ? this.getPartialDiscardUndoHistoryForPath(filePath) : this.getFileDiscardUndoHistory();
    return !!history && history.length > 0;
  }

  async serializeHistory() {
    const histories = {
      fileDiscard: this.blobHistoryForFileDiscards,
      partialDiscard: this.blobHistoryForPartialDiscardsByFilePath,
    };
    const historySha = await this.createBlob({stdin: JSON.stringify(histories)});
    await this.setConfig('atomGithub.historySha', historySha);
  }

  updateHistory(history) {
    this.blobHistoryForFileDiscards = history.fileDiscard || [];
    this.blobHistoryForPartialDiscardsByFilePath = history.partialDiscard || {};
  }

  async clearPartialDiscardHistoryForPath(filePath) {
    this.setPartialDiscardUndoHistoryForPath(filePath, []);
    await this.serializeHistory();
  }

  async clearDiscardHistory() {
    this.setFileDiscardUndoHistory([]);
    await this.serializeHistory();
  }

  getLastHistorySnapshotsForPath(filePath) {
    const history = this.getPartialDiscardUndoHistoryForPath(filePath);
    return history[history.length - 1];
  }
}
