/** @babel */
/** @jsx etch.dom */

import etch from 'etch'

import ListView from './list-view'
import FilePatchListItemView from './file-patch-list-item-view'
import MergeConflictListItemView from './merge-conflict-list-item-view'
import MultiList from '../multi-list'

export const ListTypes = {
  STAGED: Symbol('LIST_STAGED'),
  UNSTAGED: Symbol('LIST_UNSTAGED'),
  CONFLICTS: Symbol('LIST_CONFLICTS')
}

const ListNames = {
  [ListTypes.STAGED]: 'staged',
  [ListTypes.UNSTAGED]: 'unstaged',
  [ListTypes.CONFLICTS]: 'conflicts'
}

export default class StagingView {
  constructor (props) {
    this.props = props
    this.selectStagedFilePatch = this.selectStagedFilePatch.bind(this)
    this.selectUnstagedFilePatch = this.selectUnstagedFilePatch.bind(this)
    this.selectMergeConflictFile = this.selectMergeConflictFile.bind(this)
    this.addMergeConflictFileToIndex = this.addMergeConflictFileToIndex.bind(this)
    this.stageFilePatch = this.stageFilePatch.bind(this)
    this.unstageFilePatch = this.unstageFilePatch.bind(this)
    this.multiList = new MultiList([this.props.unstagedChanges, this.props.mergeConflicts || [], this.props.stagedChanges])
    etch.initialize(this)

    this.subscriptions = atom.commands.add(this.element, {
      'core:move-up': this.selectPreviousFilePatch.bind(this),
      'core:move-down': this.selectNextFilePatch.bind(this),
      'core:confirm': this.confirmSelectedItem.bind(this),
      'git:focus-next-list': this.focusNextList.bind(this),
      'git:focus-previous-list': this.focusPreviousList.bind(this)
    })
  }

  update (props) {
    this.props = props
    this.multiList.updateLists([this.props.unstagedChanges, this.props.mergeConflicts || [], this.props.stagedChanges])
    return etch.update(this)
  }

  selectList (list) {
    let listIndex
    if (list === ListTypes.UNSTAGED) {
      listIndex = 0
    } else if (list === ListTypes.CONFLICTS) {
      listIndex = 1
    } else if (list === ListTypes.STAGED) {
      listIndex = 2
    }
    if (this.multiList.getListAtIndex(listIndex).length) {
      this.multiList.selectListAtIndex(listIndex)
    }
    return etch.update(this)
  }

  focusNextList () {
    this.multiList.selectNextList({wrap: true})
    return etch.update(this)
  }

  focusPreviousList () {
    this.multiList.selectPreviousList({wrap: true})
    return etch.update(this)
  }

  confirmSelectedItem () {
    const item = this.multiList.getSelectedItem()
    const list = this.getSelectedList()
    return list === ListTypes.STAGED ? this.unstageFilePatch(item) : this.stageFilePatch(item)
  }

  getSelectedList () {
    const index = this.multiList.getSelectedListIndex()
    if (index === 0) {
      return ListTypes.UNSTAGED
    } else if (index === 1) {
      return ListTypes.CONFLICTS
    } else if (index === 2) {
      return ListTypes.STAGED
    }
  }

  selectStagedFilePatch (filePatch) {
    this.multiList.selectItem(filePatch)
    if (this.props.didSelectFilePatch) this.props.didSelectFilePatch(filePatch, 'staged')
    return etch.update(this)
  }

  selectUnstagedFilePatch (filePatch) {
    this.multiList.selectItem(filePatch)
    if (this.props.didSelectFilePatch) this.props.didSelectFilePatch(filePatch, 'unstaged')
    return etch.update(this)
  }

  selectMergeConflictFile (mergeConflict) {
    this.multiList.selectItem(mergeConflict)
    if (this.props.didSelectMergeConflictFile) this.props.didSelectMergeConflictFile(mergeConflict.getPath())
    return etch.update(this)
  }

  addMergeConflictFileToIndex (mergeConflict) {
    return this.props.stageFile(mergeConflict.getPath())
  }

  stageFilePatch (filePatch) {
    return this.props.stageFile(filePatch.getPath())
  }

  unstageFilePatch (filePatch) {
    return this.props.unstageFile(filePatch.getPath())
  }

