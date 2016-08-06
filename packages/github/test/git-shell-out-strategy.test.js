/** @babel */

import fs from 'fs'
import path from 'path'

import GitShellOutStrategy from '../lib/git-shell-out-strategy'

import {cloneRepository, assertDeepPropertyVals} from './helpers'

/**
 * KU Thoughts: The GitShellOutStrategy methods are tested in Repository tests for the most part
 *  For now, in order to minimize duplication, I'll limit test coverage here to methods that produce
 *  output that we rely on, to serve as documentation
 */

describe('Git commands', () => {
  describe('exec', () => {
    it('serializes operations', async () => {
      const workingDirPath = await cloneRepository('three-files')
      const git = new GitShellOutStrategy(workingDirPath)
      let expectedEvents = []
      let actualEvents = []
      let promises = []
      for (let i = 0; i < 10; i++) {
        expectedEvents.push(i)
        promises.push(git.diff().then(() => actualEvents.push(i)))
      }

      await Promise.all(promises)
      assert.deepEqual(expectedEvents, actualEvents)
    })

    it('runs operations after one fails', async () => {
      const workingDirPath = await cloneRepository('three-files')
      const git = new GitShellOutStrategy(workingDirPath)
      let expectedEvents = []
      let actualEvents = []
      let promises = []
      for (let i = 0; i < 10; i++) {
        expectedEvents.push(i)
        if (i === 5) {
          promises.push(git.exec(['fake', 'command']).catch(() => actualEvents.push(i)))
        } else {
          promises.push(git.exec(['status']).then(() => actualEvents.push(i)))
        }
      }

      await Promise.all(promises)
      assert.deepEqual(expectedEvents, actualEvents)
    })
  })

  describe('diffFileStatus', () => {
    it('returns an object with working directory file diff status between relative to HEAD', async () => {
      const workingDirPath = await cloneRepository('three-files')
      const git = new GitShellOutStrategy(workingDirPath)
      fs.writeFileSync(path.join(workingDirPath, 'a.txt'), 'qux\nfoo\nbar\n', 'utf8')
      fs.unlinkSync(path.join(workingDirPath, 'b.txt'))
      fs.renameSync(path.join(workingDirPath, 'c.txt'), path.join(workingDirPath, 'd.txt'))
      fs.writeFileSync(path.join(workingDirPath, 'e.txt'), 'qux', 'utf8')
      const diffOutput = await git.diffFileStatus({ target: 'HEAD' })
      assert.deepEqual(diffOutput, {
        'a.txt': 'modified',
        'b.txt': 'removed',
        'c.txt': 'removed',
        'd.txt': 'added',
        'e.txt': 'added'
      })
    })

    it('returns an empty object if there are no added, modified, or removed files', async () => {
      const workingDirPath = await cloneRepository('three-files')
      const git = new GitShellOutStrategy(workingDirPath)
      const diffOutput = await git.diffFileStatus({ target: 'HEAD' })
      assert.deepEqual(diffOutput, {})
    })
  })

  describe('getUntrackedFiles', () => {
    it('returns an array of untracked file paths', async () => {
      const workingDirPath = await cloneRepository('three-files')
      const git = new GitShellOutStrategy(workingDirPath)
      fs.writeFileSync(path.join(workingDirPath, 'd.txt'), 'foo', 'utf8')
      fs.writeFileSync(path.join(workingDirPath, 'e.txt'), 'bar', 'utf8')
      fs.writeFileSync(path.join(workingDirPath, 'f.txt'), 'qux', 'utf8')
      assert.deepEqual(await git.getUntrackedFiles(), ['d.txt', 'e.txt', 'f.txt'])
    })
  })

  describe('diff', () => {
    it('returns an empty array if there are no modified, added, or deleted files', async () => {
      const workingDirPath = await cloneRepository('three-files')
      const git = new GitShellOutStrategy(workingDirPath)

      const diffOutput = await git.diff()
      assert.deepEqual(diffOutput, [])
    })

    it('returns an array of objects for each file patch', async () => {
      const workingDirPath = await cloneRepository('three-files')
      const git = new GitShellOutStrategy(workingDirPath)

      fs.writeFileSync(path.join(workingDirPath, 'a.txt'), 'qux\nfoo\nbar\n', 'utf8')
      fs.unlinkSync(path.join(workingDirPath, 'b.txt'))
      fs.renameSync(path.join(workingDirPath, 'c.txt'), path.join(workingDirPath, 'd.txt'))
      fs.writeFileSync(path.join(workingDirPath, 'e.txt'), 'qux', 'utf8')
      fs.writeFileSync(path.join(workingDirPath, 'f.txt'), 'cat', 'utf8')

      await git.stageFile('f.txt')
      fs.unlinkSync(path.join(workingDirPath, 'f.txt'))

      const stagedDiffOutput = await git.diff({staged: true})
      assertDeepPropertyVals(stagedDiffOutput, [{
        'oldPath': null,
        'newPath': 'f.txt',
        'hunks': [
          {
            'oldStartLine': 0,
            'oldLineCount': 0,
            'newStartLine': 1,
            'newLineCount': 1,
            'lines': [ '+cat', '\\ No newline at end of file' ]
          }
        ],
        'status': 'added'
      }])

      const unstagedDiffOutput = await git.diff()
      assertDeepPropertyVals(unstagedDiffOutput, [
        {
          'oldPath': 'a.txt',
          'newPath': 'a.txt',
          'hunks': [
            {
              'oldStartLine': 1,
              'oldLineCount': 1,
              'newStartLine': 1,
              'newLineCount': 3,
              'lines': [
                '+qux',
                ' foo',
                '+bar'
              ]
            }
          ],
          'status': 'modified'
        },
        {
          'oldPath': 'b.txt',
          'newPath': null,
          'hunks': [
            {
              'oldStartLine': 1,
              'oldLineCount': 1,
              'newStartLine': 0,
              'newLineCount': 0,
              'lines': [
                '-bar'
              ]
            }
          ],
          'status': 'removed'
        },
        {
          'oldPath': 'c.txt',
          'newPath': null,
          'hunks': [
            {
              'oldStartLine': 1,
              'oldLineCount': 1,
              'newStartLine': 0,
              'newLineCount': 0,
              'lines': [ '-baz' ]
            }
          ],
          'status': 'removed'
        },
        {
          'oldPath': null,
          'newPath': 'd.txt',
          'hunks': [
            {
              'oldStartLine': 0,
              'oldLineCount': 0,
              'newStartLine': 1,
              'newLineCount': 1,
              'lines': [ '+baz' ]
            }
          ],
          'status': 'added'
        },
        {
          'oldPath': null,
          'newPath': 'e.txt',
          'hunks': [
            {
              'oldStartLine': 0,
              'oldLineCount': 0,
              'newStartLine': 1,
              'newLineCount': 1,
              'lines': [ '+qux', '\\ No newline at end of file' ]
            }
          ],
          'status': 'added'
        },
        {
          'oldPath': 'f.txt',
          'newPath': null,
          'hunks': [
            {
              'oldStartLine': 1,
              'oldLineCount': 1,
              'newStartLine': 0,
              'newLineCount': 0,
              'lines': [ '-cat', '\\ No newline at end of file' ]
            }
          ],
          'status': 'removed'
        }
      ])
    })

    it('ignores merge conflict files', async () => {
      const workingDirPath = await cloneRepository('merge-conflict')
      const git = new GitShellOutStrategy(workingDirPath)
      const diffOutput = await git.diff()
      assert.deepEqual(diffOutput, [])
    })
  })

  describe('getMergeConflictFileStatus', () => {
    it('returns an object with ours/theirs/file status by path', async () => {
      const workingDirPath = await cloneRepository('merge-conflict')
      const git = new GitShellOutStrategy(workingDirPath)
      try {
        await git.exec(['merge', 'origin/branch'])
      } catch (e) {
        // expected
      }

      const statusesByPath = await git.getMergeConflictFileStatus()
      assert.deepEqual(statusesByPath, {
        'added-to-both.txt': {
          ours: 'added',
          theirs: 'added',
          file: 'modified'
        },
        'modified-on-both-ours.txt': {
          ours: 'modified',
          theirs: 'modified',
          file: 'modified'
        },
        'modified-on-both-theirs.txt': {
          ours: 'modified',
          theirs: 'modified',
          file: 'modified'
        },
        'removed-on-branch.txt': {
          ours: 'modified',
          theirs: 'removed',
          file: 'equivalent'
        },
        'removed-on-master.txt': {
          ours: 'removed',
          theirs: 'modified',
          file: 'added'
        }
      })
    })
  })

  describe('isMerging', () => {
    it('returns true if `.git/MERGE_HEAD` exists', async () => {
      const workingDirPath = await cloneRepository('merge-conflict')
      const git = new GitShellOutStrategy(workingDirPath)
      let isMerging = await git.isMerging()
      assert.isFalse(isMerging)

      try {
        await git.exec(['merge', 'origin/branch'])
      } catch (e) {
        // expect merge to have conflicts
      }
      isMerging = await git.isMerging()
      assert.isTrue(isMerging)

      fs.unlinkSync(path.join(workingDirPath, '.git', 'MERGE_HEAD'))
      isMerging = await git.isMerging()
      assert.isFalse(isMerging)
    })
  })
})
