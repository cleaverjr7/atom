/* @flow */

import {CompositeDisposable} from 'atom'
import FileList from './file-list'
import FileListViewModel from './file-list-view-model'
import DiffViewModel from './diff-view-model'
import DiffPaneItemComponent from './diff-pane-item-component'
import FileListComponent from './file-list-component'
import {DiffURI} from './common'

import type {Panel} from 'atom'

type GitState = {panelVisible: boolean}

class Git {
  subscriptions: CompositeDisposable;
  state: GitState;
  changesPanel: ?Panel<FileListViewModel>;
  fileList: FileList;

  constructor () {
    this.subscriptions = new CompositeDisposable()
  }

  activate (state: GitState = {panelVisible: false}) {
    this.state = state

    atom.commands.add('atom-workspace', 'git:view-and-commit-changes', () => {
      this.openChangesPanel()
    })

    atom.commands.add('atom-workspace', 'git:close-commit-panel', () => {
      this.closeChangesPanel()

      const workspaceElement = atom.views.getView(atom.workspace)
      workspaceElement.focus()
    })

    atom.commands.add('atom-workspace', 'git:open-file-diff', () => {
      this.openDiffForActiveEditor()
    })

    atom.commands.add('atom-workspace', 'git:refresh-status', () => {
      this.update()
    })

    this.update()

    if (state.panelVisible) {
      this.openChangesPanel()
    }

    process.nextTick(() => {
      this.subscriptions.add(atom.workspace.addOpener((uri, options) => {
        if (uri.startsWith(DiffURI)) {
          return createDiffPaneItem({
            uri,
            pending: options.pending
          })
        }
      }))
    })
  }

  update () {
    this.getFileList().loadFromGitUtils()

    const viewModel = this.getFileListViewModel()
    if (viewModel) {
      viewModel.update()
    }
  }

  serialize (): GitState {
    const changesPanel = this.changesPanel
    const visible = (changesPanel && changesPanel.isVisible()) || false
    return {
      panelVisible: visible
    }
  }

  deactivate () {
    if (this.subscriptions) {
      this.subscriptions.dispose()
    }
  }

  getFileList (): FileList {
    if (!this.fileList) {
      this.fileList = new FileList([], {stageOnChange: true})
      this.fileList.onDidUserChange(() => {
        this.fileList.loadFromGitUtils()
      })
    }

    return this.fileList
  }

  closeChangesPanel () {
    if (this.changesPanel) {
      this.changesPanel.hide()
    }
  }

  openChangesPanel () {
    let fileListViewModel
    const changesPanel = this.changesPanel
    if (changesPanel) {
      changesPanel.show()
      fileListViewModel = changesPanel.getItem()
    } else {
      fileListViewModel = new FileListViewModel(this.getFileList())
      fileListViewModel.onDidUserChange(() => this.update())
      this.changesPanel = atom.workspace.addRightPanel({item: fileListViewModel})
    }
    atom.views.getView(fileListViewModel).focus()
  }

  getFileListViewModel (): ?FileListViewModel {
    const changesPanel = this.changesPanel
    if (changesPanel) {
      return changesPanel.getItem()
    }
  }

  openDiffForActiveEditor () {
    const editor = atom.workspace.getActiveTextEditor()
    const editorPath = editor.getPath()
    if (!editorPath) return

    const filePath = atom.project.relativizePath(editorPath)[1]
    return this.getFileList().getOrCreateFileFromPathName(filePath).openDiff({pending: true})
  }
}

const gitInstance = new Git()

function createDiffPaneItem ({uri, pending}) {
  const pathName = uri.replace(DiffURI, '')
  const fileDiff = gitInstance.getFileList().getOrCreateFileFromPathName(pathName)
  return new DiffViewModel({
    uri,
    pathName,
    pending: !!pending,
    deserializer: 'GitDiffPaneItem',
    fileList: new FileList([fileDiff], {stageOnChange: false})
  })
}

atom.deserializers.add({
  name: 'GitDiffPaneItem',
  deserialize: state => createDiffPaneItem(state)
})

atom.views.addViewProvider(DiffViewModel, diffViewModel => {
  const component = new DiffPaneItemComponent({diffViewModel})
  return component.element
})

atom.views.addViewProvider(FileListViewModel, fileListViewModel => {
  const component = new FileListComponent({fileListViewModel})
  return component.element
})

export default gitInstance
