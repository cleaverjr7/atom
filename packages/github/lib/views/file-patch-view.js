/** @babel */
/** @jsx etch.dom */

import {CompositeDisposable, Disposable} from 'atom'
import etch from 'etch'

import HunkView from './hunk-view'
import FilePatchSelection from './file-patch-selection'

const EMPTY_SET = new Set()

export default class FilePatchView {
  constructor (props) {
    this.props = props
    this.selectionMode = 'hunk'
    this.selection = new FilePatchSelection(this.props.hunks)
    this.mouseSelectionInProgress = false
    this.mouseSelectionEnabled = false
    this.addNextMouseSelection = false

    this.mousedownOnLine = this.mousedownOnLine.bind(this)
    this.mousemoveOnLine = this.mousemoveOnLine.bind(this)
    this.mouseup = this.mouseup.bind(this)
    window.addEventListener('mouseup', this.mouseup)
    this.disposables = new CompositeDisposable()
    this.disposables.add(new Disposable(() => window.removeEventListener('mouseup', this.mouseup)))

    etch.initialize(this)
    this.disposables.add(atom.commands.add(this.element, {
      'git:toggle-patch-selection-mode': this.togglePatchSelectionMode.bind(this),
      'git:focus-next-hunk': () => this.selectNextHunk(),
      'git:focus-previous-hunk': () => this.selectPreviousHunk(),
      'core:confirm': () => this.stageSelectedLines(),
      'core:move-up': () => this.selectPrevious(),
      'core:move-down': () => this.selectNext(),
      'core:select-up': () => this.selectToPrevious(),
      'core:select-down': () => this.selectToNext()
    }))
  }

  update (props) {
    this.props = props
    const hunkLineLists = props.hunks.map(hunk => {
      return { key: hunk, items: hunk.getLines().filter(l => l.isChanged()) }
    })
    this.selection.updateHunks(this.props.hunks)
    return etch.update(this)
  }

  destroy () {
    this.disposables.dispose()
    return etch.destroy(this)
  }

  render () {
    const selectedLines = this.getSelectedLines()
    const stageButtonLabelPrefix = this.props.stagingStatus === 'unstaged' ? 'Stage' : 'Unstage'
    return (
      <div className='git-FilePatchView' tabIndex='-1'
        onmouseup={this.mouseup}>
        {this.props.hunks.map((hunk) => {
          return (
            <HunkView
              hunk={hunk}
              isSelected={false}
              selectedLines={selectedLines}
              focusHunk={() => this.focusHunk(hunk)}
              mousedownOnLine={this.mousedownOnLine}
              mousemoveOnLine={this.mousemoveOnLine}
              didClickStageButton={() => this.didClickStageButtonForHunk(hunk)}
              stageButtonLabelPrefix={stageButtonLabelPrefix}
              registerView={this.props.registerHunkView} />
          )
        })}
      </div>
    )
  }

  mousedownOnLine (event, hunk, line) {
    debugger
    const addSelection = event.ctrlKey || event.metaKey
    this.selection.selectLine(hunk, line, addSelection)
    this.mouseSelectionInProgress = true
    return etch.update(this)
  }

  mousemoveOnLine (event, hunk, line) {
    if (this.mouseSelectionInProgress) {
      this.selection.selectToLine(hunk, line)
      return etch.update(this)
    }
  }

  mouseup (event, hunk, line) {
    this.mouseSelectionInProgress = false
  }

  togglePatchSelectionMode () {
    return etch.update(this)
  }

  getPatchSelectionMode () {
    return this.selectionMode
  }

  getSelectedLines () {
    return new Set(this.selection.getSelectedLines())
  }

  getSelectedHunks () {
  }

  focusHunk (hunk) {
  }

  selectNext () {
    this.selection.selectNext()
    return etch.update(this)
  }

  selectToNext () {
    this.selection.selectToNext()
    return etch.update(this)
  }

  selectPrevious () {
    this.selection.selectPrevious()
    return etch.update(this)
  }

  selectToPrevious () {
    this.selection.selectToPrevious()
    return etch.update(this)
  }

  didClickStageButtonForHunk (hunk) {
    // TODO: Test the behavior of this line, which ensure we only attempt to
    // stage the selected lines if we clicked the stage button on the hunk
    // containing them.

    // const clickedSelectedHunk = this.getSelectedHunks().has(hunk)
    // if (clickedSelectedHunk) {
    return this.stageSelectedLines()
    // } else {
      // return this.stageHunk(hunk)
    // }
  }

  stageSelectedLines () {
    const selectedLines = this.getSelectedLines()
    if (this.props.stagingStatus === 'unstaged') {
      return this.props.stageLines(selectedLines)
    } else if (this.props.stagingStatus === 'staged') {
      return this.props.unstageLines(selectedLines)
    } else {
      throw new Error(`Unknown stagingStatus: ${this.props.stagingStatus}`)
    }
  }

  stageHunk (hunk) {
    if (this.props.stagingStatus === 'unstaged') {
      return this.props.stageHunk(hunk)
    } else if (this.props.stagingStatus === 'staged') {
      return this.props.unstageHunk(hunk)
    } else {
      throw new Error(`Unknown stagingStatus: ${this.props.stagingStatus}`)
    }
  }
}
