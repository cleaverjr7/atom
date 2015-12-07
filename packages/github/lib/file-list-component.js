"use babel"

let etch = require('etch')
/** @jsx etch.dom */

// let BaseTemplate = ```
//   <div class="unstaged column-header">Unstaged changes
//     <button class="btn btn-xs btn-stage-all">Stage all</button>
//   </div>
//   <div class="unstaged files"></div>
//   <div class="staged column-header">Staged changes
//     <button class="btn btn-xs btn-unstage-all">Unstage all</button>
//   </div>
//   <div class="staged files"></div>
//   <div class="staged column-header">Commit message</div>
//   <div class="commit-message-box"></div>
//   <div class="undo-last-commit-box"></div>
// ```

export default class FileListComponent {
  constructor ({fileList, fileListSelectionModel}) {
    this.fileList = fileList
    this.fileListSelectionModel = fileListSelectionModel
    etch.createElement(this)

    update = () => etch.updateElement(this)
    this.fileList.onDidChange(update)
    this.fileListSelectionModel.onDidChange(update)

    atom.commands.add(this.element, 'core:move-up', (event) => {
      this.fileListSelectionModel.selectPrevious()
    })
    atom.commands.add(this.element, 'core:move-down', (event) => {
      this.fileListSelectionModel.selectNext()
    })
  }

  render () {
    return (
      <div className="git-file-status-list" tabIndex="-1">
        <div className="column-header">
          Changes
        </div>
        <div className="files">{
          this.fileList.getFiles().map((fileSummary, index) =>
            <div className={`file-summary ${this.getSelectedClassForIndex(index)}`} key={fileSummary.getPathName()}>
              {this.getIconForFileSummary(fileSummary)}
              <span className="path">
                {fileSummary.getPathName()}
              </span>
            </div>
          )
        }</div>
      </div>
    )
  }

  getSelectedClassForIndex(index) {
    return this.fileListSelectionModel.getSelectedIndex() === index ? 'selected' : ''
  }

  getIconForFileSummary(fileSummary) {
    let changeStatus = fileSummary.getChangeStatus()
    return (
      <span className={`icon icon-diff-${changeStatus} status-${changeStatus}`}></span>
    )
  }
}
