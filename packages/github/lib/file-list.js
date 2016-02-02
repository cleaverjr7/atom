/** @babel */

import FileDiff from './file-diff'
import GitService from './git-service'
import {CompositeDisposable, Disposable, Emitter} from 'atom'

// FileList contains a collection of FileDiff objects
export default class FileList {
  constructor(files) {
    this.gitService = GitService.instance()
    this.emitter = new Emitter()
    this.setFiles(files || [])
  }

  onDidChange(callback) {
    return this.emitter.on('did-change', callback)
  }

  setFiles(files) {
    this.files = files
  }

  getFiles() {
    return this.files
  }

  toString() {
    return this.files.map((file) => { return file.toString() }).join('\n')
  }

  async loadFromGitUtils() {
    // FIXME: for now, we need to get the stati for the diff stuff to work. :/
    this.gitService.getStatuses()
    let diffs = await this.gitService.getDiffs('all')
    // TODO: It's a bummer these two lines happen sequentially
    const stagedDiffs = await this.gitService.getDiffs('staged')

    const diffsByName = {}
    for (const diff of stagedDiffs) {
      // TODO: Old path is probably not always right.
      diffsByName[diff.oldFile().path()] = diff
    }

    for(let diff of diffs) {
      let fileDiff = new FileDiff()
      const stagedDiff = diffsByName[diff.oldFile().path()]
      await fileDiff.fromGitUtilsObject({diff, stagedDiff})
      this.files.push(fileDiff)
    }
    this.emitter.emit('did-change')
  }

  getFileDiffFromPathName(pathName) {
    for (let file of this.files) {
      if (pathName == file.getNewPathName())
        return file
    }
  }
}
