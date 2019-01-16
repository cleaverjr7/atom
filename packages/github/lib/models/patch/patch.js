import {TextBuffer, Range} from 'atom';

import Hunk from './hunk';
import {Unchanged, Addition, Deletion, NoNewline} from './region';

export const TOO_LARGE = Symbol('too large');

export const EXPANDED = Symbol('expanded');

export const COLLAPSED = Symbol('collapsed');

export default class Patch {
  static createNull() {
    return new NullPatch();
  }

  static createDelayedPatch(marker, renderStatus, parseFn) {
    return new this({status: null, hunks: [], marker, renderStatus, parseFn});
  }

  constructor({status, hunks, marker, renderStatus, parseFn}) {
    this.status = status;
    this.hunks = hunks;
    this.marker = marker;
    this.renderStatus = renderStatus || EXPANDED;

    this.changedLineCount = this.getHunks().reduce((acc, hunk) => acc + hunk.changedLineCount(), 0);

    if (parseFn) {
      // Override the prototype's method
      this.parseFn = parseFn;
    }
  }

  getStatus() {
    return this.status;
  }

  getMarker() {
    return this.marker;
  }

  getRange() {
    return this.getMarker().getRange();
  }

  getStartRange() {
    const startPoint = this.getMarker().getRange().start;
    return Range.fromObject([startPoint, startPoint]);
  }

  getHunks() {
    return this.hunks;
  }

  getChangedLineCount() {
    return this.changedLineCount;
  }

  containsRow(row) {
    return this.marker.getRange().intersectsRow(row);
  }

  reMarkOn(markable) {
    this.marker = markable.markRange(this.getRange(), {invalidate: 'never', exclusive: false});
  }

  getMaxLineNumberWidth() {
    const lastHunk = this.hunks[this.hunks.length - 1];
    return lastHunk ? lastHunk.getMaxLineNumberWidth() : 0;
  }

  clone(opts = {}) {
    return new this.constructor({
      status: opts.status !== undefined ? opts.status : this.getStatus(),
      hunks: opts.hunks !== undefined ? opts.hunks : this.getHunks(),
      marker: opts.marker !== undefined ? opts.marker : this.getMarker(),
      renderStatus: opts.renderStatus !== undefined ? opts.renderStatus : this.getRenderStatus(),
    });
  }

  collapsed() {
    if (this.getRenderStatus() === COLLAPSED) {
      return this;
    }

    return this.clone({renderStatus: COLLAPSED});
  }

  expanded() {
    if (this.getRenderStatus() === EXPANDED) {
      return this;
    }

    return this.clone({renderStatus: EXPANDED});
  }

  buildStagePatchForLines(originalBuffer, nextLayeredBuffer, rowSet) {
    const originalBaseOffset = this.getMarker().getRange().start.row;
    const builder = new BufferBuilder(originalBuffer, originalBaseOffset, nextLayeredBuffer);
    const hunks = [];

    let newRowDelta = 0;

    for (const hunk of this.getHunks()) {
      let atLeastOneSelectedChange = false;
      let selectedDeletionRowCount = 0;
      let noNewlineRowCount = 0;

      for (const region of hunk.getRegions()) {
        for (const {intersection, gap} of region.intersectRows(rowSet, true)) {
          region.when({
            addition: () => {
              if (gap) {
                // Unselected addition: omit from new buffer
                builder.remove(intersection);
              } else {
                // Selected addition: include in new patch
                atLeastOneSelectedChange = true;
                builder.append(intersection);
                builder.markRegion(intersection, Addition);
              }
            },
            deletion: () => {
              if (gap) {
                // Unselected deletion: convert to context row
                builder.append(intersection);
                builder.markRegion(intersection, Unchanged);
              } else {
                // Selected deletion: include in new patch
                atLeastOneSelectedChange = true;
                builder.append(intersection);
                builder.markRegion(intersection, Deletion);
                selectedDeletionRowCount += intersection.getRowCount();
              }
            },
            unchanged: () => {
              // Untouched context line: include in new patch
              builder.append(intersection);
              builder.markRegion(intersection, Unchanged);
            },
            nonewline: () => {
              builder.append(intersection);
              builder.markRegion(intersection, NoNewline);
              noNewlineRowCount += intersection.getRowCount();
            },
          });
        }
      }

      if (atLeastOneSelectedChange) {
        // Hunk contains at least one selected line

        builder.markHunkRange(hunk.getRange());
        const {regions, marker} = builder.latestHunkWasIncluded();
        const newStartRow = hunk.getNewStartRow() + newRowDelta;
        const newRowCount = marker.getRange().getRowCount() - selectedDeletionRowCount - noNewlineRowCount;

        hunks.push(new Hunk({
          oldStartRow: hunk.getOldStartRow(),
          oldRowCount: hunk.getOldRowCount(),
          newStartRow,
          newRowCount,
          sectionHeading: hunk.getSectionHeading(),
          marker,
          regions,
        }));

        newRowDelta += newRowCount - hunk.getNewRowCount();
      } else {
        newRowDelta += hunk.getOldRowCount() - hunk.getNewRowCount();

        builder.latestHunkWasDiscarded();
      }
    }

    const buffer = builder.getBuffer();
    const layers = builder.getLayers();
    const marker = layers.patch.markRange([[0, 0], [buffer.getLastRow() - 1, Infinity]]);

    const wholeFile = rowSet.size === this.changedLineCount;
    const status = this.getStatus() === 'deleted' && !wholeFile ? 'modified' : this.getStatus();
    return this.clone({hunks, status, marker});
  }

