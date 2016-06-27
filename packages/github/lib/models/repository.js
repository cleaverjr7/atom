/** @babel */

import {GitRepositoryAsync, Emitter} from 'atom'
const Git = GitRepositoryAsync.Git

import FilePatch from './file-patch'
import Hunk from './hunk'
import HunkLine from './hunk-line'

import {applyPatch} from 'diff'

const diffOpts = {flags: Git.Diff.OPTION.SHOW_UNTRACKED_CONTENT | Git.Diff.OPTION.RECURSE_UNTRACKED_DIRS}
const findOpts = {flags: Git.Diff.FIND.RENAMES | Git.Diff.FIND.FOR_UNTRACKED}

export default class Repository {
  constructor (rawRepository, workingDirectory) {
    this.rawRepository = rawRepository
    this.workingDirectory = workingDirectory
    this.emitter = new Emitter()
  }

  onDidUpdate (callback) {
    return this.emitter.on('did-update', callback)
  }

  didUpdate () {
    this.emitter.emit('did-update')
  }

  getWorkingDirectory () {
    return this.workingDirectory
  }

  async getUnstagedChanges () {
    return this.unstagedChangesPromise || this.refreshUnstagedChanges()
  }

  async getStagedChanges () {
    return this.stagedChangesPromise || this.refreshStagedChanges()
  }

  async refreshUnstagedChanges () {
    this.unstagedChangesPromise = this.fetchUnstagedChanges()
    return this.unstagedChangesPromise
  }

  async refreshStagedChanges () {
    this.stagedChangesPromise = this.fetchStagedChanges()
    return this.stagedChangesPromise
  }

  async fetchUnstagedChanges () {
    const diff = await Git.Diff.indexToWorkdir(
      this.rawRepository,
      await this.rawRepository.index(),
      diffOpts
    )
    await diff.findSimilar(findOpts)
    return this.buildFilePatchesFromRawDiff(diff)
  }

  async fetchStagedChanges () {
    const headCommit = await this.rawRepository.getHeadCommit()
    let tree
    if (headCommit) {
      tree = await headCommit.getTree()
    } else {
      const builder = await Git.Treebuilder.create(this.rawRepository, null)
      tree = await this.rawRepository.getTree(builder.write())
    }

    const diff = await Git.Diff.treeToIndex(
      this.rawRepository,
      tree,
      await this.rawRepository.index(),
      diffOpts
    )
    await diff.findSimilar(findOpts)
    return this.buildFilePatchesFromRawDiff(diff)
  }

  async applyPatchToIndex (filePatch) {
    const index = await this.rawRepository.index()
    if (filePatch.status === 'modified') {
      const oldIndexEntry = await index.getByPath(filePatch.getOldPath(), 0)
      const oldBlob = await this.rawRepository.getBlob(oldIndexEntry.id)
      const newContents = Buffer.from(applyPatch(oldBlob.toString(), filePatch.toString()))
      const newBlobOid = await this.rawRepository.createBlobFromBuffer(newContents)
      await index.add(this.buildIndexEntry(newBlobOid, filePatch.getNewMode(), filePatch.getOldPath(), newContents.length))
    } else if (filePatch.status === 'removed') {
      await index.remove(filePatch.getOldPath(), 0)
    } else if (filePatch.status === 'renamed') {
      const oldIndexEntry = await index.getByPath(filePatch.getOldPath(), 0)
      const oldBlob = await this.rawRepository.getBlob(oldIndexEntry.id)
      const newContents = Buffer.from(applyPatch(oldBlob.toString(), filePatch.toString()))
      const newBlobOid = await this.rawRepository.createBlobFromBuffer(newContents)
      await index.remove(filePatch.getOldPath(), 0)
      await index.add(this.buildIndexEntry(newBlobOid, filePatch.getNewMode(), filePatch.getNewPath(), newContents.length))
    } else if (filePatch.status === 'added') {
      const newContents = Buffer.from(applyPatch('', filePatch.toString()))
      const newBlobOid = await this.rawRepository.createBlobFromBuffer(newContents)
      await index.add(this.buildIndexEntry(newBlobOid, filePatch.getNewMode(), filePatch.getNewPath(), newContents.length))
    }

    await index.write()
    this.stagedChangesPromise = null
    this.unstagedChangesPromise = null
    this.didUpdate()
  }

  buildIndexEntry (oid, mode, path, fileSize) {
    const entry = new Git.IndexEntry()
    entry.id = oid
    entry.mode = mode
    entry.path = path
    entry.fileSize = fileSize
    entry.flags = 0
    entry.flagsExtended = 0
    return entry
  }

  async buildFilePatchesFromRawDiff (rawDiff) {
    const filePatches = []
    for (let rawPatch of await rawDiff.patches()) {
      const hunks = []
      for (let rawHunk of await rawPatch.hunks()) { // eslint-disable-line babel/no-await-in-loop
        const lines = []
        for (let rawLine of await rawHunk.lines()) { // eslint-disable-line babel/no-await-in-loop
          let text = rawLine.content()
          const origin = String.fromCharCode(rawLine.origin())
          let status
          if (origin === '+') {
            status = 'added'
          } else if (origin === '-') {
            status = 'removed'
          } else if (origin === ' ') {
            status = 'unchanged'
          }

          lines.push(new HunkLine(text, status, rawLine.oldLineno(), rawLine.newLineno()))
        }
        hunks.push(new Hunk(rawHunk.oldStart(), rawHunk.newStart(), rawHunk.oldLines(), rawHunk.newLines(), lines))
      }

      let status
      if (rawPatch.isUntracked() || rawPatch.isAdded()) {
        status = 'added'
      } else if (rawPatch.isModified()) {
        status = 'modified'
      } else if (rawPatch.isDeleted()) {
        status = 'removed'
      } else if (rawPatch.isRenamed()) {
        status = 'renamed'
      } else {
        throw new Error('Unknown status for raw patch')
      }

      filePatches.push(new FilePatch(
        rawPatch.oldFile().path(),
        rawPatch.newFile().path(),
        rawPatch.oldFile().mode(),
        rawPatch.newFile().mode(),
        status,
        hunks
      ))
    }

    return filePatches
  }
}
