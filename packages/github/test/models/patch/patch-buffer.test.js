import dedent from 'dedent-js';

import PatchBuffer from '../../../lib/models/patch/patch-buffer';

describe('PatchBuffer', function() {
  let patchBuffer;

  beforeEach(function() {
    patchBuffer = new PatchBuffer();
    patchBuffer.getBuffer().setText(TEXT);
  });

  it('has simple accessors', function() {
    assert.strictEqual(patchBuffer.getBuffer().getText(), TEXT);
    assert.deepEqual(patchBuffer.getInsertionPoint().serialize(), [10, 0]);
  });

  it('creates and finds markers on specified layers', function() {
    const patchMarker = patchBuffer.markRange('patch', [[1, 0], [2, 4]]);
    const hunkMarker = patchBuffer.markRange('hunk', [[2, 0], [3, 4]]);

    assert.deepEqual(patchBuffer.findMarkers('patch', {}), [patchMarker]);
    assert.deepEqual(patchBuffer.findMarkers('hunk', {}), [hunkMarker]);
  });

  it('clears markers from all layers at once', function() {
    patchBuffer.markRange('patch', [[0, 0], [0, 4]]);
    patchBuffer.markPosition('hunk', [0, 1]);

    patchBuffer.clearAllLayers();

    assert.lengthOf(patchBuffer.findMarkers('patch', {}), 0);
    assert.lengthOf(patchBuffer.findMarkers('hunk', {}), 0);
  });

  it('extracts a subset of the buffer and layers as a new LayeredBuffer', function() {
    patchBuffer.markRange('patch', [[1, 0], [3, 0]]); // before
    patchBuffer.markRange('hunk', [[2, 0], [4, 0]]); // before, ending at the extraction point
    patchBuffer.markRange('hunk', [[4, 0], [5, 0]]); // within
    patchBuffer.markRange('patch', [[6, 0], [7, 0]]); // within
    patchBuffer.markRange('hunk', [[7, 0], [9, 0]]); // after, starting at the extraction point
    patchBuffer.markRange('patch', [[8, 0], [10, 0]]); // after

    const subPatchBuffer = patchBuffer.extract([[4, 0], [7, 0]]);

    assert.strictEqual(patchBuffer.getBuffer().getText(), dedent`
      0000
      0001
      0002
      0003
      0007
      0008
      0009

    `);
    assert.deepEqual(
      patchBuffer.findMarkers('patch', {}).map(m => m.getRange().serialize()),
      [[[1, 0], [3, 0]], [[5, 0], [7, 0]]],
    );
    assert.deepEqual(
      patchBuffer.findMarkers('hunk', {}).map(m => m.getRange().serialize()),
      [[[2, 0], [4, 0]], [[4, 0], [6, 0]]],
    );

    assert.strictEqual(subPatchBuffer.getBuffer().getText(), dedent`
      0004
      0005
      0006

    `);
    assert.deepEqual(
      subPatchBuffer.findMarkers('hunk', {}).map(m => m.getRange().serialize()),
      [[[0, 0], [1, 0]]],
    );
    assert.deepEqual(
      subPatchBuffer.findMarkers('patch', {}).map(m => m.getRange().serialize()),
      [[[2, 0], [3, 0]]],
    );
  });

  describe('deferred-marking modifications', function() {
    it('performs multiple modifications and only creates markers at the end', function() {
      const modifier = patchBuffer.createModifierAtEnd();
      const cb0 = sinon.spy();
      const cb1 = sinon.spy();

      modifier.append('0010\n');
      modifier.appendMarked('0011\n', 'patch', {invalidate: 'never', callback: cb0});
      modifier.append('0012\n');
      modifier.appendMarked('0013\n0014\n', 'hunk', {invalidate: 'surround', callback: cb1});

      assert.strictEqual(patchBuffer.getBuffer().getText(), dedent`
        ${TEXT}0010
        0011
        0012
        0013
        0014

      `);

      assert.isFalse(cb0.called);
      assert.isFalse(cb1.called);
      assert.lengthOf(patchBuffer.findMarkers('patch', {}), 0);
      assert.lengthOf(patchBuffer.findMarkers('hunk', {}), 0);

      modifier.apply();

      assert.lengthOf(patchBuffer.findMarkers('patch', {}), 1);
      const [marker0] = patchBuffer.findMarkers('patch', {});
      assert.isTrue(cb0.calledWith(marker0));

      assert.lengthOf(patchBuffer.findMarkers('hunk', {}), 1);
      const [marker1] = patchBuffer.findMarkers('hunk', {});
      assert.isTrue(cb1.calledWith(marker1));
    });

    it('inserts into the middle of an existing buffer', function() {
      const modifier = patchBuffer.createModifierAt([4, 2]);
      const callback = sinon.spy();

      modifier.append('aa\nbbbb\n');
      modifier.appendMarked('-patch-\n-patch-\n', 'patch', {callback});
      modifier.appendMarked('-hunk-\ndd', 'hunk', {});

      assert.strictEqual(patchBuffer.getBuffer().getText(), dedent`
        0000
        0001
        0002
        0003
        00aa
        bbbb
        -patch-
        -patch-
        -hunk-
        dd04
        0005
        0006
        0007
        0008
        0009

      `);

      assert.lengthOf(patchBuffer.findMarkers('patch', {}), 0);
      assert.lengthOf(patchBuffer.findMarkers('hunk', {}), 0);
      assert.isFalse(callback.called);

      modifier.apply();

      assert.lengthOf(patchBuffer.findMarkers('patch', {}), 1);
      const [marker] = patchBuffer.findMarkers('patch', {});
      assert.isTrue(callback.calledWith(marker));
    });

    it('preserves markers that should be before or after the modification region', function() {
      const before0 = patchBuffer.markRange('patch', [[1, 0], [4, 0]]);
      const before1 = patchBuffer.markPosition('hunk', [4, 0]);
      const after0 = patchBuffer.markPosition('patch', [4, 0]);

      const modifier = patchBuffer.createModifierAt([4, 0]);
      modifier.keepBefore([before0, before1]);
      modifier.keepAfter([after0]);

      let marker = null;
      const callback = m => { marker = m; };
      modifier.appendMarked('A\nB\nC\nD\nE\n', 'addition', {callback});

      modifier.apply();

      assert.deepEqual(before0.getRange().serialize(), [[1, 0], [4, 0]]);
      assert.deepEqual(before1.getRange().serialize(), [[4, 0], [4, 0]]);
      assert.deepEqual(marker.getRange().serialize(), [[4, 0], [9, 0]]);
      assert.deepEqual(after0.getRange().serialize(), [[9, 0], [9, 0]]);
    });
  });
});

const TEXT = dedent`
  0000
  0001
  0002
  0003
  0004
  0005
  0006
  0007
  0008
  0009

`;
