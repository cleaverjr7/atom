/** @jsx etch.dom */
/* eslint react/no-unknown-property: "off" */

import {Disposable, CompositeDisposable} from 'atom';
import {remote} from 'electron';
const {Menu, MenuItem} = remote;

import path from 'path';
import etch from 'etch';
import {autobind} from 'core-decorators';

import FilePatchListItemView from './file-patch-list-item-view';
import MergeConflictListItemView from './merge-conflict-list-item-view';
import CompositeListSelection from './composite-list-selection';
import ResolutionProgress from '../models/conflicts/resolution-progress';
import ModelObserver from '../models/model-observer';
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
        this.debouncedDidChangeSelectedItem = this.didChangeSelectedItems;
      } else {
        this.debouncedDidChangeSelectedItem = debounce(this.didChangeSelectedItems, value);
      }
    });
    this.mouseSelectionInProgress = false;
    this.listElementsByItem = new WeakMap();

    this.selection = new CompositeListSelection({
      listsByKey: {
        unstaged: this.props.unstagedChanges,
        conflicts: this.props.mergeConflicts || [],
        staged: this.props.stagedChanges,
      },
      idForItem: item => item.filePath,
    });

    this.resolutionProgressObserver = new ModelObserver({
      didUpdate: () => {
        if (this.element) { etch.update(this); }
      },
    });
    this.resolutionProgressObserver.setActiveModel(this.props.resolutionProgress);

    etch.initialize(this);

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(this.props.commandRegistry.add(this.element, {
      'core:move-up': () => this.selectPrevious(),
      'core:move-down': () => this.selectNext(),
      'core:move-left': () => this.diveIntoSelection(),
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
      'github:open-file': () => this.openFile(),
      'github:resolve-file-as-ours': () => this.resolveCurrentAsOurs(),
      'github:resolve-file-as-theirs': () => this.resolveCurrentAsTheirs(),
    }));
    this.subscriptions.add(this.props.commandRegistry.add('atom-workspace', {
      'github:stage-all': () => this.stageAll(),
      'github:unstage-all': () => this.unstageAll(),
    }));
    this.subscriptions.add(this.props.commandRegistry.add(this.refs.unstagedChanges, {
      'github:discard-changes-in-selected-file': () => this.discardChanges(),
    }));
    window.addEventListener('mouseup', this.mouseup);
    this.subscriptions.add(new Disposable(() => window.removeEventListener('mouseup', this.mouseup)));
  }

  getSelectedConflictPaths() {
    if (this.selection.getActiveListKey() !== 'conflicts') {
      return [];
    }
    return Array.from(this.selection.getSelectedItems(), item => item.filePath);
  }

  async update(props) {
    const oldProps = this.props;
    this.props = {...this.props, ...props};
    this.selection.updateLists({
      unstaged: this.props.unstagedChanges,
      conflicts: this.props.mergeConflicts || [],
      staged: this.props.stagedChanges,
    });

    if (this.props.resolutionProgress !== oldProps.resolutionProgress) {
      await this.resolutionProgressObserver.setActiveModel(this.props.resolutionProgress);
    }

    return etch.update(this);
  }

  openFile() {
    const filePaths = Array.from(this.selection.getSelectedItems()).map(item => item.filePath);
    return this.props.openFiles(filePaths);
  }

  discardChanges() {
    const filePaths = Array.from(this.selection.getSelectedItems()).map(item => item.filePath);
    return this.props.discardWorkDirChangesForPaths(filePaths);
  }

  @autobind
  activateNextList() {
    if (!this.selection.activateNextSelection()) {
      return false;
    }

    this.selection.coalesce();
    this.didChangeSelectedItems();
    etch.update(this);
    return true;
  }

  @autobind
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

  @autobind
  stageAll() {
    if (this.props.unstagedChanges.length === 0) { return null; }
    const filePaths = this.props.unstagedChanges.map(filePatch => filePatch.filePath);
    return this.props.attemptFileStageOperation(filePaths, 'unstaged');
  }

  @autobind
  unstageAll() {
    if (this.props.stagedChanges.length === 0) { return null; }
    const filePaths = this.props.stagedChanges.map(filePatch => filePatch.filePath);
    return this.props.attemptFileStageOperation(filePaths, 'staged');
  }

  @autobind
  stageAllMergeConflicts() {
    if (this.props.mergeConflicts.length === 0) { return null; }
    const filePaths = this.props.mergeConflicts.map(conflict => conflict.filePath);
    return this.props.attemptFileStageOperation(filePaths, 'unstaged');
  }

  confirmSelectedItems() {
    const itemPaths = Array.from(this.selection.getSelectedItems()).map(item => item.filePath);
    return this.props.attemptFileStageOperation(itemPaths, this.selection.getActiveListKey());
  }

  getNextListUpdatePromise() {
    return this.selection.getNextUpdatePromise();
  }

  selectPrevious(preserveTail = false) {
    this.selection.selectPreviousItem(preserveTail);
    this.selection.coalesce();
    if (!preserveTail) { this.debouncedDidChangeSelectedItem(); }
    return etch.update(this);
  }

  selectNext(preserveTail = false) {
    this.selection.selectNextItem(preserveTail);
    this.selection.coalesce();
    if (!preserveTail) { this.debouncedDidChangeSelectedItem(); }
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

  @autobind
  diveIntoSelection() {
    const selectedItems = this.selection.getSelectedItems();
    if (selectedItems.size !== 1) {
      return;
    }

    const selectedItem = selectedItems.values().next().value;
    const stagingStatus = this.selection.getActiveListKey();

    if (stagingStatus === 'conflicts') {
      if (this.props.didDiveIntoMergeConflictPath) {
        this.props.didDiveIntoMergeConflictPath(selectedItem.filePath);
      }
    } else {
      if (this.props.didDiveIntoFilePath) {
        const amending = this.props.isAmending && this.selection.getActiveListKey() === 'staged';
        this.props.didDiveIntoFilePath(selectedItem.filePath, this.selection.getActiveListKey(), {amending});
      }
    }
  }

  @autobind
  showBulkResolveMenu(event) {
    const conflictPaths = this.props.mergeConflicts.map(c => c.filePath);

    event.preventDefault();

    const menu = new Menu();

    menu.append(new MenuItem({
      label: 'Resolve All as Ours',
      click: () => this.props.resolveAsOurs(conflictPaths),
    }));

    menu.append(new MenuItem({
      label: 'Resolve All as Theirs',
      click: () => this.props.resolveAsTheirs(conflictPaths),
    }));

    menu.popup(remote.getCurrentWindow());
  }

  @autobind
  resolveCurrentAsOurs() {
    this.props.resolveAsOurs(this.getSelectedConflictPaths());
  }

  @autobind
  resolveCurrentAsTheirs() {
    this.props.resolveAsTheirs(this.getSelectedConflictPaths());
  }

  writeAfterUpdate() {
    const headItem = this.selection.getHeadItem();
    if (headItem) { this.listElementsByItem.get(headItem).scrollIntoViewIfNeeded(); }
  }

  // Directly modify the selection to include only the item identified by the file path and stagingStatus tuple.
  // Re-render the component, but don't notify didSelectSingleItem() or other callback functions. This is useful to
  // avoid circular callback loops for actions originating in FilePatchView or TextEditors with merge conflicts.
  quietlySelectItem(filePath, stagingStatus) {
    const item = this.selection.findItem((each, key) => each.filePath === filePath && key === stagingStatus);
    if (!item) {
      return Promise.reject(new Error(`Unable to find item at path ${filePath} with staging status ${stagingStatus}`));
    }

    this.selection.selectItem(item);
    return etch.update(this);
  }

  @autobind
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

  @autobind
  dblclickOnItem(event, item) {
    return this.props.attemptFileStageOperation([item.filePath], this.selection.listKeyForItem(item));
  }

  @autobind
  async contextMenuOnItem(event, item) {
    if (!this.selection.getSelectedItems().has(item)) {
      event.stopPropagation();
      this.selection.selectItem(item, event.shiftKey);
      await etch.update(this);
      const newEvent = new MouseEvent(event.type, event);
      requestAnimationFrame(() => {
        event.target.parentNode.dispatchEvent(newEvent);
      });
    }
  }

  @autobind
  async mousedownOnItem(event, item) {
    const windows = process.platform === 'win32';
    if (event.ctrlKey && !windows) { return; } // simply open context menu
    if (event.button === 0) {
      this.mouseSelectionInProgress = true;
      this.selectionChanged = true;
      if (event.metaKey || (event.ctrlKey && windows)) {
        this.selection.addOrSubtractSelection(item);
      } else {
        this.selection.selectItem(item, event.shiftKey);
      }
      await etch.update(this);
    }
  }

  @autobind
  async mousemoveOnItem(event, item) {
    if (this.mouseSelectionInProgress) {
      this.selectionChanged = true;
      this.selection.selectItem(item, true);
      await etch.update(this);
    }
  }

  @autobind
  mouseup() {
    this.selection.coalesce();
    if (this.selectionChanged) { this.didChangeSelectedItems(); }
    this.mouseSelectionInProgress = false;
    this.selectionChanged = false;
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
            {this.props.hasUndoHistory ? this.renderUndoButton() : null}
            {this.props.unstagedChanges.length ? this.renderStageAllButton() : null}
          </header>

          <div ref="unstagedChanges" className="github-StagingView-list github-FilePatchListView" tabIndex="-1">
            {
              this.props.unstagedChanges.map(filePatch => (
                <FilePatchListItemView
                  key={filePatch.filePath}
                  registerItemElement={this.registerItemElement}
                  filePatch={filePatch}
                  ondblclick={event => this.dblclickOnItem(event, filePatch)}
                  oncontextmenu={event => this.contextMenuOnItem(event, filePatch)}
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
            { this.props.stagedChanges.length ? this.renderUnstageAllButton() : null }
          </header>
          <div ref="stagedChanges" className="github-StagingView-list github-FilePatchListView">
            {
              this.props.stagedChanges.map(filePatch => (
                <FilePatchListItemView
                  key={filePatch.filePath}
                  filePatch={filePatch}
                  registerItemElement={this.registerItemElement}
                  ondblclick={event => this.dblclickOnItem(event, filePatch)}
                  oncontextmenu={event => this.contextMenuOnItem(event, filePatch)}
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
      const resolutionProgress = this.resolutionProgressObserver.getActiveModel() || ResolutionProgress.empty();
      const anyUnresolved = mergeConflicts
        .map(conflict => path.join(this.props.workingDirectoryPath, conflict.filePath))
        .some(conflictPath => resolutionProgress.getRemaining(conflictPath) !== 0);

      const bulkResolveDropdown = anyUnresolved ? (
        <span
          className="inline-block icon icon-ellipses"
          onclick={this.showBulkResolveMenu}
        />
      ) : null;

      return (
        <div className={`github-StagingView-group github-MergeConflictPaths ${this.getFocusClass('conflicts')}`}>
          <header className="github-StagingView-header">
            <span className={'github-FilePatchListView-icon icon icon-alert status-modified'} />
            <span className="github-StagingView-title">Merge Conflicts</span>
            {bulkResolveDropdown}
            <button
              className="github-StagingView-headerButton icon icon-move-down"
              disabled={anyUnresolved}
              onclick={this.stageAllMergeConflicts}>
              Stage All
            </button>
          </header>
          <div ref="mergeConflicts" className="github-StagingView-list github-FilePatchListView">
            {
              mergeConflicts.map(mergeConflict => {
                const fullPath = path.join(this.props.workingDirectoryPath, mergeConflict.filePath);

                return (
                  <MergeConflictListItemView
                    key={fullPath}
                    mergeConflict={mergeConflict}
                    remainingConflicts={resolutionProgress.getRemaining(fullPath)}
                    registerItemElement={this.registerItemElement}
                    ondblclick={event => this.dblclickOnItem(event, mergeConflict)}
                    oncontextmenu={event => this.contextMenuOnItem(event, mergeConflict)}
                    onmousedown={event => this.mousedownOnItem(event, mergeConflict)}
                    onmousemove={event => this.mousemoveOnItem(event, mergeConflict)}
                    selected={selectedItems.has(mergeConflict)}
                  />
                );
              })
            }
          </div>
        </div>
      );
    } else {
      return <noscript />;
    }
  }

  renderStageAllButton() {
    return (
      <button className="github-StagingView-headerButton icon icon-move-down"
        onclick={this.stageAll}>Stage All</button>
    );
  }

  renderUnstageAllButton() {
    return (
      <button className="github-StagingView-headerButton icon icon-move-up"
        onclick={this.unstageAll}>Unstage All</button>
    );
  }

  renderUndoButton() {
    return (
      <button className="github-StagingView-headerButton icon icon-history"
        onclick={this.undoLastDiscard}>Undo Discard</button>
    );
  }

  @autobind
  undoLastDiscard() {
    return this.props.undoLastDiscard();
  }

  getFocusClass(listKey) {
    return this.selection.getActiveListKey() === listKey ? 'is-focused' : '';
  }

  @autobind
  registerItemElement(item, element) {
    this.listElementsByItem.set(item, element);
  }

  destroy() {
    this.resolutionProgressObserver.destroy();
    this.subscriptions.dispose();
    etch.destroy(this);
  }

  focus() {
    this.element.focus();
  }

  isFocused() {
    return document.activeElement === this.element || this.element.contains(document.activeElement);
  }
}
