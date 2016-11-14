/** @babel */

import fs from 'fs-extra'
import path from 'path'

import mkdirp from 'mkdirp'

import GitShellOutStrategy from '../lib/git-shell-out-strategy'

import {cloneRepository, assertDeepPropertyVals, setUpLocalAndRemoteRepositories} from './helpers'

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

  describe('isGitRepository(directoryPath)', () => {
    it('returns true if the path passed is a valid repository, and false if not', async () => {
      const workingDirPath = await cloneRepository('three-files')
      const git = new GitShellOutStrategy(workingDirPath)
      assert.isTrue(await git.isGitRepository(workingDirPath))

      fs.removeSync(path.join(workingDirPath, '.git'))
      assert.isFalse(await git.isGitRepository(workingDirPath))
    })
  })

  describe('getStatus', () => {
    it('returns objects for staged and unstaged files, including status information', async () => {
      const workingDirPath = await cloneRepository('three-files')
      const git = new GitShellOutStrategy(workingDirPath)
      fs.writeFileSync(path.join(workingDirPath, 'a.txt'), 'qux\nfoo\nbar\n', 'utf8')
      fs.unlinkSync(path.join(workingDirPath, 'b.txt'))
      fs.renameSync(path.join(workingDirPath, 'c.txt'), path.join(workingDirPath, 'd.txt'))
      fs.writeFileSync(path.join(workingDirPath, 'e.txt'), 'qux', 'utf8')
      await git.exec(['add', 'a.txt', 'e.txt'])
      fs.writeFileSync(path.join(workingDirPath, 'a.txt'), 'modify after staging', 'utf8')
      fs.writeFileSync(path.join(workingDirPath, 'e.txt'), 'modify after staging', 'utf8')
      const {stagedFiles, unstagedFiles, mergeConflictFiles} = await git.getStatus()
      assert.deepEqual(stagedFiles, {
        'a.txt': 'modified',
        'e.txt': 'added'
      })
      assert.deepEqual(unstagedFiles, {
        'a.txt': 'modified',
        'b.txt': 'deleted',
        'c.txt': 'deleted',
        'd.txt': 'added',
        'e.txt': 'modified'
      })
      assert.deepEqual(mergeConflictFiles, {})
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
        'b.txt': 'deleted',
        'c.txt': 'deleted',
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

    it('handles untracked files in nested folders', async () => {
      const workingDirPath = await cloneRepository('three-files')
      const git = new GitShellOutStrategy(workingDirPath)
      fs.writeFileSync(path.join(workingDirPath, 'd.txt'), 'foo', 'utf8')
      const folderPath = path.join(workingDirPath, 'folder', 'subfolder')
      mkdirp.sync(folderPath)
      fs.writeFileSync(path.join(folderPath, 'e.txt'), 'bar', 'utf8')
      fs.writeFileSync(path.join(folderPath, 'f.txt'), 'qux', 'utf8')
      assert.deepEqual(await git.getUntrackedFiles(), [
        'd.txt',
        'folder/subfolder/e.txt',
        'folder/subfolder/f.txt'
      ])
    })

    it('returns an empty array if there are no untracked files', async () => {
      const workingDirPath = await cloneRepository('three-files')
      const git = new GitShellOutStrategy(workingDirPath)
      assert.deepEqual(await git.getUntrackedFiles(), [])
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

      await git.stageFiles(['f.txt'])
      fs.unlinkSync(path.join(workingDirPath, 'f.txt'))

      const stagedDiffOutput = await git.diff({staged: true})
      assertDeepPropertyVals(stagedDiffOutput, [{
        'oldPath': null,
        'newPath': 'f.txt',
        'oldMode': null,
        'newMode': '100644',
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
          'oldMode': '100644',
          'newMode': '100644',
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
          'oldMode': '100644',
          'newMode': null,
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
          'status': 'deleted'
        },
        {
          'oldPath': 'c.txt',
          'newPath': null,
          'oldMode': '100644',
          'newMode': null,
          'hunks': [
            {
              'oldStartLine': 1,
              'oldLineCount': 1,
              'newStartLine': 0,
              'newLineCount': 0,
              'lines': [ '-baz' ]
            }
          ],
          'status': 'deleted'
        },
        {
          'oldPath': null,
          'newPath': 'd.txt',
          'oldMode': null,
          'newMode': '100644',
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
          'oldMode': null,
          'newMode': '100644',
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
          'oldMode': '100644',
          'newMode': null,
          'hunks': [
            {
              'oldStartLine': 1,
              'oldLineCount': 1,
              'newStartLine': 0,
              'newLineCount': 0,
              'lines': [ '-cat', '\\ No newline at end of file' ]
            }
          ],
          'status': 'deleted'
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
        await git.merge('origin/branch')
      } catch (e) {
        // expected
        if (!e.message.match(/CONFLICT/)) {
          throw new Error(`merge failed for wrong reason: ${e.message}`)
        }
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
          theirs: 'deleted',
          file: 'equivalent'
        },
        'removed-on-master.txt': {
          ours: 'deleted',
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
        await git.merge('origin/branch')
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

  describe('getAheadCount(branchName) and getBehindCount(branchName)', () => {
    it('returns the number of different commits on the branch vs the remote', async () => {
      const {localRepoPath} = await setUpLocalAndRemoteRepositories({remoteAhead: true})
      const git = new GitShellOutStrategy(localRepoPath)
      assert.equal(await git.getBehindCount('master'), 0)
      assert.equal(await git.getAheadCount('master'), 0)
      await git.fetch('master')
      assert.equal(await git.getBehindCount('master'), 1)
      assert.equal(await git.getAheadCount('master'), 0)
      await git.commit('new commit', {allowEmpty: true})
      await git.commit('another commit', {allowEmpty: true})
      assert.equal(await git.getBehindCount('master'), 1)
      assert.equal(await git.getAheadCount('master'), 2)
    })
  })

  describe('getCurrentBranch() and checkout(branchName, {createNew})', () => {
    it('returns the current branch name', async () => {
      const workingDirPath = await cloneRepository('merge-conflict')
      const git = new GitShellOutStrategy(workingDirPath)
      assert.equal(await git.getCurrentBranch(), 'master')
      await git.checkout('branch')
      assert.equal(await git.getCurrentBranch(), 'branch')

      // newBranch does not yet exist
      await assert.isRejected(git.checkout('newBranch'))
      assert.equal(await git.getCurrentBranch(), 'branch')
      await git.checkout('newBranch', {createNew: true})
      assert.equal(await git.getCurrentBranch(), 'newBranch')
    })
  })

  describe('getRemoteForBranch(branchName)', () => {
    it('returns the name of the remote associated with the branch, and null if none exists', async () => {
      const workingDirPath = await cloneRepository('three-files')
      const git = new GitShellOutStrategy(workingDirPath)
      assert.equal(await git.getRemoteForBranch('master'), 'origin')
      await git.exec(['remote', 'rename', 'origin', 'foo'])
      assert.equal(await git.getRemoteForBranch('master'), 'foo')
      await git.exec(['remote', 'rm', 'foo'])
      assert.isNull(await git.getRemoteForBranch('master'))
    })
  })

  describe('getBranches()', () => {
    it('returns an array of all branches', async () => {
      const workingDirPath = await cloneRepository('three-files')
      const git = new GitShellOutStrategy(workingDirPath)
      assert.deepEqual(await git.getBranches(), ['master'])
      await git.checkout('new-branch', {createNew: true})
      assert.deepEqual(await git.getBranches(), ['master', 'new-branch'])
      await git.checkout('another-branch', {createNew: true})
      assert.deepEqual(await git.getBranches(), ['another-branch', 'master', 'new-branch'])
    })
  })

  describe('commit(message, options) where amend option is true', () => {
    it('amends the last commit', async () => {
      const workingDirPath = await cloneRepository('multiple-commits')
      const git = new GitShellOutStrategy(workingDirPath)
      const lastCommit = await git.getHeadCommit()
      const lastCommitParent = await git.getCommit('HEAD~')
      await git.commit('amend last commit', {amend: true, allowEmpty: true})
      const amendedCommit = await git.getHeadCommit()
      const amendedCommitParent = await git.getCommit('HEAD~')
      assert.notDeepEqual(lastCommit, amendedCommit)
      assert.deepEqual(lastCommitParent, amendedCommitParent)
    })
  })
})
