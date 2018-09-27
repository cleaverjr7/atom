import React from 'react';
import PropTypes from 'prop-types';
import path from 'path';

import {autobind, equalSets} from '../helpers';
import FilePatchItem from '../items/file-patch-item';
import FilePatchView from '../views/file-patch-view';

export default class FilePatchController extends React.Component {
  static propTypes = {
    repository: PropTypes.object.isRequired,
    stagingStatus: PropTypes.oneOf(['staged', 'unstaged']),
    relPath: PropTypes.string.isRequired,
    filePatch: PropTypes.object.isRequired,

    workspace: PropTypes.object.isRequired,
    commands: PropTypes.object.isRequired,
    keymaps: PropTypes.object.isRequired,
    tooltips: PropTypes.object.isRequired,

    destroy: PropTypes.func.isRequired,
    discardLines: PropTypes.func.isRequired,
    undoLastDiscard: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);
    autobind(
      this,
      'selectedRowsChanged',
      'undoLastDiscard', 'diveIntoMirrorPatch', 'openFile',
      'toggleFile', 'toggleRows', 'toggleModeChange', 'toggleSymlinkChange', 'discardRows',
    );

    this.state = {
      lastFilePatch: this.props.filePatch,
      selectionMode: 'line',
      selectedRows: new Set(),
    };

    this.mouseSelectionInProgress = false;
    this.stagingOperationInProgress = false;

    this.patchChangePromise = new Promise(resolve => {
      this.resolvePatchChangePromise = resolve;
    });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.filePatch !== this.props.filePatch) {
      this.resolvePatchChangePromise();
      this.patchChangePromise = new Promise(resolve => {
        this.resolvePatchChangePromise = resolve;
      });
    }
  }

  render() {
    return (
      <FilePatchView
        {...this.props}

        selectedRows={this.state.selectedRows}
        selectionMode={this.state.selectionMode}
        selectedRowsChanged={this.selectedRowsChanged}

        diveIntoMirrorPatch={this.diveIntoMirrorPatch}
        openFile={this.openFile}
        toggleFile={this.toggleFile}
        toggleRows={this.toggleRows}
        toggleModeChange={this.toggleModeChange}
        toggleSymlinkChange={this.toggleSymlinkChange}
        undoLastDiscard={this.undoLastDiscard}
        discardRows={this.discardRows}
        selectNextHunk={this.selectNextHunk}
        selectPreviousHunk={this.selectPreviousHunk}
      />
    );
  }

  undoLastDiscard() {
    return this.props.undoLastDiscard(this.props.relPath, this.props.repository);
  }

  diveIntoMirrorPatch() {
    const mirrorStatus = this.withStagingStatus({staged: 'unstaged', unstaged: 'staged'});
    const workingDirectory = this.props.repository.getWorkingDirectoryPath();
    const uri = FilePatchItem.buildURI(this.props.relPath, workingDirectory, mirrorStatus);

    this.props.destroy();
    return this.props.workspace.open(uri);
  }

  async openFile(positions) {
    const absolutePath = path.join(this.props.repository.getWorkingDirectoryPath(), this.props.relPath);
    const editor = await this.props.workspace.open(absolutePath, {pending: true});
    if (positions.length > 0) {
      editor.setCursorBufferPosition(positions[0], {autoscroll: false});
      for (const position of positions.slice(1)) {
        editor.addCursorAtBufferPosition(position);
      }
      editor.scrollToBufferPosition(positions[positions.length - 1], {center: true});
    }
    return editor;
  }

  toggleFile() {
    return this.stagingOperation(() => {
      const methodName = this.withStagingStatus({staged: 'unstageFiles', unstaged: 'stageFiles'});
      return this.props.repository[methodName]([this.props.relPath]);
    });
  }

  async toggleRows(rowSet, nextSelectionMode) {
    let chosenRows = rowSet;
    if (chosenRows) {
      await this.selectedRowsChanged(chosenRows, nextSelectionMode);
    } else {
      chosenRows = this.state.selectedRows;
    }

    if (chosenRows.size === 0) {
      return Promise.resolve();
    }

    return this.stagingOperation(() => {
      const patch = this.withStagingStatus({
        staged: () => this.props.filePatch.getUnstagePatchForLines(chosenRows),
        unstaged: () => this.props.filePatch.getStagePatchForLines(chosenRows),
      });
      return this.props.repository.applyPatchToIndex(patch);
    });
  }

  toggleModeChange() {
    return this.stagingOperation(() => {
      const targetMode = this.withStagingStatus({
        unstaged: this.props.filePatch.getNewMode(),
        staged: this.props.filePatch.getOldMode(),
      });
      return this.props.repository.stageFileModeChange(this.props.relPath, targetMode);
    });
  }

  toggleSymlinkChange() {
    return this.stagingOperation(() => {
      const {filePatch, relPath, repository} = this.props;
      return this.withStagingStatus({
        unstaged: () => {
          if (filePatch.hasTypechange() && filePatch.getStatus() === 'added') {
            return repository.stageFileSymlinkChange(relPath);
          }

          return repository.stageFiles([relPath]);
        },
        staged: () => {
          if (filePatch.hasTypechange() && filePatch.getStatus() === 'deleted') {
            return repository.stageFileSymlinkChange(relPath);
          }

          return repository.unstageFiles([relPath]);
        },
      });
    });
  }

  async discardRows(rowSet, nextSelectionMode) {
    let chosenRows = rowSet;
    if (chosenRows) {
      await this.selectedRowsChanged(chosenRows, nextSelectionMode);
    } else {
      chosenRows = this.state.selectedRows;
    }

    return this.props.discardLines(this.props.filePatch, chosenRows, this.props.repository);
  }

  selectedRowsChanged(rows, nextSelectionMode) {
    if (equalSets(this.state.selectedRows, rows) && this.state.selectionMode === nextSelectionMode) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      this.setState({selectedRows: rows, selectionMode: nextSelectionMode}, resolve);
    });
  }

  withStagingStatus(callbacks) {
    const callback = callbacks[this.props.stagingStatus];
    /* istanbul ignore if */
    if (!callback) {
      throw new Error(`Unknown staging status: ${this.props.stagingStatus}`);
    }
    return callback instanceof Function ? callback() : callback;
  }

  stagingOperation(fn) {
    if (this.stagingOperationInProgress) {
      return null;
    }
    this.stagingOperationInProgress = true;
    this.patchChangePromise.then(() => {
      this.stagingOperationInProgress = false;
    });

    return fn();
  }
}