  buildUnstagePatchForLines(originalBuffer, nextLayeredBuffer, rowSet) {
    const originalBaseOffset = this.getMarker().getRange().start.row;
    const builder = new BufferBuilder(originalBuffer, originalBaseOffset, nextLayeredBuffer);
    const hunks = [];
    let newRowDelta = 0;

    for (const hunk of this.getHunks()) {
      let atLeastOneSelectedChange = false;
      let contextRowCount = 0;
      let additionRowCount = 0;
      let deletionRowCount = 0;

      for (const region of hunk.getRegions()) {
        for (const {intersection, gap} of region.intersectRows(rowSet, true)) {
          region.when({
            addition: () => {
              if (gap) {
                // Unselected addition: become a context line.
                builder.append(intersection);
                builder.markRegion(intersection, Unchanged);
                contextRowCount += intersection.getRowCount();
              } else {
                // Selected addition: become a deletion.
                atLeastOneSelectedChange = true;
                builder.append(intersection);
                builder.markRegion(intersection, Deletion);
                deletionRowCount += intersection.getRowCount();
              }
            },
            deletion: () => {
              if (gap) {
                // Non-selected deletion: omit from new buffer.
                builder.remove(intersection);
              } else {
                // Selected deletion: becomes an addition
                atLeastOneSelectedChange = true;
                builder.append(intersection);
                builder.markRegion(intersection, Addition);
                additionRowCount += intersection.getRowCount();
              }
            },
            unchanged: () => {
              // Untouched context line: include in new patch.
              builder.append(intersection);
              builder.markRegion(intersection, Unchanged);
              contextRowCount += intersection.getRowCount();
            },
            nonewline: () => {
              // Nonewline marker: include in new patch.
              builder.append(intersection);
              builder.markRegion(intersection, NoNewline);
            },
          });
        }
      }

      if (atLeastOneSelectedChange) {
        // Hunk contains at least one selected line

        builder.markHunkRange(hunk.getRange());
        const {marker, regions} = builder.latestHunkWasIncluded();
        hunks.push(new Hunk({
          oldStartRow: hunk.getNewStartRow(),
          oldRowCount: contextRowCount + deletionRowCount,
          newStartRow: hunk.getNewStartRow() + newRowDelta,
          newRowCount: contextRowCount + additionRowCount,
          sectionHeading: hunk.getSectionHeading(),
          marker,
          regions,
        }));
      } else {
        builder.latestHunkWasDiscarded();
      }

      // (contextRowCount + additionRowCount) - (contextRowCount + deletionRowCount)
      newRowDelta += additionRowCount - deletionRowCount;
    }

    const wholeFile = rowSet.size === this.changedLineCount;
    let status = this.getStatus();
    if (this.getStatus() === 'added') {
      status = wholeFile ? 'deleted' : 'modified';
    } else if (this.getStatus() === 'deleted') {
      status = 'added';
    }

    const buffer = builder.getBuffer();
    const layers = builder.getLayers();
    const marker = layers.patch.markRange([[0, 0], [buffer.getLastRow(), Infinity]]);

    return this.clone({hunks, status, marker});
  }

  getFirstChangeRange() {
    const firstHunk = this.getHunks()[0];
    if (!firstHunk) {
      return Range.fromObject([[0, 0], [0, 0]]);
    }

    const firstChange = firstHunk.getChanges()[0];
    if (!firstChange) {
      return Range.fromObject([[0, 0], [0, 0]]);
    }

    const firstRow = firstChange.getStartBufferRow();
    return Range.fromObject([[firstRow, 0], [firstRow, Infinity]]);
  }

  toStringIn(buffer) {
    return this.getHunks().reduce((str, hunk) => str + hunk.toStringIn(buffer), '');
  }

  isPresent() {
    return true;
  }

  getRenderStatus() {
    return this.renderStatus;
  }

  parseFn() {
    return this;
  }
}

class NullPatch {
  constructor() {
    const buffer = new TextBuffer();
    this.marker = buffer.markRange([[0, 0], [0, 0]]);
  }

  getStatus() {
    return null;
  }

  getMarker() {
    return this.marker;
  }

  getRange() {
    return this.getMarker().getRange();
  }

  getStartRange() {
    return Range.fromObject([[0, 0], [0, 0]]);
  }

