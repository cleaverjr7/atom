/* @flow */
/** @jsx etch.dom */

import etch from 'etch'
import {CompositeDisposable} from 'atom'
// $FlowFixMe: Yes, we know this isn't a React component :\
import CommitBoxComponent from './commit-box-component'
import CommitBoxViewModel from './commit-box-view-model'
// $FlowFixMe: Yes, we know this isn't a React component :\
import FileSummaryComponent from './file-summary-component'
import FileDiffViewModel from './file-diff-view-model'

import type FileListViewModel from './file-list-view-model'
import type FileList from './file-list'

type FileListComponentProps = {fileListViewModel: FileListViewModel}

export default class FileListComponent {
  fileListViewModel: FileListViewModel;
  fileList: FileList;
  element: HTMLElement;
  commitBoxViewModel: CommitBoxViewModel;
  subscriptions: CompositeDisposable;

  constructor (props: FileListComponentProps) {
    this.subscriptions = new CompositeDisposable()

    this.acceptProps(props)
  }

  acceptProps ({fileListViewModel}: FileListComponentProps): Promise<void> {
    this.fileList = fileListViewModel.getFileList()
    this.fileListViewModel = fileListViewModel
    this.commitBoxViewModel = fileListViewModel.commitBoxViewModel

    let updatePromise = Promise.resolve()
    if (this.element) {
      updatePromise = etch.update(this)
    } else {
      etch.initialize(this)
    }

    this.subscriptions.dispose()
    this.subscriptions.add(this.fileList.onDidChange(() => etch.update(this)))
    this.subscriptions.add(this.fileListViewModel.onDidChange(() => etch.update(this)))

    this.subscriptions.add(atom.commands.add(this.element, {
      'core:move-up': () => this.fileListViewModel.moveSelectionUp(),
      'core:move-down': () => this.fileListViewModel.moveSelectionDown(),
      'core:confirm': () => this.fileListViewModel.toggleSelectedFilesStageStatus(),
      'git:open-diff': () => this.fileListViewModel.openSelectedFileDiff(),
      'git:open-file': () => this.fileListViewModel.openFile()
    }))

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'git:focus-file-list': () => this.focus()
    }))

    return updatePromise
  }

  focus () {
    this.element.focus()
  }

  update (props: FileListComponentProps, children: Array<any>): Promise<void> {
    return this.acceptProps(props)
  }

  render () {
    const fileDiffViewModels = this.fileList.getFiles().map(fileDiff => {
      return new FileDiffViewModel(fileDiff)
    })

    return (
      <div className='git-file-status-list' tabIndex='-1'>
        <div className='column-header'>
          Changes
        </div>
        <div className='files'>{
          fileDiffViewModels.map((viewModel, index) =>
            <FileSummaryComponent
              selected={this.fileListViewModel.getSelectedIndex() === index}
              index={index}
              viewModel={viewModel}
              clickAction={c => this.onClickFileSummary(c)}
              doubleClickAction={c => this.onDoubleClickFileSummary(c)}
              toggleAction={c => this.onToggleFileSummary(c)}/>
          )
        }</div>
        <CommitBoxComponent viewModel={this.commitBoxViewModel}/>
      </div>
    )
  }

  onClickFileSummary (component: FileSummaryComponent) {
    const index = component.getIndex()
    this.fileListViewModel.setSelectedIndex(index)
    component.viewModel.openDiff({pending: true})
  }

  onDoubleClickFileSummary (component: FileSummaryComponent) {
    component.viewModel.openDiff({pending: false})
  }

  onToggleFileSummary (component: FileSummaryComponent) {
    const index = component.getIndex()
    this.fileList.getFiles()[index].toggleStageStatus()
  }
}
