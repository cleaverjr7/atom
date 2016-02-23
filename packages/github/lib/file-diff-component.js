/* @flow */
/** @jsx etch.dom */

import etch from 'etch'
// $FlowFixMe: Yes, we know this isn't a React component :\
import DiffHunkComponent from './diff-hunk-component'

import type FileDiff from './file-diff'
import type DiffViewModel from './diff-view-model'
import type {EtchElement} from './common'

export default class FileDiffComponent {
  fileDiff: FileDiff;
  fileIndex: number;
  diffViewModel: DiffViewModel;
  element: EtchElement<FileDiffComponent>;

  constructor ({fileDiff, fileIndex, diffViewModel}: {fileDiff: FileDiff, fileIndex: number, diffViewModel: DiffViewModel}) {
    this.fileIndex = fileIndex
    this.fileDiff = fileDiff
    this.diffViewModel = diffViewModel
    etch.createElement(this)
    this.element.component = this
  }

  render () {
    return (
      <div className='git-file-diff'>
        <div className='patch-description'>
          {this.getIconForFileDiff(this.fileDiff)}
          <span className='text'>
            <strong className='path'>{this.fileDiff.getNewPathName()}</strong>
          </span>
        </div>
        {this.fileDiff.getHunks().map((diffHunk, index) =>
          <DiffHunkComponent diffHunk={diffHunk} fileIndex={this.fileIndex} hunkIndex={index} diffViewModel={this.diffViewModel}/>
        )}
      </div>
    )
  }

  getIconForFileDiff (fileDiff: FileDiff) {
    let changeStatus = fileDiff.getChangeStatus()
    return (
      <span className={`icon icon-diff-${changeStatus} status-${changeStatus}`}></span>
    )
  }
}
