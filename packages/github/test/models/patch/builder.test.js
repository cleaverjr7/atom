import {buildFilePatch, buildMultiFilePatch} from '../../../lib/models/patch';
import {assertInPatch, assertInFilePatch} from '../../helpers';

describe('buildFilePatch', function() {
  it('returns a null patch for an empty diff list', function() {
    const multiFilePatch = buildFilePatch([]);
    const [filePatch] = multiFilePatch.getFilePatches();

    assert.isFalse(filePatch.getOldFile().isPresent());
    assert.isFalse(filePatch.getNewFile().isPresent());
    assert.isFalse(filePatch.getPatch().isPresent());
  });

  describe('with a single diff', function() {
    it('assembles a patch from non-symlink sides', function() {
      const multiFilePatch = buildFilePatch([{
        oldPath: 'old/path',
        oldMode: '100644',
        newPath: 'new/path',
        newMode: '100755',
        status: 'modified',
        hunks: [
          {
            oldStartLine: 0,
            newStartLine: 0,
            oldLineCount: 7,
            newLineCount: 6,
            lines: [
              ' line-0',
              '-line-1',
              '-line-2',
              '-line-3',
              ' line-4',
              '+line-5',
              '+line-6',
              ' line-7',
              ' line-8',
            ],
          },
          {
            oldStartLine: 10,
            newStartLine: 11,
            oldLineCount: 3,
            newLineCount: 3,
            lines: [
              '-line-9',
              ' line-10',
              ' line-11',
              '+line-12',
            ],
          },
          {
            oldStartLine: 20,
            newStartLine: 21,
            oldLineCount: 4,
            newLineCount: 4,
            lines: [
              ' line-13',
              '-line-14',
              '-line-15',
              '+line-16',
              '+line-17',
              ' line-18',
            ],
          },
        ],
      }]);

      assert.lengthOf(multiFilePatch.getFilePatches(), 1);
      const [p] = multiFilePatch.getFilePatches();
      const buffer = multiFilePatch.getBuffer();

      assert.strictEqual(p.getOldPath(), 'old/path');
      assert.strictEqual(p.getOldMode(), '100644');
      assert.strictEqual(p.getNewPath(), 'new/path');
      assert.strictEqual(p.getNewMode(), '100755');
      assert.strictEqual(p.getPatch().getStatus(), 'modified');

      const bufferText =
        'line-0\nline-1\nline-2\nline-3\nline-4\nline-5\nline-6\nline-7\nline-8\nline-9\nline-10\n' +
        'line-11\nline-12\nline-13\nline-14\nline-15\nline-16\nline-17\nline-18\n';
      assert.strictEqual(buffer.getText(), bufferText);

      assertInPatch(p, buffer).hunks(
        {
          startRow: 0,
          endRow: 8,
          header: '@@ -0,7 +0,6 @@',
          regions: [
            {kind: 'unchanged', string: ' line-0\n', range: [[0, 0], [0, 6]]},
            {kind: 'deletion', string: '-line-1\n-line-2\n-line-3\n', range: [[1, 0], [3, 6]]},
            {kind: 'unchanged', string: ' line-4\n', range: [[4, 0], [4, 6]]},
            {kind: 'addition', string: '+line-5\n+line-6\n', range: [[5, 0], [6, 6]]},
            {kind: 'unchanged', string: ' line-7\n line-8\n', range: [[7, 0], [8, 6]]},
          ],
        },
        {
          startRow: 9,
          endRow: 12,
          header: '@@ -10,3 +11,3 @@',
          regions: [
            {kind: 'deletion', string: '-line-9\n', range: [[9, 0], [9, 6]]},
            {kind: 'unchanged', string: ' line-10\n line-11\n', range: [[10, 0], [11, 7]]},
            {kind: 'addition', string: '+line-12\n', range: [[12, 0], [12, 7]]},
          ],
        },
        {
          startRow: 13,
          endRow: 18,
          header: '@@ -20,4 +21,4 @@',
          regions: [
            {kind: 'unchanged', string: ' line-13\n', range: [[13, 0], [13, 7]]},
            {kind: 'deletion', string: '-line-14\n-line-15\n', range: [[14, 0], [15, 7]]},
            {kind: 'addition', string: '+line-16\n+line-17\n', range: [[16, 0], [17, 7]]},
            {kind: 'unchanged', string: ' line-18\n', range: [[18, 0], [18, 7]]},
          ],
        },
      );
    });

    it("sets the old file's symlink destination", function() {
      const multiFilePatch = buildFilePatch([{
        oldPath: 'old/path',
        oldMode: '120000',
        newPath: 'new/path',
        newMode: '100644',
        status: 'modified',
        hunks: [
          {
            oldStartLine: 0,
            newStartLine: 0,
            oldLineCount: 0,
            newLineCount: 0,
            lines: [' old/destination'],
          },
        ],
      }]);

      assert.lengthOf(multiFilePatch.getFilePatches(), 1);
      const [p] = multiFilePatch.getFilePatches();
      assert.strictEqual(p.getOldSymlink(), 'old/destination');
      assert.isNull(p.getNewSymlink());
    });

    it("sets the new file's symlink destination", function() {
      const multiFilePatch = buildFilePatch([{
        oldPath: 'old/path',
        oldMode: '100644',
        newPath: 'new/path',
        newMode: '120000',
        status: 'modified',
        hunks: [
          {
            oldStartLine: 0,
            newStartLine: 0,
            oldLineCount: 0,
            newLineCount: 0,
            lines: [' new/destination'],
          },
        ],
      }]);

      assert.lengthOf(multiFilePatch.getFilePatches(), 1);
      const [p] = multiFilePatch.getFilePatches();
      assert.isNull(p.getOldSymlink());
      assert.strictEqual(p.getNewSymlink(), 'new/destination');
    });

    it("sets both files' symlink destinations", function() {
      const multiFilePatch = buildFilePatch([{
        oldPath: 'old/path',
        oldMode: '120000',
        newPath: 'new/path',
        newMode: '120000',
        status: 'modified',
        hunks: [
          {
            oldStartLine: 0,
            newStartLine: 0,
            oldLineCount: 0,
            newLineCount: 0,
            lines: [
              ' old/destination',
              ' --',
              ' new/destination',
            ],
          },
        ],
      }]);

      assert.lengthOf(multiFilePatch.getFilePatches(), 1);
      const [p] = multiFilePatch.getFilePatches();
      assert.strictEqual(p.getOldSymlink(), 'old/destination');
      assert.strictEqual(p.getNewSymlink(), 'new/destination');
    });

    it('assembles a patch from a file deletion', function() {
      const multiFilePatch = buildFilePatch([{
        oldPath: 'old/path',
        oldMode: '100644',
        newPath: null,
        newMode: null,
        status: 'deleted',
        hunks: [
          {
            oldStartLine: 1,
            oldLineCount: 5,
            newStartLine: 0,
            newLineCount: 0,
            lines: [
              '-line-0',
              '-line-1',
              '-line-2',
              '-line-3',
              '-',
            ],
          },
        ],
      }]);

      assert.lengthOf(multiFilePatch.getFilePatches(), 1);
      const [p] = multiFilePatch.getFilePatches();
      const buffer = multiFilePatch.getBuffer();

      assert.isTrue(p.getOldFile().isPresent());
      assert.strictEqual(p.getOldPath(), 'old/path');
      assert.strictEqual(p.getOldMode(), '100644');
      assert.isFalse(p.getNewFile().isPresent());
      assert.strictEqual(p.getPatch().getStatus(), 'deleted');

      const bufferText = 'line-0\nline-1\nline-2\nline-3\n\n';
      assert.strictEqual(buffer.getText(), bufferText);

      assertInPatch(p, buffer).hunks(
        {
          startRow: 0,
          endRow: 4,
          header: '@@ -1,5 +0,0 @@',
          regions: [
            {kind: 'deletion', string: '-line-0\n-line-1\n-line-2\n-line-3\n-\n', range: [[0, 0], [4, 0]]},
          ],
        },
      );
    });

    it('assembles a patch from a file addition', function() {
      const multiFilePatch = buildFilePatch([{
        oldPath: null,
        oldMode: null,
        newPath: 'new/path',
        newMode: '100755',
        status: 'added',
        hunks: [
          {
            oldStartLine: 0,
            oldLineCount: 0,
            newStartLine: 1,
            newLineCount: 3,
            lines: [
              '+line-0',
              '+line-1',
              '+line-2',
            ],
          },
        ],
      }]);

      assert.lengthOf(multiFilePatch.getFilePatches(), 1);
      const [p] = multiFilePatch.getFilePatches();
      const buffer = multiFilePatch.getBuffer();

      assert.isFalse(p.getOldFile().isPresent());
      assert.isTrue(p.getNewFile().isPresent());
      assert.strictEqual(p.getNewPath(), 'new/path');
      assert.strictEqual(p.getNewMode(), '100755');
      assert.strictEqual(p.getPatch().getStatus(), 'added');

      const bufferText = 'line-0\nline-1\nline-2\n';
      assert.strictEqual(buffer.getText(), bufferText);

      assertInPatch(p, buffer).hunks(
        {
          startRow: 0,
          endRow: 2,
          header: '@@ -0,0 +1,3 @@',
          regions: [
            {kind: 'addition', string: '+line-0\n+line-1\n+line-2\n', range: [[0, 0], [2, 6]]},
          ],
        },
      );
    });

    it('throws an error with an unknown diff status character', function() {
      assert.throws(() => {
        buildFilePatch([{
          oldPath: 'old/path',
          oldMode: '100644',
          newPath: 'new/path',
          newMode: '100644',
          status: 'modified',
          hunks: [{oldStartLine: 0, newStartLine: 0, oldLineCount: 1, newLineCount: 1, lines: ['xline-0']}],
        }]);
      }, /diff status character: "x"/);
    });

    it('parses a no-newline marker', function() {
      const multiFilePatch = buildFilePatch([{
        oldPath: 'old/path',
        oldMode: '100644',
        newPath: 'new/path',
        newMode: '100644',
        status: 'modified',
        hunks: [{oldStartLine: 0, newStartLine: 0, oldLineCount: 1, newLineCount: 1, lines: [
          '+line-0', '-line-1', '\\ No newline at end of file',
        ]}],
      }]);

      assert.lengthOf(multiFilePatch.getFilePatches(), 1);
      const [p] = multiFilePatch.getFilePatches();
      const buffer = multiFilePatch.getBuffer();
      assert.strictEqual(buffer.getText(), 'line-0\nline-1\n No newline at end of file\n');

      assertInPatch(p, buffer).hunks({
        startRow: 0,
        endRow: 2,
        header: '@@ -0,1 +0,1 @@',
        regions: [
          {kind: 'addition', string: '+line-0\n', range: [[0, 0], [0, 6]]},
          {kind: 'deletion', string: '-line-1\n', range: [[1, 0], [1, 6]]},
          {kind: 'nonewline', string: '\\ No newline at end of file\n', range: [[2, 0], [2, 26]]},
        ],
      });
    });
  });

  describe('with a mode change and a content diff', function() {
    it('identifies a file that was deleted and replaced by a symlink', function() {
      const multiFilePatch = buildFilePatch([
        {
          oldPath: 'the-path',
          oldMode: '000000',
          newPath: 'the-path',
          newMode: '120000',
          status: 'added',
          hunks: [
            {
              oldStartLine: 0,
              newStartLine: 0,
              oldLineCount: 0,
              newLineCount: 0,
              lines: [' the-destination'],
            },
          ],
        },
        {
          oldPath: 'the-path',
          oldMode: '100644',
          newPath: 'the-path',
          newMode: '000000',
          status: 'deleted',
          hunks: [
            {
              oldStartLine: 0,
              newStartLine: 0,
              oldLineCount: 0,
              newLineCount: 2,
              lines: ['+line-0', '+line-1'],
            },
          ],
        },
      ]);

      assert.lengthOf(multiFilePatch.getFilePatches(), 1);
      const [p] = multiFilePatch.getFilePatches();
      const buffer = multiFilePatch.getBuffer();

      assert.strictEqual(p.getOldPath(), 'the-path');
      assert.strictEqual(p.getOldMode(), '100644');
      assert.isNull(p.getOldSymlink());
      assert.strictEqual(p.getNewPath(), 'the-path');
      assert.strictEqual(p.getNewMode(), '120000');
      assert.strictEqual(p.getNewSymlink(), 'the-destination');
      assert.strictEqual(p.getStatus(), 'deleted');

      assert.strictEqual(buffer.getText(), 'line-0\nline-1\n');
      assertInPatch(p, buffer).hunks({
        startRow: 0,
        endRow: 1,
        header: '@@ -0,0 +0,2 @@',
        regions: [
          {kind: 'addition', string: '+line-0\n+line-1\n', range: [[0, 0], [1, 6]]},
        ],
      });
    });

    it('identifies a symlink that was deleted and replaced by a file', function() {
      const multiFilePatch = buildFilePatch([
        {
          oldPath: 'the-path',
          oldMode: '120000',
          newPath: 'the-path',
          newMode: '000000',
          status: 'deleted',
          hunks: [
            {
              oldStartLine: 0,
              newStartLine: 0,
              oldLineCount: 0,
              newLineCount: 0,
              lines: [' the-destination'],
            },
          ],
        },
        {
          oldPath: 'the-path',
          oldMode: '000000',
          newPath: 'the-path',
          newMode: '100644',
          status: 'added',
          hunks: [
            {
              oldStartLine: 0,
              newStartLine: 0,
              oldLineCount: 2,
              newLineCount: 0,
              lines: ['-line-0', '-line-1'],
            },
          ],
        },
      ]);

      assert.lengthOf(multiFilePatch.getFilePatches(), 1);
      const [p] = multiFilePatch.getFilePatches();
      const buffer = multiFilePatch.getBuffer();

      assert.strictEqual(p.getOldPath(), 'the-path');
      assert.strictEqual(p.getOldMode(), '120000');
      assert.strictEqual(p.getOldSymlink(), 'the-destination');
      assert.strictEqual(p.getNewPath(), 'the-path');
      assert.strictEqual(p.getNewMode(), '100644');
      assert.isNull(p.getNewSymlink());
      assert.strictEqual(p.getStatus(), 'added');

      assert.strictEqual(buffer.getText(), 'line-0\nline-1\n');
      assertInPatch(p, buffer).hunks({
        startRow: 0,
        endRow: 1,
        header: '@@ -0,2 +0,0 @@',
        regions: [
          {kind: 'deletion', string: '-line-0\n-line-1\n', range: [[0, 0], [1, 6]]},
        ],
      });
    });

    it('is indifferent to the order of the diffs', function() {
      const multiFilePatch = buildFilePatch([
        {
          oldMode: '100644',
          newPath: 'the-path',
          newMode: '000000',
          status: 'deleted',
          hunks: [
            {
              oldStartLine: 0,
              newStartLine: 0,
              oldLineCount: 0,
              newLineCount: 2,
              lines: ['+line-0', '+line-1'],
            },
          ],
        },
        {
          oldPath: 'the-path',
          oldMode: '000000',
          newPath: 'the-path',
          newMode: '120000',
          status: 'added',
          hunks: [
            {
              oldStartLine: 0,
              newStartLine: 0,
              oldLineCount: 0,
              newLineCount: 0,
              lines: [' the-destination'],
            },
          ],
        },
      ]);

      assert.lengthOf(multiFilePatch.getFilePatches(), 1);
      const [p] = multiFilePatch.getFilePatches();
      const buffer = multiFilePatch.getBuffer();

      assert.strictEqual(p.getOldPath(), 'the-path');
      assert.strictEqual(p.getOldMode(), '100644');
      assert.isNull(p.getOldSymlink());
      assert.strictEqual(p.getNewPath(), 'the-path');
      assert.strictEqual(p.getNewMode(), '120000');
      assert.strictEqual(p.getNewSymlink(), 'the-destination');
      assert.strictEqual(p.getStatus(), 'deleted');

      assert.strictEqual(buffer.getText(), 'line-0\nline-1\n');
      assertInPatch(p, buffer).hunks({
        startRow: 0,
        endRow: 1,
        header: '@@ -0,0 +0,2 @@',
        regions: [
          {kind: 'addition', string: '+line-0\n+line-1\n', range: [[0, 0], [1, 6]]},
        ],
      });
    });

    it('throws an error on an invalid mode diff status', function() {
      assert.throws(() => {
        buildFilePatch([
          {
            oldMode: '100644',
            newPath: 'the-path',
            newMode: '000000',
            status: 'deleted',
            hunks: [
              {oldStartLine: 0, newStartLine: 0, oldLineCount: 0, newLineCount: 2, lines: ['+line-0', '+line-1']},
            ],
          },
          {
            oldPath: 'the-path',
            oldMode: '000000',
            newMode: '120000',
            status: 'modified',
            hunks: [
              {oldStartLine: 0, newStartLine: 0, oldLineCount: 0, newLineCount: 0, lines: [' the-destination']},
            ],
          },
        ]);
      }, /mode change diff status: modified/);
    });
  });

  describe('with multiple diffs', function() {
    it('creates a MultiFilePatch containing each', function() {
      const mp = buildMultiFilePatch([
        {
          oldPath: 'first', oldMode: '100644', newPath: 'first', newMode: '100755', status: 'modified',
          hunks: [
            {
              oldStartLine: 1, oldLineCount: 2, newStartLine: 1, newLineCount: 4,
              lines: [
                ' line-0',
                '+line-1',
                '+line-2',
                ' line-3',
              ],
            },
            {
              oldStartLine: 10, oldLineCount: 3, newStartLine: 12, newLineCount: 2,
              lines: [
                ' line-4',
                '-line-5',
                ' line-6',
              ],
            },
          ],
        },
        {
          oldPath: 'second', oldMode: '100644', newPath: 'second', newMode: '100644', status: 'modified',
          hunks: [
            {
              oldStartLine: 5, oldLineCount: 3, newStartLine: 5, newLineCount: 3,
              lines: [
                ' line-5',
                '+line-6',
                '-line-7',
                ' line-8',
              ],
            },
          ],
        },
        {
          oldPath: 'third', oldMode: '100755', newPath: 'third', newMode: '100755', status: 'added',
          hunks: [
            {
              oldStartLine: 1, oldLineCount: 0, newStartLine: 1, newLineCount: 3,
              lines: [
                '+line-0',
                '+line-1',
                '+line-2',
              ],
            },
          ],
        },
      ]);

      assert.lengthOf(mp.getFilePatches(), 3);

      assert.strictEqual(
        mp.getBuffer().getText(),
        'line-0\nline-1\nline-2\nline-3\nline-4\nline-5\nline-6\n' +
        'line-5\nline-6\nline-7\nline-8\n' +
        'line-0\nline-1\nline-2\n',
      );

      const assertAllSame = getter => {
        assert.lengthOf(
          Array.from(new Set(mp.getFilePatches().map(p => p[getter]()))),
          1,
          `FilePatches have different results from ${getter}`,
        );
      };
      for (const getter of ['getUnchangedLayer', 'getAdditionLayer', 'getDeletionLayer', 'getNoNewlineLayer']) {
        assertAllSame(getter);
      }

      assert.strictEqual(mp.getFilePatches()[0].getOldPath(), 'first');
      assert.deepEqual(mp.getFilePatches()[0].getMarker().getRange().serialize(), [[0, 0], [6, 6]]);
      assertInFilePatch(mp.getFilePatches()[0]).hunks(
        {
          startRow: 0, endRow: 3, header: '@@ -1,2 +1,4 @@', regions: [
            {kind: 'unchanged', string: ' line-0\n', range: [[0, 0], [0, 6]]},
            {kind: 'addition', string: '+line-1\n+line-2\n', range: [[1, 0], [2, 6]]},
            {kind: 'unchanged', string: ' line-3\n', range: [[3, 0], [3, 6]]},
          ],
        },
        {
          startRow: 4, endRow: 6, header: '@@ -10,3 +12,2 @@', regions: [
            {kind: 'unchanged', string: ' line-4\n', range: [[4, 0], [4, 6]]},
            {kind: 'deletion', string: '-line-5\n', range: [[5, 0], [5, 6]]},
            {kind: 'unchanged', string: ' line-6\n', range: [[6, 0], [6, 6]]},
          ],
        },
      );
      assert.strictEqual(mp.getFilePatches()[1].getOldPath(), 'second');
      assert.deepEqual(mp.getFilePatches()[1].getMarker().getRange().serialize(), [[7, 0], [10, 6]]);
      assertInFilePatch(mp.getFilePatches()[1]).hunks(
        {
          startRow: 7, endRow: 10, header: '@@ -5,3 +5,3 @@', regions: [
            {kind: 'unchanged', string: ' line-5\n', range: [[7, 0], [7, 6]]},
            {kind: 'addition', string: '+line-6\n', range: [[8, 0], [8, 6]]},
            {kind: 'deletion', string: '-line-7\n', range: [[9, 0], [9, 6]]},
            {kind: 'unchanged', string: ' line-8\n', range: [[10, 0], [10, 6]]},
          ],
        },
      );
      assert.strictEqual(mp.getFilePatches()[2].getOldPath(), 'third');
      assert.deepEqual(mp.getFilePatches()[2].getMarker().getRange().serialize(), [[11, 0], [13, 6]]);
      assertInFilePatch(mp.getFilePatches()[2]).hunks(
        {
          startRow: 11, endRow: 13, header: '@@ -1,0 +1,3 @@', regions: [
            {kind: 'addition', string: '+line-0\n+line-1\n+line-2\n', range: [[11, 0], [13, 6]]},
          ],
        },
      );
    });

    it('identifies mode and content change pairs within the patch list', function() {
      const mp = buildMultiFilePatch([
        {
          oldPath: 'first', oldMode: '100644', newPath: 'first', newMode: '100755', status: 'modified',
          hunks: [
            {
              oldStartLine: 1, oldLineCount: 2, newStartLine: 1, newLineCount: 3,
              lines: [
                ' line-0',
                '+line-1',
                ' line-2',
              ],
            },
          ],
        },
        {
          oldPath: 'was-non-symlink', oldMode: '100644', newPath: 'was-non-symlink', newMode: '000000', status: 'deleted',
          hunks: [
            {
              oldStartLine: 1, oldLineCount: 2, newStartLine: 1, newLineCount: 0,
              lines: ['-line-0', '-line-1'],
            },
          ],
        },
        {
          oldPath: 'was-symlink', oldMode: '000000', newPath: 'was-symlink', newMode: '100755', status: 'added',
          hunks: [
            {
              oldStartLine: 1, oldLineCount: 0, newStartLine: 1, newLineCount: 2,
              lines: ['+line-0', '+line-1'],
            },
          ],
        },
        {
          oldMode: '100644', newPath: 'third', newMode: '100644', status: 'deleted',
          hunks: [
            {
              oldStartLine: 1, oldLineCount: 3, newStartLine: 1, newLineCount: 0,
              lines: ['-line-0', '-line-1', '-line-2'],
            },
          ],
        },
        {
          oldPath: 'was-symlink', oldMode: '120000', newPath: 'was-non-symlink', newMode: '000000', status: 'deleted',
          hunks: [
            {
              oldStartLine: 1, oldLineCount: 0, newStartLine: 0, newLineCount: 0,
              lines: ['-was-symlink-destination'],
            },
          ],
        },
        {
          oldPath: 'was-non-symlink', oldMode: '000000', newPath: 'was-non-symlink', newMode: '120000', status: 'added',
          hunks: [
            {
              oldStartLine: 1, oldLineCount: 0, newStartLine: 1, newLineCount: 1,
              lines: ['+was-non-symlink-destination'],
            },
          ],
        },
      ]);

      assert.lengthOf(mp.getFilePatches(), 4);
      const [fp0, fp1, fp2, fp3] = mp.getFilePatches();

      assert.strictEqual(fp0.getOldPath(), 'first');
      assertInFilePatch(fp0).hunks({
        startRow: 0, endRow: 2, header: '@@ -1,2 +1,3 @@', regions: [
          {kind: 'unchanged', string: ' line-0\n', range: [[0, 0], [0, 6]]},
          {kind: 'addition', string: '+line-1\n', range: [[1, 0], [1, 6]]},
          {kind: 'unchanged', string: ' line-2\n', range: [[2, 0], [2, 6]]},
        ],
      });

      assert.strictEqual(fp1.getOldPath(), 'was-non-symlink');
      assert.isTrue(fp1.hasTypechange());
      assert.strictEqual(fp1.getNewSymlink(), 'was-non-symlink-destination');
      assertInFilePatch(fp1).hunks({
        startRow: 3, endRow: 4, header: '@@ -1,2 +1,0 @@', regions: [
          {kind: 'deletion', string: '-line-0\n-line-1\n', range: [[3, 0], [4, 6]]},
        ],
      });

      assert.strictEqual(fp2.getOldPath(), 'was-symlink');
      assert.isTrue(fp2.hasTypechange());
      assert.strictEqual(fp2.getOldSymlink(), 'was-symlink-destination');
      assertInFilePatch(fp2).hunks({
        startRow: 5, endRow: 6, header: '@@ -1,0 +1,2 @@', regions: [
          {kind: 'addition', string: '+line-0\n+line-1\n', range: [[5, 0], [6, 6]]},
        ],
      });

      assert.strictEqual(fp3.getNewPath(), 'third');
      assertInFilePatch(fp3).hunks({
        startRow: 7, endRow: 9, header: '@@ -1,3 +1,0 @@', regions: [
          {kind: 'deletion', string: '-line-0\n-line-1\n-line-2\n', range: [[7, 0], [9, 6]]},
        ],
      });
    });
  });

  it('throws an error with an unexpected number of diffs', function() {
    assert.throws(() => buildFilePatch([1, 2, 3]), /Unexpected number of diffs: 3/);
  });
});