  async selectPreviousFilePatch () {
    this.multiList.selectPreviousItem()
    await etch.update(this)
    const filePatch = this.multiList.getSelectedItem()
    const listName = ListNames[this.getSelectedList()]
    if (this.props.didSelectFilePatch) this.props.didSelectFilePatch(filePatch, listName)
  }

  async selectNextFilePatch () {
    this.multiList.selectNextItem()
    await etch.update(this)
    const filePatch = this.multiList.getSelectedItem()
    const listName = ListNames[this.getSelectedList()]
    if (this.props.didSelectFilePatch) this.props.didSelectFilePatch(filePatch, listName)
  }

  buildDebugData () {
    const getPath = (fp) => fp ? fp.getNewPath() : '<none>'
    const multiListData = this.multiList.toObject()
    return {
      ...multiListData,
      lists: multiListData.lists.map(list => list.map(getPath))
    }
  }

  render () {
    let stagedClassName = ''
    let unstagedClassName = ''
    let conflictsClassName = ''
    const selectedList = this.getSelectedList()
    if (selectedList === ListTypes.STAGED) {
      stagedClassName = 'is-focused'
    } else if (selectedList === ListTypes.UNSTAGED) {
      unstagedClassName = 'is-focused'
    } else if (selectedList === ListTypes.CONFLICTS) {
      conflictsClassName = 'is-focused'
    }

    const mergeConflictsView = (
      <div className={`git-StagingView-group git-MergeConflictPaths ${conflictsClassName}`}>
        <header className='git-StagingView-header'>
          <span className={'git-FilePatchListView-icon icon icon-alert status-modified'} />
          Merge Conflicts
          <span className={'git-FilePatchListView-icon icon icon-alert status-modified'} />
        </header>
        <ListView
          className='git-FilePatchListView'
          ref='mergeConflictListView'
          didSelectItem={this.selectMergeConflictFile}
          didConfirmItem={this.addMergeConflictFileToIndex}
          items={this.multiList.getListAtIndex(1)}
          selectedItemIndex={this.multiList.getSelectedItemIndexForList(1)}
          renderItem={this.renderMergeConflictListItem}
        />
      </div>
    )

    return (
      <div className={`git-StagingView ${ListNames[selectedList]}-changes-focused`} style={{width: 200}} tabIndex='-1'>
        <div className={`git-StagingView-group git-UnstagedChanges ${unstagedClassName}`}>
          <header className='git-StagingView-header'>Unstaged Changes</header>
          <ListView
            className='git-FilePatchListView'
            ref='unstagedChangesView'
            didSelectItem={this.selectUnstagedFilePatch}
            didConfirmItem={this.stageFilePatch}
            items={this.multiList.getListAtIndex(0)}
            selectedItemIndex={this.multiList.getSelectedItemIndexForList(0)}
            renderItem={this.renderFilePatchListItem}
          />
        </div>
        { this.multiList.getListAtIndex(1).length ? mergeConflictsView : <noscript /> }
        <div className={`git-StagingView-group git-StagedChanges ${stagedClassName}`}>
          <header className='git-StagingView-header'>Staged Changes</header>
          <ListView
            className='git-FilePatchListView'
            ref='stagedChangesView'
            didSelectItem={this.selectStagedFilePatch}
            didConfirmItem={this.unstageFilePatch}
            items={this.multiList.getListAtIndex(2)}
            selectedItemIndex={this.multiList.getSelectedItemIndexForList(2)}
            renderItem={this.renderFilePatchListItem}
          />
        </div>
      </div>
    )
  }

  renderFilePatchListItem (filePatch, selected, handleItemClickEvent) {
    return <FilePatchListItemView filePatch={filePatch} selected={selected} onclick={handleItemClickEvent} />
  }

  renderMergeConflictListItem (mergeConflict, selected, handleItemClickEvent) {
    return <MergeConflictListItemView mergeConflict={mergeConflict} selected={selected} onclick={handleItemClickEvent} />
  }

  destroy () {
    this.subscriptions.dispose()
    etch.destroy(this)
  }

  focus () {
    this.element.focus()
  }

  isFocused () {
    return document.activeElement === this.element
  }
}
