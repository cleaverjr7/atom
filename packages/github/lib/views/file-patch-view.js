import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import {Range} from 'atom';
import {CompositeDisposable} from 'event-kit';

import {autobind} from '../helpers';
import AtomTextEditor from '../atom/atom-text-editor';
import Marker from '../atom/marker';
import MarkerLayer from '../atom/marker-layer';
import Decoration from '../atom/decoration';
import Gutter from '../atom/gutter';
import Commands, {Command} from '../atom/commands';
import FilePatchHeaderView from './file-patch-header-view';
import FilePatchMetaView from './file-patch-meta-view';
import HunkHeaderView from './hunk-header-view';
import RefHolder from '../models/ref-holder';

const executableText = {
  100644: 'non executable',
  100755: 'executable',
};

const NBSP_CHARACTER = '\u00a0';

export default class FilePatchView extends React.Component {
  static propTypes = {
    relPath: PropTypes.string.isRequired,
    stagingStatus: PropTypes.oneOf(['staged', 'unstaged']).isRequired,
    isPartiallyStaged: PropTypes.bool.isRequired,
    filePatch: PropTypes.object.isRequired,
    selectionMode: PropTypes.oneOf(['hunk', 'line']).isRequired,
    selectedRows: PropTypes.object.isRequired,
    repository: PropTypes.object.isRequired,

    workspace: PropTypes.object.isRequired,
    commands: PropTypes.object.isRequired,
    keymaps: PropTypes.object.isRequired,
    tooltips: PropTypes.object.isRequired,

    selectedRowsChanged: PropTypes.func.isRequired,

    diveIntoMirrorPatch: PropTypes.func.isRequired,
    openFile: PropTypes.func.isRequired,
    toggleFile: PropTypes.func.isRequired,
    toggleRows: PropTypes.func.isRequired,
    toggleModeChange: PropTypes.func.isRequired,
    toggleSymlinkChange: PropTypes.func.isRequired,
    undoLastDiscard: PropTypes.func.isRequired,
    discardRows: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);
    autobind(
      this,
      'didMouseDownOnHeader', 'didMouseDownOnLineNumber', 'didMouseMoveOnLineNumber', 'didMouseUp',
      'didConfirm', 'didToggleSelectionMode', 'selectNextHunk', 'selectPreviousHunk', 'hunkSelectDown', 'hunkSelectUp',
      'didDiscardSelection', 'didOpenFile', 'didAddSelection', 'didChangeSelectionRange', 'didDestroySelection',
      'oldLineNumberLabel', 'newLineNumberLabel',
    );

    this.mouseSelectionInProgress = false;
    this.lastMouseMoveLine = null;
    this.nextSelectionMode = null;
    this.suppressChanges = false;
    this.refRoot = new RefHolder();
    this.refEditor = new RefHolder();
    this.refEditorElement = new RefHolder();

    this.subs = new CompositeDisposable();

