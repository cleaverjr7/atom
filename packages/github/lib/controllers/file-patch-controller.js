/** @babel */
/** @jsx etch.dom */

import {Emitter, CompositeDisposable} from 'atom'
import etch from 'etch'

import FilePatchView from '../views/file-patch-view'

export default class FilePatchController {
  constructor (props) {
    this.props = props
    this.emitter = new Emitter()
    this.stageHunk = this.stageHunk.bind(this)
    this.unstageHunk = this.unstageHunk.bind(this)
    this.stageLines = this.stageLines.bind(this)
    this.unstageLines = this.unstageLines.bind(this)
    this.observeFilePatch()
    etch.initialize(this)
  }

  update (props) {
    this.props = props
    this.observeFilePatch()
    this.emitter.emit('did-change-title', this.getTitle())
    return etch.update(this)
  }

  observeFilePatch () {
    if (this.filePatchSubscriptions) this.filePatchSubscriptions.dispose()
    this.filePatchSubscriptions = new CompositeDisposable(
      this.props.filePatch.onDidUpdate(this.didUpdateFilePatch.bind(this)),
      this.props.filePatch.onDidDestroy(this.didDestroyFilePatch.bind(this))
    )
  }

  destroy () {
    this.emitter.emit('did-destroy')
    this.filePatchSubscriptions.dispose()
    return etch.destroy(this)
  }

  render () {
    return (
      <FilePatchView
        ref='filePatchView'
        stageHunk={this.stageHunk}
        unstageHunk={this.unstageHunk}
        stageLines={this.stageLines}
        unstageLines={this.unstageLines}
        hunks={this.props.filePatch.getHunks()}
        stagingStatus={this.props.stagingStatus}
        registerHunkView={this.props.registerHunkView}
      />
    )
  }

  stageHunk (hunk) {
    return this.props.repository.applyPatchToIndex(
      this.props.filePatch.getStagePatchForHunk(hunk)
    )
  }

  unstageHunk (hunk) {
    return this.props.repository.applyPatchToIndex(
      this.props.filePatch.getUnstagePatchForHunk(hunk)
    )
  }

  stageLines (lines) {
    return this.props.repository.applyPatchToIndex(
      this.props.filePatch.getStagePatchForLines(lines)
    )
  }

  unstageLines (lines) {
    return this.props.repository.applyPatchToIndex(
      this.props.filePatch.getUnstagePatchForLines(lines)
    )
  }

  getTitle () {
    let title = this.props.stagingStatus === 'staged' ? 'Staged' : 'Unstaged'
    title += ' Changes: '
    title += this.props.filePatch.getDescriptionPath()
    return title
  }

  onDidChangeTitle (callback) {
    return this.emitter.on('did-change-title', callback)
  }

  onDidDestroy (callback) {
    return this.emitter.on('did-destroy', callback)
  }

  didUpdateFilePatch () {
    this.refs.filePatchView.didUpdateFilePatch()
  }

  didDestroyFilePatch () {
    this.destroy()
  }
}
