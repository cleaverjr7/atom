/** @babel */

import {copyRepositoryDir, buildRepository} from '../helpers'
import path from 'path'
import fs from 'fs'
import dedent from 'dedent-js'

import FilePatch from '../../lib/models/file-patch'
import Hunk from '../../lib/models/hunk'
import HunkLine from '../../lib/models/hunk-line'

describe('FilePatch', () => {
  describe('getId()', () => {
    it('returns an identifier that is the same for instances that logically represent the same FilePatch', () => {
      assert.equal(
        new FilePatch('a.txt', 'b.txt', 1234, 1234, 'renamed').getId(),
        new FilePatch('a.txt', 'b.txt', 4321, 4321, 'renamed').getId()
      )
      assert.equal(
        new FilePatch('a.txt', 'a.txt', 1234, 1234, 'modified').getId(),
        new FilePatch('a.txt', 'a.txt', 4321, 4321, 'modified').getId()
      )
      assert.equal(
        new FilePatch(null, 'a.txt', 0, 1234, 'added').getId(),
        new FilePatch(null, 'a.txt', 0, 1234, 'added').getId()
      )
      assert.equal(
        new FilePatch('a.txt', null, 1234, 0, 'removed').getId(),
        new FilePatch('a.txt', null, 1234, 0, 'removed').getId()
      )
      assert.notEqual(
        new FilePatch('a.txt', 'b.txt', 1234, 1234, 'renamed').getId(),
        new FilePatch('a.txt', 'd.txt', 1234, 1234, 'renamed').getId()
      )
      assert.notEqual(
        new FilePatch('a.txt', 'a.txt', 1234, 1234, 'modified').getId(),
        new FilePatch('b.txt', 'b.txt', 1234, 1234, 'modified').getId()
      )
      assert.notEqual(
        new FilePatch(null, 'a.txt', 1234, 1234, 'added').getId(),
        new FilePatch(null, 'c.txt', 1234, 1234, 'added').getId()
      )
      assert.notEqual(
        new FilePatch('a.txt', null, 1234, 0, 'removed').getId(),
        new FilePatch('x.txt', null, 1234, 0, 'removed').getId()
      )
    })
  })

  describe('getStagePatchForLines()', () => {
    it('returns a new FilePatch that applies only the specified lines', () => {
      const filePatch = new FilePatch('a.txt', 'a.txt', 1234, 1234, 'modified', [
        new Hunk(1, 1, 1, 3, [
          new HunkLine('line-1\n', 'added', -1, 1),
          new HunkLine('line-2\n', 'added', -1, 2),
          new HunkLine('line-3\n', 'unchanged', 1, 3)
        ]),
        new Hunk(5, 7, 5, 4, [
          new HunkLine('line-4\n', 'unchanged', 5, 7),
          new HunkLine('line-5\n', 'removed', 6, -1),
          new HunkLine('line-6\n', 'removed', 7, -1),
          new HunkLine('line-7\n', 'added', -1, 8),
          new HunkLine('line-8\n', 'added', -1, 9),
          new HunkLine('line-9\n', 'added', -1, 10),
          new HunkLine('line-10\n', 'removed', 8, -1),
          new HunkLine('line-11\n', 'removed', 9, -1)
        ]),
        new Hunk(20, 19, 2, 2, [
          new HunkLine('line-12\n', 'removed', 20, -1),
          new HunkLine('line-13\n', 'added', -1, 19),
          new HunkLine('line-14\n', 'unchanged', 21, 20)
        ])
      ])
      const lines = new Set(filePatch.getHunks()[1].getLines().slice(1, 4))
      assert.deepEqual(filePatch.getStagePatchForLines(lines), new FilePatch(
        'a.txt', 'a.txt', 1234, 1234, 'modified', [
          new Hunk(1, 1, 1, 1, [
            new HunkLine('line-3\n', 'unchanged', 1, 1)
          ]),
          new Hunk(5, 5, 5, 4, [
            new HunkLine('line-4\n', 'unchanged', 5, 5),
            new HunkLine('line-5\n', 'removed', 6, -1),
            new HunkLine('line-6\n', 'removed', 7, -1),
            new HunkLine('line-7\n', 'added', -1, 6),
            new HunkLine('line-10\n', 'unchanged', 8, 7),
            new HunkLine('line-11\n', 'unchanged', 9, 8)
          ]),
          new Hunk(20, 17, 2, 2, [
            new HunkLine('line-12\n', 'unchanged', 20, 17),
            new HunkLine('line-14\n', 'unchanged', 21, 18)
          ])
        ]
      ))
    })
  })

  describe('getUnstagePatchForLines()', () => {
    it('returns a new FilePatch that applies only the specified lines', () => {
      const filePatch = new FilePatch('a.txt', 'a.txt', 1234, 1234, 'modified', [
        new Hunk(1, 1, 1, 3, [
          new HunkLine('line-1\n', 'added', -1, 1),
          new HunkLine('line-2\n', 'added', -1, 2),
          new HunkLine('line-3\n', 'unchanged', 1, 3)
        ]),
        new Hunk(5, 7, 5, 4, [
          new HunkLine('line-4\n', 'unchanged', 5, 7),
          new HunkLine('line-5\n', 'removed', 6, -1),
          new HunkLine('line-6\n', 'removed', 7, -1),
          new HunkLine('line-7\n', 'added', -1, 8),
          new HunkLine('line-8\n', 'added', -1, 9),
          new HunkLine('line-9\n', 'added', -1, 10),
          new HunkLine('line-10\n', 'removed', 8, -1),
          new HunkLine('line-11\n', 'removed', 9, -1)
        ]),
        new Hunk(20, 19, 2, 2, [
          new HunkLine('line-12\n', 'removed', 20, -1),
          new HunkLine('line-13\n', 'added', -1, 19),
          new HunkLine('line-14\n', 'unchanged', 21, 20)
        ])
      ])
      const lines = new Set(filePatch.getHunks()[1].getLines().slice(1, 5))
      assert.deepEqual(filePatch.getUnstagePatchForLines(lines), new FilePatch(
        'a.txt', 'a.txt', 1234, 1234, 'modified', [
          new Hunk(1, 1, 3, 3, [
            new HunkLine('line-1\n', 'unchanged', 1, 1),
            new HunkLine('line-2\n', 'unchanged', 2, 2),
            new HunkLine('line-3\n', 'unchanged', 3, 3)
          ]),
          new Hunk(7, 7, 4, 4, [
            new HunkLine('line-4\n', 'unchanged', 7, 7),
            new HunkLine('line-7\n', 'removed', 8, -1),
            new HunkLine('line-8\n', 'removed', 9, -1),
            new HunkLine('line-5\n', 'added', -1, 8),
            new HunkLine('line-6\n', 'added', -1, 9),
            new HunkLine('line-9\n', 'unchanged', 10, 10)
          ]),
          new Hunk(19, 21, 2, 2, [
            new HunkLine('line-13\n', 'unchanged', 19, 21),
            new HunkLine('line-14\n', 'unchanged', 20, 22)
          ])
        ]
      ))
    })
  })

  describe('toString()', () => {
    it('converts the patch to the standard textual format', async () => {
      const workdirPath = copyRepositoryDir(2)
      const repository = await buildRepository(workdirPath)

      const lines = fs.readFileSync(path.join(workdirPath, 'sample.js'), 'utf8').split('\n')
      lines[0] = 'this is a modified line'
      lines.splice(1, 0, 'this is a new line')
      lines[11] = 'this is a modified line'
      lines.splice(12, 1)
      fs.writeFileSync(path.join(workdirPath, 'sample.js'), lines.join('\n'))

      const [patch] = await repository.getUnstagedChanges()
      assert.equal(patch.toString(), dedent`
        @@ -1,4 +1,5 @@
        -var quicksort = function () {
        +this is a modified line
        +this is a new line
           var sort = function(items) {
             if (items.length <= 1) return items;
             var pivot = items.shift(), current, left = [], right = [];
        @@ -8,6 +9,5 @@
             }
             return sort(left).concat(pivot).concat(sort(right));
           };
        -
        -  return sort(Array.apply(this, arguments));
        +this is a modified line
         };

      `)
    })

    it('correctly formats new files with no newline at the end', async () => {
      const workingDirPath = copyRepositoryDir(1)
      const repo = await buildRepository(workingDirPath)
      fs.writeFileSync(path.join(workingDirPath, 'e.txt'), 'qux', 'utf8')
      const [patch] = await repo.getUnstagedChanges()

      assert.equal(patch.toString(), dedent`
        @@ -0,0 +1,1 @@
        +qux
        \\ No newline at end of file

      `)
    })
  })
})
