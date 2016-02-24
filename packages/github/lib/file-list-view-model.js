/* @flow */

import {Emitter} from 'atom'
import CommitBoxViewModel from './commit-box-view-model'

import type {Disposable} from 'atom'
import type FileList from './file-list'
import type FileDiff from './file-diff'

export default class FileListViewModel {
  fileList: FileList;
  selectedIndex: number;
  emitter: Emitter;
  commitBoxViewModel: CommitBoxViewModel;

  constructor (fileList: FileList) {
    this.fileList = fileList
    this.selectedIndex = 0
    this.emitter = new Emitter()
    this.commitBoxViewModel = new CommitBoxViewModel(fileList.gitService)
    this.commitBoxViewModel.onDidUserChange(() => this.emitUserChangeEvent())
  }

  update () {
    this.commitBoxViewModel.update()
  }

  onDidChange (callback: Function): Disposable {
    return this.emitter.on('did-change', callback)
  }

  emitChangeEvent () {
    this.emitter.emit('did-change')
  }

  onDidUserChange (callback: Function): Disposable {
    return this.emitter.on('did-user-change', callback)
  }

  emitUserChangeEvent () {
    this.emitter.emit('did-user-change')
  }

  getFileList (): FileList {
    return this.fileList
  }

  getSelectedIndex (): number {
    return this.selectedIndex
  }

  setSelectedIndex (index: number) {
    this.selectedIndex = index
    this.emitChangeEvent()
  }

  getSelectedFile (): FileDiff {
    return this.fileList.getFiles()[this.selectedIndex]
  }

  openSelectedFileDiff (): Promise<void> {
    return this.fileList.openFileDiff(this.getSelectedFile())
  }

  openFile (): Promise<void> {
    return this.fileList.openFile(this.getSelectedFile())
  }

  moveSelectionUp () {
    this.selectedIndex = Math.max(this.selectedIndex - 1, 0)
    this.emitChangeEvent()
  }

  moveSelectionDown () {
    const filesLengthIndex = this.fileList.getFiles().length - 1
    this.selectedIndex = Math.min(this.selectedIndex + 1, filesLengthIndex)
    this.emitChangeEvent()
  }

  toggleSelectedFilesStageStatus () {
    const file = this.getSelectedFile()
    file.toggleStageStatus()
  }
}
