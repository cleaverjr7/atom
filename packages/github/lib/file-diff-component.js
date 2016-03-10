/* @flow */
/** @jsx etch.dom */

import etch from 'etch'
// $FlowBug: Yes, we know this isn't a React component :\
import DiffHunkComponent from './diff-hunk-component'

import type FileDiff from './file-diff'
import type DiffViewModel from './diff-view-model'

type FileDiffComponentProps = {fileDiff: FileDiff, fileIndex: number, diffViewModel: DiffViewModel, mouseDownAction: Function, mouseUpAction: Function, mouseMovedAction: Function}

export default class FileDiffComponent {
  fileDiff: FileDiff;
  fileIndex: number;
  diffViewModel: DiffViewModel;
  element: HTMLElement;
  mouseDownAction: Function;
  mouseUpAction: Function;
  mouseMovedAction: Function;

  constructor (props: FileDiffComponentProps) {
    this.acceptProps(props)
  }

  destroy (): Promise<void> {
    return etch.destroy(this)
  }

  acceptProps ({fileDiff, fileIndex, diffViewModel, mouseDownAction, mouseUpAction, mouseMovedAction}: FileDiffComponentProps): Promise<void> {
    this.fileIndex = fileIndex
    this.fileDiff = fileDiff
    this.diffViewModel = diffViewModel
    this.mouseDownAction = mouseDownAction
    this.mouseUpAction = mouseUpAction
    this.mouseMovedAction = mouseMovedAction

    if (this.element) {
      return etch.update(this)
    } else {
      etch.initialize(this)
      return Promise.resolve()
    }
  }

  update (props: FileDiffComponentProps, children: Array<any>): Promise<void> {
    return this.acceptProps(props)
  }

  renderHunks (): Array<DiffHunkComponent> {
    return this.fileDiff.getHunks().map((diffHunk, index) => {
      // $FlowBug: Yes, it's not a React element
      return <DiffHunkComponent
        diffHunk={diffHunk}
        fileIndex={this.fileIndex}
        hunkIndex={index}
        diffViewModel={this.diffViewModel}
        mouseDownAction={this.mouseDownAction}
        mouseUpAction={this.mouseUpAction}
        mouseMovedAction={this.mouseMovedAction}
      />
    })
  }

  renderEmpty () {
    return (
      <div className='empty-diff'>
        <ul className='background-message centered'>
          <li>No Changes</li>
        </ul>
      </div>
    )
  }

  render () {
    return (
      <div className='git-file-diff'>
        <div className='patch-description'>
          {this.renderIconForFileDiff(this.fileDiff)}
          <span className='text'>
            <strong className='path'>{this.fileDiff.getNewPathName()}</strong>
          </span>
        </div>
        {this.fileDiff.getHunks().length ? this.renderHunks() : this.renderEmpty()}
      </div>
    )
  }

  renderIconForFileDiff (fileDiff: FileDiff) {
    let changeStatus = fileDiff.getChangeStatus()
    return (
      <span className={`icon icon-diff-${changeStatus} status-${changeStatus}`}></span>
    )
  }
}
