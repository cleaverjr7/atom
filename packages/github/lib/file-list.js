/* @flow */

import FileDiff from './file-diff'
import GitService from './git-service'

import type {ObjectMap} from './common'
import type HunkLine from './hunk-line'
import type DiffHunk from './diff-hunk'

// FileList contains a collection of FileDiff objects
export default class FileList {
  gitService: GitService;
  fileCache: ObjectMap<FileDiff>;
  files: Array<FileDiff>;

  constructor (files: Array<FileDiff>, gitService: GitService) {
    this.gitService = gitService
    this.fileCache = {}
    this.setFiles(files || [])
  }

  openFile (file: FileDiff): Promise<void> {
    const pathName = file.getNewPathName()
    if (pathName) {
      return atom.workspace.open(pathName, {pending: true})
    } else {
      return Promise.resolve()
    }
  }

  openFileDiff (file: FileDiff): Promise<void> {
    return file.openDiff({pending: true})
  }

  setFiles (files: Array<FileDiff>) {
    this.files = files
    for (const file of files) {
      this.addFileToCache(file)
    }
  }

  getFiles (): Array<FileDiff> {
    return this.files
  }

  // position = [0, 2] will get you the third hunk in the first file.
  // position = [0, 2, 1] will get you the 2nd line in the third hunk in the first file.
  getObjectAtPosition (position: [number, number, ?number]): HunkLine | DiffHunk {
    const [fileIndex, hunkIndex, lineIndex] = position

    const file = this.getFiles()[fileIndex]
    const hunk = file.getHunks()[hunkIndex]
    if (lineIndex != null) {
      return hunk.getLines()[lineIndex]
    } else {
      return hunk
    }
  }

  // The file cache should allow all UI elements usage of the same FileDiff
  // models. Sometimes it's a bit of a chicken and egg problem, and it happens
  // when a tab is deserialized.
  //
  // * Let's say there is a Diff tab being deserialized for `config.js`.
  // * The deserializer runs before nodegit knows the state of things, but the
  // tab needs a model. The tab will use `getOrCreateFileFromPathName` to get
  // the model.
  // * Then and the FileDiff::loadFromGitUtils is called and there are changes
  // in `config.js`
  // * `loadFromGitUtils` will use
  // `getOrCreateFileFromPathName('config.js')`, which will grab the same model
  // that the Diff tab is using.
  // * The model will be updated from the nodegit state and the Diff tab will
  // update properly.
  addFileToCache (file: FileDiff) {
    const oldPathName = file.getOldPathName()
    if (oldPathName !== file.getNewPathName() && oldPathName && this.fileCache[oldPathName]) {
      delete this.fileCache[oldPathName]
    }

    const newPathName = file.getNewPathName()
    if (newPathName) {
      this.fileCache[newPathName] = file
    }
  }

  getFileFromPathName (pathName: string): ?FileDiff {
    return this.fileCache[pathName]
  }

  getOrCreateFileFromPathName (pathName: string): FileDiff {
    let file = this.getFileFromPathName(pathName)
    if (!file) {
      file = new FileDiff({newPathName: pathName, oldPathName: pathName})
      this.addFileToCache(file)
    }
    return file
  }

  toString (): string {
    return this.files.map(file => file.toString()).join('\n')
  }

  async stagePatches (fileDiff: FileDiff, patches: Array<string>, stage: boolean): Promise<number> {
    if (stage) {
      return this.gitService.stagePatches(fileDiff, patches)
    } else {
      return this.gitService.unstagePatches(fileDiff, patches)
    }
  }

  async loadFromGitUtils (): Promise<void> {
    let files = []

    // FIXME: for now, we need to get the stati for the diff stuff to work. :/
    await this.gitService.getStatuses()

    let unifiedDiffs = await this.gitService.getDiffs('all')
    // TODO: It's a bummer these lines happen sequentially
    const stagedDiffs = await this.gitService.getDiffs('staged')
    const unstagedDiffs = await this.gitService.getDiffs('unstaged')

    const stagedDiffsByName = {}
    for (const diff of stagedDiffs) {
      // TODO: Old path is probably not always right.
      // $FlowFixMe
      stagedDiffsByName[diff.oldFile().path()] = diff
    }

    const unstagedDiffsByName = {}
    for (const diff of unstagedDiffs) {
      // TODO: Old path is probably not always right.
      // $FlowFixMe
      unstagedDiffsByName[diff.oldFile().path()] = diff
    }

    for (let diff of unifiedDiffs) {
      // $FlowFixMe
      const statusFile = this.gitService.getStatus(diff.oldFile().path()) || this.gitService.getStatus(diff.newFile().path())

      // $FlowFixMe
      let fileDiff = this.getOrCreateFileFromPathName(diff.newFile().path())
      // $FlowFixMe
      const stagedDiff = stagedDiffsByName[diff.newFile().path()]
      // $FlowFixMe
      const unstagedDiff = unstagedDiffsByName[diff.oldFile().path()]
      await fileDiff.fromGitUtilsObject({diff, stagedDiff, unstagedDiff, statusFile})
      files.push(fileDiff)
    }

    this.setFiles(files)
  }
}