  getHunks() {
    return [];
  }

  getChangedLineCount() {
    return 0;
  }

  containsRow() {
    return false;
  }

  reMarkOn(markable) {
    this.marker = markable.markRange(this.getRange(), {invalidate: 'never', exclusive: false});
  }

  getMaxLineNumberWidth() {
    return 0;
  }

  clone(opts = {}) {
    if (
      opts.status === undefined &&
      opts.hunks === undefined &&
      opts.marker === undefined &&
      opts.renderStatus === undefined
    ) {
      return this;
    } else {
      return new Patch({
        status: opts.status !== undefined ? opts.status : this.getStatus(),
        hunks: opts.hunks !== undefined ? opts.hunks : this.getHunks(),
        marker: opts.marker !== undefined ? opts.marker : this.getMarker(),
        renderStatus: opts.renderStatus !== undefined ? opts.renderStatus : this.getRenderStatus(),
      });
    }
  }

  buildStagePatchForLines() {
    return this;
  }

  buildUnstagePatchForLines() {
    return this;
  }

  getFirstChangeRange() {
    return Range.fromObject([[0, 0], [0, 0]]);
  }

  toStringIn() {
    return '';
  }

  isPresent() {
    return false;
  }

  getRenderStatus() {
    return EXPANDED;
  }

  parseFn() {
    return this;
  }
}

class BufferBuilder {
  constructor(original, originalBaseOffset, nextLayeredBuffer) {
    this.originalBuffer = original;

    this.buffer = nextLayeredBuffer.buffer;
    this.layers = new Map([
      [Unchanged, nextLayeredBuffer.layers.unchanged],
      [Addition, nextLayeredBuffer.layers.addition],
      [Deletion, nextLayeredBuffer.layers.deletion],
      [NoNewline, nextLayeredBuffer.layers.noNewline],
      ['hunk', nextLayeredBuffer.layers.hunk],
      ['patch', nextLayeredBuffer.layers.patch],
    ]);

    // The ranges provided to builder methods are expected to be valid within the original buffer. Account for
    // the position of the Patch within its original TextBuffer, and any existing content already on the next
    // TextBuffer.
    this.offset = this.buffer.getLastRow() - originalBaseOffset;

    this.hunkBufferText = '';
    this.hunkRowCount = 0;
    this.hunkStartOffset = this.offset;
    this.hunkRegions = [];
    this.hunkRange = null;

    this.lastOffset = 0;
  }

  append(range) {
    this.hunkBufferText += this.originalBuffer.getTextInRange(range) + '\n';
    this.hunkRowCount += range.getRowCount();
  }

  remove(range) {
    this.offset -= range.getRowCount();
  }

  markRegion(range, RegionKind) {
    const finalRange = this.offset !== 0
      ? range.translate([this.offset, 0], [this.offset, 0])
      : range;

    // Collapse consecutive ranges of the same RegionKind into one continuous region.
    const lastRegion = this.hunkRegions[this.hunkRegions.length - 1];
    if (lastRegion && lastRegion.RegionKind === RegionKind && finalRange.start.row - lastRegion.range.end.row === 1) {
      lastRegion.range.end = finalRange.end;
    } else {
      this.hunkRegions.push({RegionKind, range: finalRange});
    }
  }

  markHunkRange(range) {
    let finalRange = range;
    if (this.hunkStartOffset !== 0 || this.offset !== 0) {
      finalRange = finalRange.translate([this.hunkStartOffset, 0], [this.offset, 0]);
    }
    this.hunkRange = finalRange;
  }

  latestHunkWasIncluded() {
    this.buffer.append(this.hunkBufferText, {normalizeLineEndings: false});

    const regions = this.hunkRegions.map(({RegionKind, range}) => {
      return new RegionKind(
        this.layers.get(RegionKind).markRange(range, {invalidate: 'never', exclusive: false}),
      );
    });

    const marker = this.layers.get('hunk').markRange(this.hunkRange, {invalidate: 'never', exclusive: false});

    this.hunkBufferText = '';
    this.hunkRowCount = 0;
    this.hunkStartOffset = this.offset;
    this.hunkRegions = [];
    this.hunkRange = null;

    return {regions, marker};
  }

  latestHunkWasDiscarded() {
    this.offset -= this.hunkRowCount;

    this.hunkBufferText = '';
    this.hunkRowCount = 0;
    this.hunkStartOffset = this.offset;
    this.hunkRegions = [];
    this.hunkRange = null;

    return {regions: [], marker: null};
  }

  getBuffer() {
    return this.buffer;
  }

  getLayers() {
    return {
      patch: this.layers.get('patch'),
      hunk: this.layers.get('hunk'),
      unchanged: this.layers.get(Unchanged),
      addition: this.layers.get(Addition),
      deletion: this.layers.get(Deletion),
      noNewline: this.layers.get(NoNewline),
    };
  }
}