    this.subs.add(
      this.refEditor.observe(editor => {
        this.refEditorElement.setter(editor.getElement());
      }),
    );
  }

  componentDidMount() {
    window.addEventListener('mouseup', this.didMouseUp);
    this.refEditor.map(editor => {
      const [firstHunk] = this.props.filePatch.getHunks();
      if (firstHunk) {
        this.nextSelectionMode = 'hunk';
        editor.setSelectedBufferRange(firstHunk.getRange());
      }
      return null;
    });
  }

  getSnapshotBeforeUpdate(prevProps) {
    let newSelectionRange = null;
    if (this.props.filePatch !== prevProps.filePatch) {
      // Heuristically adjust the editor selection based on the old file patch, the old row selection state, and
      // the incoming patch.
      newSelectionRange = this.props.filePatch.getNextSelectionRange(
        prevProps.filePatch,
        prevProps.selectedRows,
      );

      this.suppressChanges = true;
      this.props.filePatch.adoptBufferFrom(prevProps.filePatch);
      this.suppressChanges = false;
    }
    return newSelectionRange;
  }

  componentDidUpdate(prevProps, prevState, newSelectionRange) {
    if (newSelectionRange) {
      this.refEditor.map(editor => {
        if (this.props.selectionMode === 'line') {
          this.nextSelectionMode = 'line';
          editor.setSelectedBufferRange(newSelectionRange);
        } else {
          const nextHunks = new Set(
            Range.fromObject(newSelectionRange).getRows()
              .map(row => this.props.filePatch.getHunkAt(row))
              .filter(Boolean),
          );
          const nextRanges = nextHunks.size > 0
            ? Array.from(nextHunks, hunk => hunk.getRange())
            : [[[0, 0], [0, 0]]];

          this.nextSelectionMode = 'hunk';
          editor.setSelectedBufferRanges(nextRanges);
        }

        return null;
      });
    } else {
      this.nextSelectionMode = null;
    }
  }

  componentWillUnmount() {
    window.removeEventListener('mouseup', this.didMouseUp);
    this.subs.dispose();
  }

  render() {
    const rootClass = cx(
      'github-FilePatchView',
      `github-FilePatchView--${this.props.stagingStatus}`,
      {'github-FilePatchView--blank': !this.props.filePatch.isPresent()},
      {'github-FilePatchView--hunkMode': this.props.selectionMode === 'hunk'},
    );

    return (
      <div className={rootClass} tabIndex="-1" ref={this.refRoot.setter}>

        {this.renderCommands()}

        <FilePatchHeaderView
          relPath={this.props.relPath}
          stagingStatus={this.props.stagingStatus}
          isPartiallyStaged={this.props.isPartiallyStaged}
          hasHunks={this.props.filePatch.getHunks().length > 0}
          hasUndoHistory={this.props.repository.hasDiscardHistory(this.props.relPath)}

          tooltips={this.props.tooltips}

          undoLastDiscard={this.props.undoLastDiscard}
          diveIntoMirrorPatch={this.props.diveIntoMirrorPatch}
          openFile={this.didOpenFile}
          toggleFile={this.props.toggleFile}
        />

        <main className="github-FilePatchView-container">
          {this.props.filePatch.isPresent() ? this.renderNonEmptyPatch() : this.renderEmptyPatch()}
        </main>

      </div>
    );
  }

  renderCommands() {
    return (
      <Commands registry={this.props.commands} target={this.refRoot}>
        <Command command="core:confirm" callback={this.didConfirm} />
        <Command command="github:discard-selected-lines" callback={this.didDiscardSelection} />
        <Command command="github:select-next-hunk" callback={this.selectNextHunk} />
        <Command command="github:select-previous-hunk" callback={this.selectPreviousHunk} />
        <Command command="github:open-file" callback={this.didOpenFile} />
        <Command command="github:toggle-patch-selection-mode" callback={this.didToggleSelectionMode} />
      </Commands>
    );
  }

  renderEmptyPatch() {
    return <p className="github-FilePatchView-message icon icon-info">No changes to display</p>;
  }

  renderNonEmptyPatch() {
    return (
      <AtomTextEditor
        workspace={this.props.workspace}

        buffer={this.props.filePatch.getBuffer()}
        lineNumberGutterVisible={false}
        autoWidth={false}
        autoHeight={false}
        readOnly={true}
        softWrapped={true}

        didAddSelection={this.didAddSelection}
        didChangeSelectionRange={this.didChangeSelectionRange}
        didDestroySelection={this.didDestroySelection}
        refModel={this.refEditor}>

        <Gutter
          name="old-line-numbers"
          priority={1}
          className="old"
          type="line-number"
          labelFn={this.oldLineNumberLabel}
          onMouseDown={this.didMouseDownOnLineNumber}
          onMouseMove={this.didMouseMoveOnLineNumber}
        />
        <Gutter
          name="new-line-numbers"
          priority={2}
          className="new"
          type="line-number"
          labelFn={this.newLineNumberLabel}
          onMouseDown={this.didMouseDownOnLineNumber}
          onMouseMove={this.didMouseMoveOnLineNumber}
        />

        <Marker invalidate="never" bufferRange={Range.fromObject([[0, 0], [0, 0]])}>
          <Decoration type="block">
            <Fragment>
              {this.renderExecutableModeChangeMeta()}
              {this.renderSymlinkChangeMeta()}
            </Fragment>
          </Decoration>
        </Marker>

        {this.renderHunkHeaders()}

        {this.renderLineDecorations(
          Array.from(this.props.selectedRows, row => Range.fromObject([[row, 0], [row, Infinity]])),
          'github-FilePatchView-line--selected',
          {gutter: true, line: true},
        )}

        {this.renderDecorationsOnLayer(
          this.props.filePatch.getAdditionLayer(),
          'github-FilePatchView-line--added',
          {line: true},
        )}
        {this.renderDecorationsOnLayer(
          this.props.filePatch.getDeletionLayer(),
          'github-FilePatchView-line--deleted',
          {line: true},
        )}
        {this.renderDecorationsOnLayer(
          this.props.filePatch.getNoNewlineLayer(),
          'github-FilePatchView-line--nonewline',
          {line: true},
        )}

      </AtomTextEditor>
    );
  }

  renderExecutableModeChangeMeta() {
    if (!this.props.filePatch.didChangeExecutableMode()) {
      return null;
    }

    const oldMode = this.props.filePatch.getOldMode();
    const newMode = this.props.filePatch.getNewMode();

    const attrs = this.props.stagingStatus === 'unstaged'
      ? {
        actionIcon: 'icon-move-down',
        actionText: 'Stage Mode Change',
      }
      : {
        actionIcon: 'icon-move-up',
        actionText: 'Unstage Mode Change',
      };

    return (
      <FilePatchMetaView
        title="Mode change"
        actionIcon={attrs.actionIcon}
        actionText={attrs.actionText}
        action={this.props.toggleModeChange}>
        <Fragment>
          File changed mode
          <span className="github-FilePatchView-metaDiff github-FilePatchView-metaDiff--removed">
            from {executableText[oldMode]} <code>{oldMode}</code>
          </span>
          <span className="github-FilePatchView-metaDiff github-FilePatchView-metaDiff--added">
            to {executableText[newMode]} <code>{newMode}</code>
          </span>
        </Fragment>
      </FilePatchMetaView>
    );
  }

  renderSymlinkChangeMeta() {
    if (!this.props.filePatch.hasSymlink()) {
      return null;
    }

    let detail = <div />;
    let title = '';
    const oldSymlink = this.props.filePatch.getOldSymlink();
    const newSymlink = this.props.filePatch.getNewSymlink();
    if (oldSymlink && newSymlink) {
      detail = (
        <Fragment>
          Symlink changed
          <span className={cx(
            'github-FilePatchView-metaDiff',
            'github-FilePatchView-metaDiff--fullWidth',
            'github-FilePatchView-metaDiff--removed',
          )}>
            from <code>{oldSymlink}</code>
          </span>
          <span className={cx(
            'github-FilePatchView-metaDiff',
            'github-FilePatchView-metaDiff--fullWidth',
            'github-FilePatchView-metaDiff--added',
          )}>
            to <code>{newSymlink}</code>
          </span>.
        </Fragment>
      );
      title = 'Symlink changed';
    } else if (oldSymlink && !newSymlink) {
      detail = (
        <Fragment>
          Symlink
          <span className="github-FilePatchView-metaDiff github-FilePatchView-metaDiff--removed">
            to <code>{oldSymlink}</code>
          </span>
          deleted.
        </Fragment>
      );
      title = 'Symlink deleted';
    } else {
      detail = (
        <Fragment>
          Symlink
          <span className="github-FilePatchView-metaDiff github-FilePatchView-metaDiff--added">
            to <code>{newSymlink}</code>
          </span>
          created.
        </Fragment>
      );
      title = 'Symlink created';
    }

    const attrs = this.props.stagingStatus === 'unstaged'
      ? {
        actionIcon: 'icon-move-down',
        actionText: 'Stage Symlink Change',
      }
      : {
        actionIcon: 'icon-move-up',
        actionText: 'Unstage Symlink Change',
      };

    return (
      <FilePatchMetaView
        title={title}
        actionIcon={attrs.actionIcon}
        actionText={attrs.actionText}
        action={this.props.toggleSymlinkChange}>
        <Fragment>
          {detail}
        </Fragment>
      </FilePatchMetaView>
    );
  }

  renderHunkHeaders() {
    const toggleVerb = this.props.stagingStatus === 'unstaged' ? 'Stage' : 'Unstage';
    const selectedHunks = new Set(
      Array.from(this.props.selectedRows, row => this.props.filePatch.getHunkAt(row)),
    );

    return (
      <Fragment>
        <MarkerLayer>
          {this.props.filePatch.getHunks().map((hunk, index) => {
            const containsSelection = this.props.selectionMode === 'line' && selectedHunks.has(hunk);
            const isSelected = this.props.selectionMode === 'hunk' && selectedHunks.has(hunk);

            let buttonSuffix = '';
            if (containsSelection) {
              buttonSuffix += 'Selected Line';
              if (this.props.selectedRows.size > 1) {
                buttonSuffix += 's';
              }
            } else {
              buttonSuffix += 'Hunk';
              if (selectedHunks.size > 1) {
                buttonSuffix += 's';
              }
            }

            const toggleSelectionLabel = `${toggleVerb} ${buttonSuffix}`;
            const discardSelectionLabel = `Discard ${buttonSuffix}`;

            const startPoint = hunk.getRange().start;
            const startRange = new Range(startPoint, startPoint);

            return (
              <Marker key={`hunkHeader-${index}`} bufferRange={startRange} invalidate="never">
                <Decoration type="block">
                  <HunkHeaderView
                    refTarget={this.refEditorElement}
                    hunk={hunk}
                    isSelected={isSelected}
                    stagingStatus={this.props.stagingStatus}
                    selectionMode="line"
                    toggleSelectionLabel={toggleSelectionLabel}
                    discardSelectionLabel={discardSelectionLabel}

                    tooltips={this.props.tooltips}
                    keymaps={this.props.keymaps}

                    toggleSelection={() => this.toggleHunkSelection(hunk, containsSelection)}
                    discardSelection={() => this.discardHunkSelection(hunk, containsSelection)}
                    mouseDown={this.didMouseDownOnHeader}
                  />
                </Decoration>
              </Marker>
            );
          })}
        </MarkerLayer>
      </Fragment>
    );
  }

  renderLineDecorations(ranges, lineClass, {line, gutter, refHolder}) {
    if (ranges.length === 0) {
      return null;
    }

    const holder = refHolder || new RefHolder();
    return (
      <MarkerLayer handleLayer={holder.setter}>
        {ranges.map((range, index) => {
          return (
            <Marker
              key={`line-${lineClass}-${index}`}
              bufferRange={range}
              invalidate="never"
            />
          );
        })}
        {this.renderDecorations(lineClass, {line, gutter})}
      </MarkerLayer>
    );
  }

  renderDecorationsOnLayer(layer, lineClass, {line, gutter}) {
    if (layer.getMarkerCount() === 0) {
      return null;
    }

    return (
      <MarkerLayer external={layer}>
        {this.renderDecorations(lineClass, {line, gutter})}
      </MarkerLayer>
    );
  }

  renderDecorations(lineClass, {line, gutter}) {
    return (
      <Fragment>
        {line && (
          <Decoration
            type="line"
            className={lineClass}
            omitEmptyLastRow={false}
          />
        )}
        {gutter && (
          <Fragment>
            <Decoration
              type="line-number"
              gutterName="old-line-numbers"
              className={lineClass}
              omitEmptyLastRow={false}
            />
            <Decoration
              type="line-number"
              gutterName="new-line-numbers"
              className={lineClass}
              omitEmptyLastRow={false}
            />
          </Fragment>
        )}
      </Fragment>
    );
  }

  toggleHunkSelection(hunk, containsSelection) {
    if (containsSelection) {
      return this.props.toggleRows(this.props.selectedRows, this.props.selectionMode);
    } else {
      const changeRows = new Set(
        hunk.getChanges()
          .reduce((rows, change) => {
            rows.push(...change.getBufferRows());
            return rows;
          }, []),
      );
      return this.props.toggleRows(changeRows, 'hunk');
    }
  }

  discardHunkSelection(hunk, containsSelection) {
    if (containsSelection) {
      return this.props.discardRows(this.props.selectedRows, this.props.selectionMode);
    } else {
      const changeRows = new Set(
        hunk.getChanges()
          .reduce((rows, change) => {
            rows.push(...change.getBufferRows());
            return rows;
          }, []),
      );
      return this.props.discardRows(changeRows, 'hunk');
    }
  }

  didMouseDownOnHeader(event, hunk) {
    this.nextSelectionMode = 'hunk';
    this.handleSelectionEvent(event, hunk.getRange());
  }

  didMouseDownOnLineNumber(event) {
    const line = event.bufferRow;
    if (line === undefined || isNaN(line)) {
      return;
    }

    this.nextSelectionMode = 'line';
    if (this.handleSelectionEvent(event.domEvent, [[line, 0], [line, Infinity]])) {
      this.mouseSelectionInProgress = true;
    }
  }

  didMouseMoveOnLineNumber(event) {
    if (!this.mouseSelectionInProgress) {
      return;
    }

    const line = event.bufferRow;
    if (this.lastMouseMoveLine === line || line === undefined || isNaN(line)) {
      return;
    }
    this.lastMouseMoveLine = line;

    this.nextSelectionMode = 'line';
    this.handleSelectionEvent(event.domEvent, [[line, 0], [line, Infinity]], {add: true});
  }

  didMouseUp() {
    this.mouseSelectionInProgress = false;
  }

  handleSelectionEvent(event, rangeLike, opts) {
    if (event.button !== 0) {
      return false;
    }

    const isWindows = process.platform === 'win32';
    if (event.ctrlKey && !isWindows) {
      // Allow the context menu to open.
      return false;
    }

    const options = {
      add: false,
      ...opts,
    };

    // Normalize the target selection range
    const converted = Range.fromObject(rangeLike);
    const range = this.refEditor.map(editor => editor.clipBufferRange(converted)).getOr(converted);

    if (event.metaKey || /* istanbul ignore next */ (event.ctrlKey && isWindows)) {
      this.refEditor.map(editor => {
        let intersects = false;
        let without = null;

        for (const selection of editor.getSelections()) {
          if (selection.intersectsBufferRange(range)) {
            // Remove range from this selection by truncating it to the "near edge" of the range and creating a
            // new selection from the "far edge" to the previous end. Omit either side if it is empty.
            intersects = true;
            const selectionRange = selection.getBufferRange();

            const newRanges = [];

            if (!range.start.isEqual(selectionRange.start)) {
              // Include the bit from the selection's previous start to the range's start.
              let nudged = range.start;
              if (range.start.column === 0) {
                const lastColumn = editor.getBuffer().lineLengthForRow(range.start.row - 1);
                nudged = [range.start.row - 1, lastColumn];
              }

              newRanges.push([selectionRange.start, nudged]);
            }

            if (!range.end.isEqual(selectionRange.end)) {
              // Include the bit from the range's end to the selection's end.
              let nudged = range.end;
              const lastColumn = editor.getBuffer().lineLengthForRow(range.end.row);
              if (range.end.column === lastColumn) {
                nudged = [range.end.row + 1, 0];
              }

              newRanges.push([nudged, selectionRange.end]);
            }

            if (newRanges.length > 0) {
              selection.setBufferRange(newRanges[0]);
              for (const newRange of newRanges.slice(1)) {
                editor.addSelectionForBufferRange(newRange, {reversed: selection.isReversed()});
              }
            } else {
              without = selection;
            }
          }
        }

        if (without !== null) {
          const replacementRanges = editor.getSelections()
            .filter(each => each !== without)
            .map(each => each.getBufferRange());
          if (replacementRanges.length > 0) {
            editor.setSelectedBufferRanges(replacementRanges);
          }
        }

        if (!intersects) {
          // Add this range as a new, distinct selection.
          editor.addSelectionForBufferRange(range);
        }

        return null;
      });
    } else if (options.add || event.shiftKey) {
      // Extend the existing selection to encompass this range.
      this.refEditor.map(editor => {
        const lastSelection = editor.getLastSelection();
        const lastSelectionRange = lastSelection.getBufferRange();

        // You are now entering the wall of ternery operators. This is your last exit before the tollbooth
        const isBefore = range.start.isLessThan(lastSelectionRange.start);
        const farEdge = isBefore ? range.start : range.end;
        const newRange = isBefore ? [farEdge, lastSelectionRange.end] : [lastSelectionRange.start, farEdge];

        lastSelection.setBufferRange(newRange, {reversed: isBefore});
        return null;
      });
    } else {
      this.refEditor.map(editor => editor.setSelectedBufferRange(range));
    }

    return true;
  }

  didConfirm() {
    return this.props.toggleRows(this.props.selectedRows, this.props.selectionMode);
  }

  didDiscardSelection() {
    return this.props.discardRows(this.props.selectedRows, this.props.selectionMode);
  }

  didToggleSelectionMode() {
    const selectedHunks = this.getSelectedHunks();
    this.withSelectionMode({
      line: () => {
        const hunkRanges = selectedHunks.map(hunk => hunk.getRange());
        this.nextSelectionMode = 'hunk';
        this.refEditor.map(editor => editor.setSelectedBufferRanges(hunkRanges));
      },
      hunk: () => {
        let firstChangeRow = Infinity;
        for (const hunk of selectedHunks) {
          const [firstChange] = hunk.getChanges();
          if (firstChange && (!firstChangeRow || firstChange.getStartBufferRow() < firstChangeRow)) {
            firstChangeRow = firstChange.getStartBufferRow();
          }
        }

        this.nextSelectionMode = 'line';
        this.refEditor.map(editor => {
          editor.setSelectedBufferRanges([[[firstChangeRow, 0], [firstChangeRow, Infinity]]]);
          return null;
        });
      },
    });
  }

  selectNextHunk() {
    this.refEditor.map(editor => {
      const nextHunks = new Set(
        this.withSelectedHunks(hunk => this.getHunkAfter(hunk) || hunk),
      );
      const nextRanges = Array.from(nextHunks, hunk => hunk.getRange());
      this.nextSelectionMode = 'hunk';
      editor.setSelectedBufferRanges(nextRanges);
      return null;
    });
  }

  selectPreviousHunk() {
    this.refEditor.map(editor => {
      const nextHunks = new Set(
        this.withSelectedHunks(hunk => this.getHunkBefore(hunk) || hunk),
      );
      const nextRanges = Array.from(nextHunks, hunk => hunk.getRange());
      this.nextSelectionMode = 'hunk';
      editor.setSelectedBufferRanges(nextRanges);
      return null;
    });
  }

  hunkSelectDown() {
    this.refEditor.map(editor => {
      return null;
    });
  }

  hunkSelectUp() {
    this.refEditor.map(editor => {
      return null;
    });
  }

  didOpenFile() {
    const cursors = [];

    this.refEditor.map(editor => {
      const placedRows = new Set();

      for (const cursor of editor.getCursors()) {
        const cursorRow = cursor.getBufferPosition().row;
        const hunk = this.props.filePatch.getHunkAt(cursorRow);
        /* istanbul ignore next */
        if (!hunk) {
          continue;
        }

        let newRow = hunk.getNewRowAt(cursorRow);
        let newColumn = cursor.getBufferPosition().column;
        if (newRow === null) {
          let nearestRow = hunk.getNewStartRow() - 1;
          for (const region of hunk.getRegions()) {
            if (!region.includesBufferRow(cursorRow)) {
              region.when({
                unchanged: () => {
                  nearestRow += region.bufferRowCount();
                },
                addition: () => {
                  nearestRow += region.bufferRowCount();
                },
              });
            } else {
              break;
            }
          }

          if (!placedRows.has(nearestRow)) {
            newRow = nearestRow;
            newColumn = 0;
            placedRows.add(nearestRow);
          }
        }

        if (newRow !== null) {
          cursors.push([newRow, newColumn]);
        }
      }

      return null;
    });

    this.props.openFile(cursors);
  }

  getSelectedRows() {
    return this.refEditor.map(editor => {
      return new Set(
        editor.getSelections()
          .map(selection => selection.getBufferRange())
          .reduce((acc, range) => {
            for (const row of range.getRows()) {
              if (this.isChangeRow(row)) {
                acc.push(row);
              }
            }
            return acc;
          }, []),
      );
    }).getOr(new Set());
  }

  didAddSelection() {
    this.didChangeSelectedRows();
  }

  didChangeSelectionRange(event) {
    if (
      !event ||
      event.oldBufferRange.start.row !== event.newBufferRange.start.row ||
      event.oldBufferRange.end.row !== event.newBufferRange.end.row
    ) {
      this.didChangeSelectedRows();
    }
  }

  didDestroySelection() {
    this.didChangeSelectedRows();
  }

  didChangeSelectedRows() {
    if (this.suppressChanges) {
      return;
    }
    this.props.selectedRowsChanged(this.getSelectedRows(), this.nextSelectionMode || 'line');
  }

  oldLineNumberLabel({bufferRow, softWrapped}) {
    const hunk = this.props.filePatch.getHunkAt(bufferRow);
    if (hunk === undefined) {
      return this.pad('');
    }

    const oldRow = hunk.getOldRowAt(bufferRow);
    if (softWrapped) {
      return this.pad(oldRow === null ? '' : '•');
    }

    return this.pad(oldRow);
  }

  newLineNumberLabel({bufferRow, softWrapped}) {
    const hunk = this.props.filePatch.getHunkAt(bufferRow);
    if (hunk === undefined) {
      return this.pad('');
    }

    const newRow = hunk.getNewRowAt(bufferRow);
    if (softWrapped) {
      return this.pad(newRow === null ? '' : '•');
    }
    return this.pad(newRow);
  }

  /*
   * Return a Set of the Hunks that include at least one editor selection. The selection need not contain an actual
   * change row.
   */
  getSelectedHunks() {
    return this.withSelectedHunks(each => each);
  }

  withSelectedHunks(callback) {
    return this.refEditor.map(editor => {
      const seen = new Set();
      return editor.getSelectedBufferRanges().reduce((acc, range) => {
        for (const row of range.getRows()) {
          const hunk = this.props.filePatch.getHunkAt(row);
          if (!hunk || seen.has(hunk)) {
            continue;
          }

          seen.add(hunk);
          acc.push(callback(hunk));
        }
        return acc;
      }, []);
    }).getOr([]);
  }

  getHunkBefore(hunk) {
    const prevRow = hunk.getRange().start.row - 1;
    return this.props.filePatch.getHunkAt(prevRow);
  }

  getHunkAfter(hunk) {
    const nextRow = hunk.getRange().end.row + 1;
    return this.props.filePatch.getHunkAt(nextRow);
  }

  isChangeRow(bufferRow) {
    const changeLayers = [this.props.filePatch.getAdditionLayer(), this.props.filePatch.getDeletionLayer()];
    return changeLayers.some(layer => layer.findMarkers({intersectsRow: bufferRow}).length > 0);
  }

  withSelectionMode(callbacks) {
    const callback = callbacks[this.props.selectionMode];
    /* istanbul ignore if */
    if (!callback) {
      throw new Error(`Unknown selection mode: ${this.props.selectionMode}`);
    }
    return callback();
  }

  pad(num) {
    const maxDigits = this.props.filePatch.getMaxLineNumberWidth();
    if (num === null) {
      return NBSP_CHARACTER.repeat(maxDigits);
    } else {
      return NBSP_CHARACTER.repeat(maxDigits - num.toString().length) + num.toString();
    }
  }

}
