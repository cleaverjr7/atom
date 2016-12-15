/** @babel */
/** @jsx etch.dom */
/* eslint react/no-unknown-property: "off" */

import etch from 'etch';
import {Disposable, CompositeDisposable} from 'atom';

import FilePatchListItemView from './file-patch-list-item-view';
import MergeConflictListItemView from './merge-conflict-list-item-view';
import CompositeListSelection from './composite-list-selection';
import {shortenSha} from '../helpers';

const debounce = (fn, wait) => {
  let timeout;
  return (...args) => {
    return new Promise(resolve => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        resolve(fn(...args));
      }, wait);
    });
  };
};

export default class StagingView {
  constructor(props) {
    this.props = props;
    atom.config.observe('github.keyboardNavigationDelay', value => {
      if (value === 0) {
        this.debouncedDidChangeSelectedItem = this.didChangeSelectedItems.bind(this);
      } else {
        this.debouncedDidChangeSelectedItem = debounce(this.didChangeSelectedItems.bind(this), value);
      }
    });
    this.mouseSelectionInProgress = false;
    this.listElementsByItem = new WeakMap();

    this.registerItemElement = this.registerItemElement.bind(this);
    this.mousedownOnItem = this.mousedownOnItem.bind(this);
    this.mousemoveOnItem = this.mousemoveOnItem.bind(this);
    this.mouseup = this.mouseup.bind(this);
    this.activateNextList = this.activateNextList.bind(this);
    this.activatePreviousList = this.activatePreviousList.bind(this);

    this.selection = new CompositeListSelection({
      listsByKey: {
        unstaged: this.props.unstagedChanges,
        conflicts: this.props.mergeConflicts || [],
        staged: this.props.stagedChanges,
      },
      idForItem: item => item.filePath,
    });
    etch.initialize(this);

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.commands.add(this.element, {
      'core:move-up': () => this.selectPrevious(),
      'core:move-down': () => this.selectNext(),
      'core:select-up': () => this.selectPrevious(true),
      'core:select-down': () => this.selectNext(true),
      'core:select-all': () => this.selectAll(),
      'core:move-to-top': () => this.selectFirst(),
      'core:move-to-bottom': () => this.selectLast(),
      'core:select-to-top': () => this.selectFirst(true),
      'core:select-to-bottom': () => this.selectLast(true),
      'core:confirm': () => this.confirmSelectedItems(),
      'github:activate-next-list': () => this.activateNextList(),
      'github:activate-previous-list': () => this.activatePreviousList(),
      'github:focus-diff-view': () => this.props.focusFilePatchView(),
    }));
    window.addEventListener('mouseup', this.mouseup);
    this.subscriptions.add(new Disposable(() => window.removeEventListener('mouseup', this.mouseup)));
  }

  update(props) {
    this.props = props;
    this.selection.updateLists({
      unstaged: this.props.unstagedChanges,
      conflicts: this.props.mergeConflicts || [],
      staged: this.props.stagedChanges,
    });
    return etch.update(this);
  }

  activateNextList() {
    if (!this.selection.activateNextSelection()) {
      return false;
    }

    this.selection.coalesce();
    this.didChangeSelectedItems();
    etch.update(this);
    return true;
  }

  activatePreviousList() {
    if (!this.selection.activatePreviousSelection()) {
      return false;
    }

    this.selection.coalesce();
    this.didChangeSelectedItems();
    etch.update(this);
    return true;
  }

  activateLastList() {
    if (!this.selection.activateLastSelection()) {
      return false;
    }

    this.selection.coalesce();
    this.didChangeSelectedItems();
    etch.update(this);
    return true;
  }

  confirmSelectedItems() {
    const itemPaths = Array.from(this.selection.getSelectedItems()).map(item => item.filePath);
    if (this.selection.getActiveListKey() === 'staged') {
      return this.props.unstageFiles(itemPaths);
    } else {
      return this.props.stageFiles(itemPaths);
    }
  }

  selectPrevious(preserveTail = false) {
    this.selection.selectPreviousItem(preserveTail);
    this.selection.coalesce();
    if (!preserveTail) { this.debouncedDidChangeSelectedItem(); }
    return etch.update(this);
  }

  selectNext(preserveTail = false) {
    const wasAdvanced = this.selection.selectNextItem(preserveTail);
    this.selection.coalesce();
    if (!preserveTail) { this.debouncedDidChangeSelectedItem(); }
    if (!wasAdvanced && this.props.didSelectPastEnd) {
      this.props.didSelectPastEnd();
    }
    return etch.update(this);
  }

  selectAll() {
    this.selection.selectAllItems();
    this.selection.coalesce();
    return etch.update(this);
  }

  selectFirst(preserveTail = false) {
    this.selection.selectFirstItem(preserveTail);
    this.selection.coalesce();
    if (!preserveTail) { this.debouncedDidChangeSelectedItem(); }
    return etch.update(this);
  }

  selectLast(preserveTail = false) {
    this.selection.selectLastItem(preserveTail);
    this.selection.coalesce();
    if (!preserveTail) { this.debouncedDidChangeSelectedItem(); }
    return etch.update(this);
  }

  writeAfterUpdate() {
    const headItem = this.selection.getHeadItem();
    if (headItem) { this.listElementsByItem.get(headItem).scrollIntoViewIfNeeded(); }
  }

  didChangeSelectedItems() {
    const selectedItems = Array.from(this.selection.getSelectedItems());
    if (this.isFocused() && selectedItems.length === 1) {
      this.didSelectSingleItem(selectedItems[0]);
    }
  }

  didSelectSingleItem(selectedItem) {
    if (this.selection.getActiveListKey() === 'conflicts') {
      if (this.props.didSelectMergeConflictFile) {
        this.props.didSelectMergeConflictFile(selectedItem.filePath);
      }
    } else {
      if (this.props.didSelectFilePath) {
        const amending = this.props.isAmending && this.selection.getActiveListKey() === 'staged';
        this.props.didSelectFilePath(
          selectedItem.filePath,
          this.selection.getActiveListKey(),
          {amending, activate: true},
        );
      }
    }
  }

  async mousedownOnItem(event, item) {
    if (event.detail >= 2) {
      if (this.selection.listKeyForItem(item) === 'staged') {
        await this.props.unstageFiles([item.filePath]);
      } else {
        await this.props.stageFiles([item.filePath]);
      }
    } else {
      if (event.ctrlKey || event.metaKey) {
        this.selection.addOrSubtractSelection(item);
      } else {
        this.selection.selectItem(item, event.shiftKey);
      }
      await etch.update(this);
      this.mouseSelectionInProgress = true;
    }
  }

  mousemoveOnItem(event, item) {
    if (this.mouseSelectionInProgress) {
      this.selection.selectItem(item, true);
      return etch.update(this);
    } else {
      return Promise.resolve();
    }
  }

  mouseup() {
    if (this.mouseSelectionInProgress) {
      this.mouseSelectionInProgress = false;
      this.selection.coalesce();
      this.didChangeSelectedItems();
    }
  }

  render() {
    const selectedItems = this.selection.getSelectedItems();

    return (
      <div
        className={`github-StagingView ${this.selection.getActiveListKey()}-changes-focused`}
        style={{width: 200}}
        tabIndex="-1">
        <div className={`github-StagingView-group github-UnstagedChanges ${this.getFocusClass('unstaged')}`}>
          <header className="github-StagingView-header">
            <span className="icon icon-list-unordered" />
            <span className="github-StagingView-title">Unstaged Changes</span>
          </header>

          <div ref="unstagedChanges" className="github-StagingView-list github-FilePatchListView">
            {
              this.props.unstagedChanges.map(filePatch => (
                <FilePatchListItemView
                  key={filePatch.filePath}
                  registerItemElement={this.registerItemElement}
                  filePatch={filePatch}
                  onmousedown={event => this.mousedownOnItem(event, filePatch)}
                  onmousemove={event => this.mousemoveOnItem(event, filePatch)}
                  selected={selectedItems.has(filePatch)}
                />
              ))
            }
          </div>
        </div>
        { this.renderMergeConflicts() }
        <div className={`github-StagingView-group github-StagedChanges ${this.getFocusClass('staged')}`} >
          <header className="github-StagingView-header">
            <span className="icon icon-tasklist" />
            <span className="github-StagingView-title">
              Staged Changes
              {
                this.props.isAmending
                  ? ` (amending ${shortenSha(this.props.lastCommit.sha)})`
                  : ''
              }
            </span>
          </header>
          <div ref="stagedChanges" className="github-StagingView-list github-FilePatchListView">
            {
              this.props.stagedChanges.map(filePatch => (
                <FilePatchListItemView
                  key={filePatch.filePath}
                  filePatch={filePatch}
                  registerItemElement={this.registerItemElement}
                  onmousedown={event => this.mousedownOnItem(event, filePatch)}
                  onmousemove={event => this.mousemoveOnItem(event, filePatch)}
                  selected={selectedItems.has(filePatch)}
                />
              ))
            }
          </div>
        </div>
      </div>
    );
  }

  renderMergeConflicts() {
    const mergeConflicts = this.props.mergeConflicts;

    if (mergeConflicts && mergeConflicts.length > 0) {
      const selectedItems = this.selection.getSelectedItems();
      return (
        <div className={`github-StagingView-group github-MergeConflictPaths ${this.getFocusClass('conflicts')}`}>
          <header className="github-StagingView-header">
            <span className={'github-FilePatchListView-icon icon icon-alert status-modified'} />
            <span className="github-StagingView-title">Merge Conflicts</span>
          </header>
          <div ref="mergeConflicts" className="github-StagingView-list github-FilePatchListView">
            {
              mergeConflicts.map(mergeConflict => (
                <MergeConflictListItemView
                  key={mergeConflict.filePath}
                  mergeConflict={mergeConflict}
                  registerItemElement={this.registerItemElement}
                  onmousedown={event => this.mousedownOnItem(event, mergeConflict)}
                  onmousemove={event => this.mousemoveOnItem(event, mergeConflict)}
                  selected={selectedItems.has(mergeConflict)}
                />
              ))
            }
          </div>
        </div>
      );
    } else {
      return <noscript />;
    }
  }

  getFocusClass(listKey) {
    return this.selection.getActiveListKey() === listKey ? 'is-focused' : '';
  }

  registerItemElement(item, element) {
    this.listElementsByItem.set(item, element);
  }

  destroy() {
    this.subscriptions.dispose();
    etch.destroy(this);
  }

  focus() {
    this.element.focus();
  }

  isFocused() {
    return document.activeElement === this.element;
  }
}
