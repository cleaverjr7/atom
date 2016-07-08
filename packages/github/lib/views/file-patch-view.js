/** @babel */
/** @jsx etch.dom */

import {Emitter, CompositeDisposable} from 'atom'
import etch from 'etch'

import HunkView from './hunk-view'

const EMPTY_SET = new Set()

export default class FilePatchView {
  constructor (props) {
    this.props = props
    this.filePatchSubscriptions = new CompositeDisposable(
      props.filePatch.onDidUpdate(this.didUpdateFilePatch.bind(this)),
      props.filePatch.onDidDestroy(this.didDestroyFilePatch.bind(this))
    )
    this.selectionMode = props.selectionMode || 'hunk'
    this.selectedHunk = props.filePatch.getHunks()[0]
    this.selectedHunkIndex = 0
    this.setInitialSelection(this.selectedHunk)
    this.emitter = new Emitter()
    etch.initialize(this)
    this.subscriptions = atom.commands.add(this.element, {
      'git:toggle-patch-selection-mode': this.togglePatchSelectionMode.bind(this),
      'git:focus-next-hunk': this.focusNextHunk.bind(this)
    })
  }

  setInitialSelection (hunk) {
    if (hunk) {
      if (this.selectionMode === 'hunk') {
        this.selectNonContextLines(hunk.getLines())
      } else {
        this.selectNonContextLines([this.getFirstNonContextLine(hunk)])
      }
    } else {
      this.selectNonContextLines([])
    }
  }

  selectNonContextLines (lines) {
    this.selectedLines = new Set(lines.filter(l => l.isChanged()))
  }

  focusNextHunk () {
    const hunks = this.props.filePatch.getHunks()
    let index = hunks.indexOf(this.selectedHunk)
    this.selectedHunk = ++index < hunks.length ? hunks[index] : hunks[0]
    this.selectedHunkIndex = index < hunks.length ? index : 0
    this.setInitialSelection(this.selectedHunk)
    return etch.update(this)
  }

  update (props) {
    this.props = props
    if (this.filePatchSubscriptions) this.filePatchSubscriptions.dispose()
    this.filePatchSubscriptions = new CompositeDisposable(
      props.filePatch.onDidUpdate(this.didUpdateFilePatch.bind(this)),
      props.filePatch.onDidDestroy(this.didDestroyFilePatch.bind(this))
    )
    this.selectionMode = this.props.selectionMode || this.selectionMode
    this.selectedHunk = props.filePatch.getHunks()[0]
    this.selectedHunkIndex = 0
    this.setInitialSelection(this.selectedHunk)
    this.emitter.emit('did-change-title', this.getTitle())
    return etch.update(this)
  }

  destroy () {
    this.emitter.emit('did-destroy')
    this.subscriptions.dispose()
    return etch.destroy(this)
  }

  render () {
    let stageButtonLabelPrefix = this.props.stagingStatus === 'unstaged' ? 'Stage' : 'Unstage'
    return (
      <div className='git-FilePatchView' tabIndex='-1'>{this.props.filePatch.getHunks().map((hunk) => {
        const isSelected = hunk === this.selectedHunk
        const selectedLines = isSelected ? this.selectedLines : EMPTY_SET
        return (
          <HunkView
            hunk={hunk}
            isSelected={isSelected}
            selectedLines={selectedLines}
            selectLines={(lines) => this.selectLinesForHunk(hunk, lines)}
            didClickStageButton={() => this.didClickStageButtonForHunk(hunk)}
            stageButtonLabelPrefix={stageButtonLabelPrefix}
            registerView={this.props.registerHunkView} />
        )
      })}
      </div>
    )
  }

  getFirstNonContextLine (hunk) {
    const lines = hunk.getLines()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.isChanged()) return line
    }
  }

  togglePatchSelectionMode () {
    this.selectionMode = this.selectionMode === 'hunk' ? 'hunkLine' : 'hunk'
    this.setInitialSelection(this.selectedHunk)
    return etch.update(this)
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

  selectLinesForHunk (hunk, selectedLines) {
    this.selectedHunk = hunk
    this.selectedHunkIndex = this.props.filePatch.getHunks().indexOf(hunk)
    if (this.selectionMode === 'hunk') {
      this.selectNonContextLines(hunk.getLines())
    } else {
      this.selectNonContextLines([...selectedLines])
    }
    etch.update(this)
  }

  async didClickStageButtonForHunk (hunk) {
    // TODO: Test the behavior of this line, which ensure we only attempt to
    // stage the selected lines if we clicked the stage button on the hunk
    // containing them.
    const clickedSelectedHunk = hunk === this.selectedHunk

    let patchToApply
    if (this.props.stagingStatus === 'unstaged') {
      if (this.selectedLines && clickedSelectedHunk) {
        patchToApply = this.props.filePatch.getStagePatchForLines(this.selectedLines)
        this.selectedLines = EMPTY_SET
      } else {
        patchToApply = this.props.filePatch.getStagePatchForHunk(hunk)
      }
    } else if (this.props.stagingStatus === 'staged') {
      if (this.selectedLines && clickedSelectedHunk) {
        patchToApply = this.props.filePatch.getUnstagePatchForLines(this.selectedLines)
        this.selectedLines = EMPTY_SET
      } else {
        patchToApply = this.props.filePatch.getUnstagePatchForHunk(hunk)
      }
    } else {
      throw new Error(`Unknown stagingStatus: ${this.props.stagingStatus}`)
    }

    await this.props.repository.applyPatchToIndex(patchToApply)
    return etch.update(this)
  }

  didUpdateFilePatch () {
    const hunks = this.props.filePatch.getHunks()
    if (hunks.includes(this.selectedHunk)) {
      // retain existing selectedHunk
    } else if (hunks[this.selectedHunkIndex]) {
      this.selectedHunk = hunks[this.selectedHunkIndex]
    } else {
      this.selectedHunkIndex = hunks.length - 1
      this.selectedHunk = hunks[this.selectedHunkIndex]
    }
    this.setInitialSelection(this.selectedHunk)
    return etch.update(this)
  }

  didDestroyFilePatch () {
    this.destroy()
  }
}
