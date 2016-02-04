/** @babel */

import {CompositeDisposable} from 'atom'
import FileList from './file-list'
import FileListViewModel from './file-list-view-model'
import DiffViewModel from './diff-view-model'
import Common from './common'

let FileListComponent = null
let DiffPaneItemComponent = null
let fileList = null

module.exports = GitExperiment = {
  subscriptions: null,
  state: null,
  changesPanel: null,

  activate: (state) => {
    this.state = state

    atom.commands.add('atom-workspace', 'git:view-and-commit-changes', () => {
      GitExperiment.openChangesPanel()
    })

    atom.commands.add('atom-workspace', 'git:close-commit-panel', () => {
      GitExperiment.closeChangesPanel()
      let workspaceElement = atom.views.getView(atom.workspace)
      workspaceElement.focus()
    })

    atom.commands.add('atom-workspace', 'git:open-file-diff', () => {
      let editor = atom.workspace.getActiveTextEditor()
      let filePath = atom.project.relativizePath(editor.getPath())[1]
      atom.workspace.open(Common.DiffURI + filePath)
    })

    atom.commands.add('atom-workspace', 'git:refresh-status', () => {
      getFileListInstance().loadFromGitUtils()
    })

    this.subscriptions = new CompositeDisposable

    getFileListInstance().loadFromGitUtils()

    process.nextTick(() => {
      this.subscriptions.add(atom.workspace.addOpener((uri) => {
        if (uri.startsWith(Common.DiffURI))
          return createDiffPaneItem({ uri })
      }))
    })
  },

  serialize: () => {
    return {}
  },

  deactivate: () => {
    if (this.subscriptions)
      this.subscriptions.dispose()
  },

  closeChangesPanel: () => {
    if (this.changesPanel)
      this.changesPanel.hide()
  },

  openChangesPanel: () => {
    if (this.changesPanel) {
      this.changesPanel.show()
    }
    else {
      let fileListViewModel = new FileListViewModel(getFileListInstance())
      this.changesPanel = atom.workspace.addRightPanel({item: fileListViewModel})
    }
    let fileList = this.changesPanel.getItem()
    return atom.views.getView(fileList).focus()
  },
}

let getFileListInstance = () => {
  if (!fileList)
    fileList = new FileList()
  return fileList
}

let createDiffPaneItem = ({uri}) => {
  let pathName = uri.replace(Common.DiffURI, '')
  let fileDiff = getFileListInstance().getOrCreateFileFromPathName(pathName)
  return new DiffViewModel({
    uri: uri,
    deserializer: 'GitDiffPaneItem',
    fileList: new FileList([fileDiff])
  })
}

atom.deserializers.add({
  name: 'GitDiffPaneItem',
  deserialize: (state) => {
    return createDiffPaneItem(state)
  }
})

atom.views.addViewProvider(DiffViewModel, (diffViewModel) => {
  if (!DiffPaneItemComponent)
    DiffPaneItemComponent = require('./diff-pane-item-component')
  let component = new DiffPaneItemComponent({diffViewModel})
  return component.element
})

atom.views.addViewProvider(FileListViewModel, (fileListViewModel) => {
  if (!FileListComponent)
    FileListComponent = require('./file-list-component')
  let component = new FileListComponent({fileListViewModel})
  return component.element
})
