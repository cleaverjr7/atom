import Hunk from '../../../lib/models/patch/hunk';
import IndexedRowRange, {nullIndexedRowRange} from '../../../lib/models/indexed-row-range';

describe('Hunk', function() {
  const attrs = {
    oldStartRow: 0,
    newStartRow: 0,
    oldRowCount: 0,
    newRowCount: 0,
    sectionHeading: 'sectionHeading',
    rowRange: new IndexedRowRange({
      bufferRange: [[1, 0], [10, 0]],
      startOffset: 5,
      endOffset: 100,
    }),
    additions: [
      new IndexedRowRange({bufferRange: [[1, 0], [2, 0]], startOffset: 6, endOffset: 7}),
    ],
    deletions: [
      new IndexedRowRange({bufferRange: [[3, 0], [4, 0]], startOffset: 8, endOffset: 9}),
      new IndexedRowRange({bufferRange: [[5, 0], [6, 0]], startOffset: 10, endOffset: 11}),
    ],
    noNewline: nullIndexedRowRange,
  };

  it('has some basic accessors', function() {
    const h = new Hunk({
      oldStartRow: 0,
      newStartRow: 1,
      oldRowCount: 2,
      newRowCount: 3,
      sectionHeading: 'sectionHeading',
      rowRange: new IndexedRowRange({
        bufferRange: [[0, 0], [10, 0]],
        startOffset: 0,
        endOffset: 100,
      }),
      additions: [
        new IndexedRowRange({bufferRange: [[1, 0], [2, 0]], startOffset: 6, endOffset: 7}),
      ],
      deletions: [
        new IndexedRowRange({bufferRange: [[3, 0], [4, 0]], startOffset: 8, endOffset: 9}),
        new IndexedRowRange({bufferRange: [[5, 0], [6, 0]], startOffset: 10, endOffset: 11}),
      ],
      noNewline: nullIndexedRowRange,
    });

    assert.strictEqual(h.getOldStartRow(), 0);
    assert.strictEqual(h.getNewStartRow(), 1);
    assert.strictEqual(h.getOldRowCount(), 2);
    assert.strictEqual(h.getNewRowCount(), 3);
    assert.strictEqual(h.getSectionHeading(), 'sectionHeading');
    assert.lengthOf(h.getAdditions(), 1);
    assert.lengthOf(h.getDeletions(), 2);
    assert.isFalse(h.getNoNewline().isPresent());
  });

  it('creates its start range for decoration placement', function() {
    const h = new Hunk({
      ...attrs,
      rowRange: new IndexedRowRange({
        bufferRange: [[3, 0], [6, 0]],
        startOffset: 15,
        endOffset: 35,
      }),
    });

    assert.deepEqual(h.getStartRange().serialize(), [[3, 0], [3, 0]]);
  });

  it('generates a patch section header', function() {
    const h = new Hunk({
      ...attrs,
      oldStartRow: 0,
      newStartRow: 1,
      oldRowCount: 2,
      newRowCount: 3,
    });

    assert.strictEqual(h.getHeader(), '@@ -0,2 +1,3 @@');
  });

  it('returns a set of covered buffer rows', function() {
    const h = new Hunk({
      ...attrs,
      rowRange: new IndexedRowRange({
        bufferRange: [[6, 0], [10, 0]],
        startOffset: 30,
        endOffset: 55,
      }),
    });
    assert.sameMembers(Array.from(h.getBufferRows()), [6, 7, 8, 9, 10]);
  });

  it('computes the total number of changed lines', function() {
    const h0 = new Hunk({
      ...attrs,
      additions: [
        new IndexedRowRange({bufferRange: [[2, 0], [4, 0]], startOffset: 0, endOffset: 0}),
        new IndexedRowRange({bufferRange: [[6, 0], [6, 0]], startOffset: 0, endOffset: 0}),
      ],
      deletions: [
        new IndexedRowRange({bufferRange: [[7, 0], [10, 0]], startOffset: 0, endOffset: 0}),
      ],
      noNewline: new IndexedRowRange({bufferRange: [[12, 0], [12, 0]], startOffset: 0, endOffset: 0}),
    });
    assert.strictEqual(h0.changedLineCount(), 9);

    const h1 = new Hunk({
      ...attrs,
      additions: [],
      deletions: [],
      noNewline: nullIndexedRowRange,
    });
    assert.strictEqual(h1.changedLineCount(), 0);
  });

  it('computes an inverted hunk', function() {
    const original = new Hunk({
      ...attrs,
      oldStartRow: 0,
      newStartRow: 1,
      oldRowCount: 2,
      newRowCount: 3,
      sectionHeading: 'the-heading',
      additions: [
        new IndexedRowRange({bufferRange: [[2, 0], [4, 0]], startOffset: 0, endOffset: 0}),
        new IndexedRowRange({bufferRange: [[6, 0], [6, 0]], startOffset: 0, endOffset: 0}),
      ],
      deletions: [
        new IndexedRowRange({bufferRange: [[7, 0], [10, 0]], startOffset: 0, endOffset: 0}),
      ],
      noNewline: new IndexedRowRange({bufferRange: [[12, 0], [12, 0]], startOffset: 0, endOffset: 0}),
    });

    const inverted = original.invert();
    assert.strictEqual(inverted.getOldStartRow(), 1);
    assert.strictEqual(inverted.getNewStartRow(), 0);
    assert.strictEqual(inverted.getOldRowCount(), 3);
    assert.strictEqual(inverted.getNewRowCount(), 2);
    assert.strictEqual(inverted.getSectionHeading(), 'the-heading');
    assert.lengthOf(inverted.additions, 1);
    assert.lengthOf(inverted.deletions, 2);
    assert.isTrue(inverted.noNewline.isPresent());
  });

  describe('toStringIn()', function() {
    it('prints its header', function() {
      const h = new Hunk({
        ...attrs,
        oldStartRow: 0,
        newStartRow: 1,
        oldRowCount: 2,
        newRowCount: 3,
        additions: [],
        deletions: [],
        noNewline: nullIndexedRowRange,
      });

      assert.strictEqual(h.toStringIn(''), '@@ -0,2 +1,3 @@\n');
    });

    it('renders changed and unchanged lines with the appropriate origin characters', function() {
      const buffer =
        '0000\n0111\n0222\n0333\n0444\n0555\n0666\n0777\n0888\n0999\n' +
        '1000\n1111\n1222\n' +
        'No newline at end of file\n';
      // 0000.0111.0222.0333.0444.0555.0666.0777.0888.0999.1000.1111.1222.No newline at end of file.

      const h = new Hunk({
        ...attrs,
        oldStartRow: 1,
        newStartRow: 1,
        oldRowCount: 6,
        newRowCount: 6,
        rowRange: new IndexedRowRange({
          bufferRange: [[1, 0], [13, 0]],
          startOffset: 5,
          endOffset: 91,
        }),
        additions: [
          new IndexedRowRange({bufferRange: [[2, 0], [3, 0]], startOffset: 10, endOffset: 20}),
          new IndexedRowRange({bufferRange: [[7, 0], [7, 0]], startOffset: 35, endOffset: 40}),
          new IndexedRowRange({bufferRange: [[10, 0], [10, 0]], startOffset: 50, endOffset: 55}),
        ],
        deletions: [
          new IndexedRowRange({bufferRange: [[5, 0], [5, 0]], startOffset: 25, endOffset: 30}),
          new IndexedRowRange({bufferRange: [[8, 0], [9, 0]], startOffset: 40, endOffset: 50}),
        ],
        noNewline: new IndexedRowRange({bufferRange: [[13, 0], [13, 0]], startOffset: 65, endOffset: 91}),
      });

      assert.strictEqual(h.toStringIn(buffer), [
        '@@ -1,6 +1,6 @@\n',
        ' 0111\n',
        '+0222\n',
        '+0333\n',
        ' 0444\n',
        '-0555\n',
        ' 0666\n',
        '+0777\n',
        '-0888\n',
        '-0999\n',
        '+1000\n',
        ' 1111\n',
        ' 1222\n',
        '\\No newline at end of file\n',
      ].join(''));
    });

    it('renders a hunk without a nonewline', function() {
      const buffer = '0000\n1111\n2222\n3333\n';

      const h = new Hunk({
        ...attrs,
        oldStartRow: 1,
        newStartRow: 1,
        oldRowCount: 1,
        newRowCount: 1,
        rowRange: new IndexedRowRange({bufferRange: [[0, 0], [3, 0]], startOffset: 0, endOffset: 20}),
        additions: [
          new IndexedRowRange({bufferRange: [[1, 0], [1, 0]], startOffset: 5, endOffset: 10}),
        ],
        deletions: [
          new IndexedRowRange({bufferRange: [[2, 0], [2, 0]], startOffset: 10, endOffset: 15}),
        ],
        noNewline: nullIndexedRowRange,
      });

      assert.strictEqual(h.toStringIn(buffer), [
        '@@ -1,1 +1,1 @@\n',
        ' 0000\n',
        '+1111\n',
        '-2222\n',
        ' 3333\n',
      ].join(''));
    });
  });
});
