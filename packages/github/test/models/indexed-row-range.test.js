import IndexedRowRange, {nullIndexedRowRange} from '../../lib/models/indexed-row-range';

describe('IndexedRowRange', function() {
  it('computes its row count', function() {
    const range = new IndexedRowRange({
      bufferRange: [[0, 0], [1, 0]],
      startOffset: 0,
      endOffset: 10,
    });
    assert.isTrue(range.isPresent());
    assert.deepEqual(range.bufferRowCount(), 2);
  });

  it('returns an array of the covered rows', function() {
    const range = new IndexedRowRange({
      bufferRange: [[2, 0], [8, 0]],
      startOffset: 0,
      endOffset: 10,
    });
    assert.sameMembers(range.getBufferRows(), [2, 3, 4, 5, 6, 7, 8]);
  });

  it('creates a Range from its first line', function() {
    const range = new IndexedRowRange({
      bufferRange: [[2, 0], [8, 0]],
      startOffset: 0,
      endOffset: 10,
    });
    assert.deepEqual(range.getStartRange().serialize(), [[2, 0], [2, 0]]);
  });

  it('extracts its offset range from buffer text with toStringIn()', function() {
    const buffer = '0000\n1111\n2222\n3333\n4444\n5555\n';
    const range = new IndexedRowRange({
      bufferRange: [[1, 0], [2, 0]],
      startOffset: 5,
      endOffset: 25,
    });

    assert.strictEqual(range.toStringIn(buffer, '+'), '+1111\n+2222\n+3333\n+4444\n');
    assert.strictEqual(range.toStringIn(buffer, '-'), '-1111\n-2222\n-3333\n-4444\n');
  });

  describe('intersectRowsIn()', function() {
    const buffer = '0000\n1111\n2222\n3333\n4444\n5555\n6666\n7777\n8888\n9999\n';
    // 0000.1111.2222.3333.4444.5555.6666.7777.8888.9999.

    function assertIntersections(actual, expected) {
      const serialized = actual.map(({intersection, gap}) => ({intersection: intersection.serialize(), gap}));
      assert.deepEqual(serialized, expected);
    }

    it('returns an array containing all gaps with no intersection rows', function() {
      const range = new IndexedRowRange({
        bufferRange: [[1, 0], [3, 0]],
        startOffset: 5,
        endOffset: 20,
      });

      assertIntersections(range.intersectRowsIn(new Set([0, 5, 6]), buffer, false), []);
      assertIntersections(range.intersectRowsIn(new Set([0, 5, 6]), buffer, true), [
        {intersection: {bufferRange: [[1, 0], [3, 0]], startOffset: 5, endOffset: 20}, gap: true},
      ]);
    });

    it('detects an intersection at the beginning of the range', function() {
      const range = new IndexedRowRange({
        bufferRange: [[2, 0], [6, 0]],
        startOffset: 10,
        endOffset: 35,
      });
      const rowSet = new Set([0, 1, 2, 3]);

      assertIntersections(range.intersectRowsIn(rowSet, buffer, false), [
        {intersection: {bufferRange: [[2, 0], [3, 0]], startOffset: 10, endOffset: 20}, gap: false},
      ]);
      assertIntersections(range.intersectRowsIn(rowSet, buffer, true), [
        {intersection: {bufferRange: [[2, 0], [3, 0]], startOffset: 10, endOffset: 20}, gap: false},
        {intersection: {bufferRange: [[4, 0], [6, 0]], startOffset: 20, endOffset: 35}, gap: true},
      ]);
    });

    it('detects an intersection in the middle of the range', function() {
      const range = new IndexedRowRange({
        bufferRange: [[2, 0], [6, 0]],
        startOffset: 10,
        endOffset: 35,
      });
      const rowSet = new Set([0, 3, 4, 8, 9]);

      assertIntersections(range.intersectRowsIn(rowSet, buffer, false), [
        {intersection: {bufferRange: [[3, 0], [4, 0]], startOffset: 15, endOffset: 25}, gap: false},
      ]);
      assertIntersections(range.intersectRowsIn(rowSet, buffer, true), [
        {intersection: {bufferRange: [[2, 0], [2, 0]], startOffset: 10, endOffset: 15}, gap: true},
        {intersection: {bufferRange: [[3, 0], [4, 0]], startOffset: 15, endOffset: 25}, gap: false},
        {intersection: {bufferRange: [[5, 0], [6, 0]], startOffset: 25, endOffset: 35}, gap: true},
      ]);
    });

    it('detects an intersection at the end of the range', function() {
      const range = new IndexedRowRange({
        bufferRange: [[2, 0], [6, 0]],
        startOffset: 10,
        endOffset: 35,
      });
      const rowSet = new Set([4, 5, 6, 7, 10, 11]);

      assertIntersections(range.intersectRowsIn(rowSet, buffer, false), [
        {intersection: {bufferRange: [[4, 0], [6, 0]], startOffset: 20, endOffset: 35}, gap: false},
      ]);
      assertIntersections(range.intersectRowsIn(rowSet, buffer, true), [
        {intersection: {bufferRange: [[2, 0], [3, 0]], startOffset: 10, endOffset: 20}, gap: true},
        {intersection: {bufferRange: [[4, 0], [6, 0]], startOffset: 20, endOffset: 35}, gap: false},
      ]);
    });

    it('detects multiple intersections', function() {
      const range = new IndexedRowRange({
        bufferRange: [[2, 0], [8, 0]],
        startOffset: 10,
        endOffset: 45,
      });
      const rowSet = new Set([0, 3, 4, 6, 7, 10]);

      assertIntersections(range.intersectRowsIn(rowSet, buffer, false), [
        {intersection: {bufferRange: [[3, 0], [4, 0]], startOffset: 15, endOffset: 25}, gap: false},
        {intersection: {bufferRange: [[6, 0], [7, 0]], startOffset: 30, endOffset: 40}, gap: false},
      ]);
      assertIntersections(range.intersectRowsIn(rowSet, buffer, true), [
        {intersection: {bufferRange: [[2, 0], [2, 0]], startOffset: 10, endOffset: 15}, gap: true},
        {intersection: {bufferRange: [[3, 0], [4, 0]], startOffset: 15, endOffset: 25}, gap: false},
        {intersection: {bufferRange: [[5, 0], [5, 0]], startOffset: 25, endOffset: 30}, gap: true},
        {intersection: {bufferRange: [[6, 0], [7, 0]], startOffset: 30, endOffset: 40}, gap: false},
        {intersection: {bufferRange: [[8, 0], [8, 0]], startOffset: 40, endOffset: 45}, gap: true},
      ]);
    });

    it('returns an empty array for the null range', function() {
      assertIntersections(nullIndexedRowRange.intersectRowsIn(new Set([1, 2, 3]), buffer, true), []);
      assertIntersections(nullIndexedRowRange.intersectRowsIn(new Set([1, 2, 3]), buffer, false), []);
    });
  });

  describe('offsetBy()', function() {
    it('returns the receiver as-is when there is no change');

    it('modifies the buffer range and the buffer offset');
  });

  it('returns appropriate values from nullIndexedRowRange methods', function() {
    assert.deepEqual(nullIndexedRowRange.intersectRowsIn(new Set([0, 1, 2]), ''), []);
    assert.strictEqual(nullIndexedRowRange.toStringIn('', '+'), '');
    assert.strictEqual(nullIndexedRowRange.bufferRowCount(), 0);
    assert.isFalse(nullIndexedRowRange.isPresent());
  });
});
