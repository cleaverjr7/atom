import fs from 'fs';
import path from 'path';
import dedent from 'dedent-js';
import temp from 'temp';
import util from 'util';
import compareSets from 'compare-sets';
import isEqual from 'lodash.isequal';
import {CompositeDisposable, Disposable} from 'event-kit';

import Repository from '../../lib/models/repository';
import {expectedDelegates} from '../../lib/models/repository-states';
import FileSystemChangeObserver from '../../lib/models/file-system-change-observer';

import {
  cloneRepository, setUpLocalAndRemoteRepositories, getHeadCommitOnRemote,
  assertDeepPropertyVals, assertEqualSortedArraysByKey,
} from '../helpers';
import {writeFile} from '../../lib/helpers';

describe('Repository', function() {
  it('delegates all state methods', function() {
    const missing = expectedDelegates.filter(delegateName => {
      return Repository.prototype[delegateName] === undefined;
    });

    // For convenience, write the delegate list to the console when there are any missing (in addition to failing the
    // test.)
    if (missing.length > 0) {
      const formatted = util.inspect(expectedDelegates);

      // eslint-disable-next-line no-console
      console.log(`Expected delegates for your copy-and-paste convenience:\n\n---\n${formatted}\n---\n`);
    }

    assert.lengthOf(missing, 0);
  });

  describe('initial states', function() {
    let repository;

    afterEach(async function() {
      repository && await repository.destroy();
    });

    it('begins in the Loading state with a working directory', async function() {
      const workdir = await cloneRepository('three-files');
      repository = new Repository(workdir);
      assert.isTrue(repository.isInState('Loading'));
    });

    it('begins in the Absent state with .absent()', function() {
      repository = Repository.absent();
      assert.isTrue(repository.isInState('Absent'));
    });

    it('begins in an AbsentGuess state with .absentGuess()', function() {
      repository = Repository.absentGuess();
      assert.isTrue(repository.isInState('AbsentGuess'));
      assert.isFalse(repository.showGitTabLoading());
      assert.isTrue(repository.showGitTabInit());
    });

    it('begins in a LoadingGuess state with .guess()', function() {
      repository = Repository.loadingGuess();
      assert.isTrue(repository.isInState('LoadingGuess'));
      assert.isTrue(repository.showGitTabLoading());
      assert.isFalse(repository.showGitTabInit());
    });
  });

  describe('init', function() {
    it('creates a repository in the given dir and returns the repository', async function() {
      const soonToBeRepositoryPath = fs.realpathSync(temp.mkdirSync());
      const repo = new Repository(soonToBeRepositoryPath);
      assert.isTrue(repo.isLoading());

      await repo.getLoadPromise();
      assert.isTrue(repo.isEmpty());

      await repo.init();

      assert.isTrue(repo.isPresent());
      assert.equal(repo.getWorkingDirectoryPath(), soonToBeRepositoryPath);
    });
  });

  describe('clone', function() {
    it('clones a repository from a URL to a directory and returns the repository', async function() {
      const upstreamPath = await cloneRepository('three-files');
      const destDir = fs.realpathSync(temp.mkdirSync());

      const repo = new Repository(destDir);
      const clonePromise = repo.clone(upstreamPath);
      assert.isTrue(repo.isLoading());
      await clonePromise;
      assert.isTrue(repo.isPresent());
      assert.equal(repo.getWorkingDirectoryPath(), destDir);
    });

    it('clones a repository when the directory does not exist yet', async function() {
      const upstreamPath = await cloneRepository('three-files');
      const parentDir = fs.realpathSync(temp.mkdirSync());
      const destDir = path.join(parentDir, 'subdir');

      const repo = new Repository(destDir);
      await repo.clone(upstreamPath, destDir);
      assert.isTrue(repo.isPresent());
      assert.equal(repo.getWorkingDirectoryPath(), destDir);
    });
  });

  describe('staging and unstaging files', function() {
    it('can stage and unstage modified files', async function() {
      const workingDirPath = await cloneRepository('three-files');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      fs.writeFileSync(path.join(workingDirPath, 'subdir-1', 'a.txt'), 'qux\nfoo\nbar\n', 'utf8');
      const [patch] = await repo.getUnstagedChanges();
      const filePath = patch.filePath;

      await repo.stageFiles([filePath]);
      repo.refresh();
      assert.deepEqual(await repo.getUnstagedChanges(), []);
      assert.deepEqual(await repo.getStagedChanges(), [patch]);

      await repo.unstageFiles([filePath]);
      repo.refresh();
      assert.deepEqual(await repo.getUnstagedChanges(), [patch]);
      assert.deepEqual(await repo.getStagedChanges(), []);
    });

    it('can stage and unstage removed files', async function() {
      const workingDirPath = await cloneRepository('three-files');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      fs.unlinkSync(path.join(workingDirPath, 'subdir-1', 'b.txt'));
      const [patch] = await repo.getUnstagedChanges();
      const filePath = patch.filePath;

      await repo.stageFiles([filePath]);
      repo.refresh();
      assert.deepEqual(await repo.getUnstagedChanges(), []);
      assert.deepEqual(await repo.getStagedChanges(), [patch]);

      await repo.unstageFiles([filePath]);
      repo.refresh();
      assert.deepEqual(await repo.getUnstagedChanges(), [patch]);
      assert.deepEqual(await repo.getStagedChanges(), []);
    });

    it('can stage and unstage renamed files', async function() {
      const workingDirPath = await cloneRepository('three-files');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      fs.renameSync(path.join(workingDirPath, 'c.txt'), path.join(workingDirPath, 'subdir-1', 'd.txt'));
      const patches = await repo.getUnstagedChanges();
      const filePath1 = patches[0].filePath;
      const filePath2 = patches[1].filePath;

      await repo.stageFiles([filePath1, filePath2]);
      repo.refresh();
      assertEqualSortedArraysByKey(await repo.getStagedChanges(), patches, 'filePath');
      assert.deepEqual(await repo.getUnstagedChanges(), []);

      await repo.unstageFiles([filePath1, filePath2]);
      repo.refresh();
      assertEqualSortedArraysByKey(await repo.getUnstagedChanges(), patches, 'filePath');
      assert.deepEqual(await repo.getStagedChanges(), []);
    });

    it('can stage and unstage added files', async function() {
      const workingDirPath = await cloneRepository('three-files');
      fs.writeFileSync(path.join(workingDirPath, 'subdir-1', 'e.txt'), 'qux', 'utf8');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      const [patch] = await repo.getUnstagedChanges();
      const filePath = patch.filePath;

      await repo.stageFiles([filePath]);
      repo.refresh();
      assert.deepEqual(await repo.getUnstagedChanges(), []);
      assert.deepEqual(await repo.getStagedChanges(), [patch]);

      await repo.unstageFiles([filePath]);
      repo.refresh();
      assert.deepEqual(await repo.getUnstagedChanges(), [patch]);
      assert.deepEqual(await repo.getStagedChanges(), []);
    });

    it('can unstage and retrieve staged changes relative to HEAD~', async function() {
      const workingDirPath = await cloneRepository('multiple-commits');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      fs.writeFileSync(path.join(workingDirPath, 'file.txt'), 'three\nfour\n', 'utf8');
      assert.deepEqual(await repo.getStagedChangesSinceParentCommit(), [
        {
          filePath: 'file.txt',
          status: 'modified',
        },
      ]);
      assertDeepPropertyVals(await repo.getFilePatchForPath('file.txt', {staged: true, amending: true}), {
        oldPath: 'file.txt',
        newPath: 'file.txt',
        status: 'modified',
        hunks: [
          {
            lines: [
              {status: 'deleted', text: 'two', oldLineNumber: 1, newLineNumber: -1},
              {status: 'added', text: 'three', oldLineNumber: -1, newLineNumber: 1},
            ],
          },
        ],
      });

      await repo.stageFiles(['file.txt']);
      repo.refresh();
      assertDeepPropertyVals(await repo.getFilePatchForPath('file.txt', {staged: true, amending: true}), {
        oldPath: 'file.txt',
        newPath: 'file.txt',
        status: 'modified',
        hunks: [
          {
            lines: [
              {status: 'deleted', text: 'two', oldLineNumber: 1, newLineNumber: -1},
              {status: 'added', text: 'three', oldLineNumber: -1, newLineNumber: 1},
              {status: 'added', text: 'four', oldLineNumber: -1, newLineNumber: 2},
            ],
          },
        ],
      });

      await repo.stageFilesFromParentCommit(['file.txt']);
      repo.refresh();
      assert.deepEqual(await repo.getStagedChangesSinceParentCommit(), []);
    });
  });

  describe('getFilePatchForPath', function() {
    it('returns cached FilePatch objects if they exist', async function() {
      const workingDirPath = await cloneRepository('multiple-commits');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      fs.writeFileSync(path.join(workingDirPath, 'new-file.txt'), 'foooooo', 'utf8');
      fs.writeFileSync(path.join(workingDirPath, 'file.txt'), 'qux\nfoo\nbar\n', 'utf8');
      await repo.stageFiles(['file.txt']);

      const unstagedFilePatch = await repo.getFilePatchForPath('new-file.txt');
      const stagedFilePatch = await repo.getFilePatchForPath('file.txt', {staged: true});
      const stagedFilePatchDuringAmend = await repo.getFilePatchForPath('file.txt', {staged: true, amending: true});
      assert.equal(await repo.getFilePatchForPath('new-file.txt'), unstagedFilePatch);
      assert.equal(await repo.getFilePatchForPath('file.txt', {staged: true}), stagedFilePatch);
      assert.equal(await repo.getFilePatchForPath('file.txt', {staged: true, amending: true}), stagedFilePatchDuringAmend);
    });

    it('returns new FilePatch object after repository refresh', async function() {
      const workingDirPath = await cloneRepository('three-files');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      fs.writeFileSync(path.join(workingDirPath, 'a.txt'), 'qux\nfoo\nbar\n', 'utf8');

      const filePatchA = await repo.getFilePatchForPath('a.txt');
      assert.equal(await repo.getFilePatchForPath('a.txt'), filePatchA);

      repo.refresh();
      assert.notEqual(await repo.getFilePatchForPath('a.txt'), filePatchA);
      assert.deepEqual(await repo.getFilePatchForPath('a.txt'), filePatchA);
    });
  });

  describe('applyPatchToIndex', function() {
    it('can stage and unstage modified files', async function() {
      const workingDirPath = await cloneRepository('three-files');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      fs.writeFileSync(path.join(workingDirPath, 'subdir-1', 'a.txt'), 'qux\nfoo\nbar\n', 'utf8');
      const unstagedPatch1 = await repo.getFilePatchForPath(path.join('subdir-1', 'a.txt'));

      fs.writeFileSync(path.join(workingDirPath, 'subdir-1', 'a.txt'), 'qux\nfoo\nbar\nbaz\n', 'utf8');
      repo.refresh();
      const unstagedPatch2 = await repo.getFilePatchForPath(path.join('subdir-1', 'a.txt'));

      await repo.applyPatchToIndex(unstagedPatch1);
      repo.refresh();
      const stagedPatch1 = await repo.getFilePatchForPath(path.join('subdir-1', 'a.txt'), {staged: true});
      assert.deepEqual(stagedPatch1, unstagedPatch1);

      let unstagedChanges = (await repo.getUnstagedChanges()).map(c => c.filePath);
      let stagedChanges = (await repo.getStagedChanges()).map(c => c.filePath);
      assert.deepEqual(unstagedChanges, ['subdir-1/a.txt']);
      assert.deepEqual(stagedChanges, ['subdir-1/a.txt']);

      await repo.applyPatchToIndex(unstagedPatch1.getUnstagePatch());
      repo.refresh();
      const unstagedPatch3 = await repo.getFilePatchForPath(path.join('subdir-1', 'a.txt'));
      assert.deepEqual(unstagedPatch3, unstagedPatch2);
      unstagedChanges = (await repo.getUnstagedChanges()).map(c => c.filePath);
      stagedChanges = (await repo.getStagedChanges()).map(c => c.filePath);
      assert.deepEqual(unstagedChanges, ['subdir-1/a.txt']);
      assert.deepEqual(stagedChanges, []);
    });
  });

  describe('commit', function() {
    it('creates a commit that contains the staged changes', async function() {
      const workingDirPath = await cloneRepository('three-files');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      assert.equal((await repo.getLastCommit()).getMessage(), 'Initial commit');

      fs.writeFileSync(path.join(workingDirPath, 'subdir-1', 'a.txt'), 'qux\nfoo\nbar\n', 'utf8');
      const unstagedPatch1 = await repo.getFilePatchForPath(path.join('subdir-1', 'a.txt'));
      fs.writeFileSync(path.join(workingDirPath, 'subdir-1', 'a.txt'), 'qux\nfoo\nbar\nbaz\n', 'utf8');
      repo.refresh();
      await repo.applyPatchToIndex(unstagedPatch1);
      await repo.commit('Commit 1');
      assert.equal((await repo.getLastCommit()).getMessage(), 'Commit 1');
      repo.refresh();
      assert.deepEqual(await repo.getStagedChanges(), []);
      const unstagedChanges = await repo.getUnstagedChanges();
      assert.equal(unstagedChanges.length, 1);

      const unstagedPatch2 = await repo.getFilePatchForPath(path.join('subdir-1', 'a.txt'));
      await repo.applyPatchToIndex(unstagedPatch2);
      await repo.commit('Commit 2');
      assert.equal((await repo.getLastCommit()).getMessage(), 'Commit 2');
      repo.refresh();
      assert.deepEqual(await repo.getStagedChanges(), []);
      assert.deepEqual(await repo.getUnstagedChanges(), []);
    });

    it('amends the last commit when the amend option is set to true', async function() {
      const workingDirPath = await cloneRepository('multiple-commits');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      const lastCommit = await repo.git.getHeadCommit();
      const lastCommitParent = await repo.git.getCommit('HEAD~');
      await repo.commit('amend last commit', {amend: true, allowEmpty: true});
      const amendedCommit = await repo.git.getHeadCommit();
      const amendedCommitParent = await repo.git.getCommit('HEAD~');
      assert.notDeepEqual(lastCommit, amendedCommit);
      assert.deepEqual(lastCommitParent, amendedCommitParent);
    });

    it('throws an error when there are unmerged files', async function() {
      const workingDirPath = await cloneRepository('merge-conflict');
      const repository = new Repository(workingDirPath);
      await repository.getLoadPromise();

      try {
        await repository.git.merge('origin/branch');
      } catch (e) {
        // expected
      }

      assert.equal(await repository.isMerging(), true);
      const mergeBase = await repository.getLastCommit();

      try {
        await repository.commit('Merge Commit');
      } catch (e) {
        assert.isAbove(e.code, 0);
        assert.match(e.command, /commit/);
      }

      assert.equal(await repository.isMerging(), true);
      assert.equal((await repository.getLastCommit()).getSha(), mergeBase.getSha());
    });

    it('wraps the commit message body at 72 characters', async function() {
      const workingDirPath = await cloneRepository('three-files');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      fs.writeFileSync(path.join(workingDirPath, 'subdir-1', 'a.txt'), 'qux\nfoo\nbar\n', 'utf8');
      await repo.stageFiles([path.join('subdir-1', 'a.txt')]);
      await repo.commit([
        'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor',
        '',
        'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      ].join('\n'));

      const message = (await repo.getLastCommit()).getMessage();
      assert.deepEqual(message.split('\n'), [
        'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor',
        '',
        'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi',
        'ut aliquip ex ea commodo consequat.',
      ]);
    });

    it('strips out comments', async function() {
      const workingDirPath = await cloneRepository('three-files');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      fs.writeFileSync(path.join(workingDirPath, 'subdir-1', 'a.txt'), 'qux\nfoo\nbar\n', 'utf8');
      await repo.stageFiles([path.join('subdir-1', 'a.txt')]);
      await repo.commit([
        'Make a commit',
        '',
        '# Comments:',
        '#  blah blah blah',
        '#  other stuff',
      ].join('\n'));

      assert.deepEqual((await repo.getLastCommit()).getMessage(), 'Make a commit');
    });

    it('clears the stored resolution progress');
  });

  describe('fetch(branchName)', function() {
    it('brings commits from the remote and updates remote branch, and does not update branch', async function() {
      const {localRepoPath} = await setUpLocalAndRemoteRepositories({remoteAhead: true});
      const localRepo = new Repository(localRepoPath);
      await localRepo.getLoadPromise();

      let remoteHead, localHead;
      remoteHead = await localRepo.git.getCommit('origin/master');
      localHead = await localRepo.git.getCommit('master');
      assert.equal(remoteHead.message, 'second commit');
      assert.equal(localHead.message, 'second commit');

      await localRepo.fetch('master');
      remoteHead = await localRepo.git.getCommit('origin/master');
      localHead = await localRepo.git.getCommit('master');
      assert.equal(remoteHead.message, 'third commit');
      assert.equal(localHead.message, 'second commit');
    });
  });

  describe('pull()', function() {
    it('updates the remote branch and merges into local branch', async function() {
      const {localRepoPath} = await setUpLocalAndRemoteRepositories({remoteAhead: true});
      const localRepo = new Repository(localRepoPath);
      await localRepo.getLoadPromise();

      let remoteHead, localHead;
      remoteHead = await localRepo.git.getCommit('origin/master');
      localHead = await localRepo.git.getCommit('master');
      assert.equal(remoteHead.message, 'second commit');
      assert.equal(localHead.message, 'second commit');

      await localRepo.pull('master');
      remoteHead = await localRepo.git.getCommit('origin/master');
      localHead = await localRepo.git.getCommit('master');
      assert.equal(remoteHead.message, 'third commit');
      assert.equal(localHead.message, 'third commit');
    });
  });

  describe('push()', function() {
    it('sends commits to the remote and updates ', async function() {
      const {localRepoPath, remoteRepoPath} = await setUpLocalAndRemoteRepositories();
      const localRepo = new Repository(localRepoPath);
      await localRepo.getLoadPromise();

      let localHead, localRemoteHead, remoteHead;
      localHead = await localRepo.git.getCommit('master');
      localRemoteHead = await localRepo.git.getCommit('origin/master');
      assert.deepEqual(localHead, localRemoteHead);

      await localRepo.commit('fourth commit', {allowEmpty: true});
      await localRepo.commit('fifth commit', {allowEmpty: true});
      localHead = await localRepo.git.getCommit('master');
      localRemoteHead = await localRepo.git.getCommit('origin/master');
      remoteHead = await getHeadCommitOnRemote(remoteRepoPath);
      assert.notDeepEqual(localHead, remoteHead);
      assert.equal(remoteHead.message, 'third commit');
      assert.deepEqual(remoteHead, localRemoteHead);

      await localRepo.push('master');
      localHead = await localRepo.git.getCommit('master');
      localRemoteHead = await localRepo.git.getCommit('origin/master');
      remoteHead = await getHeadCommitOnRemote(remoteRepoPath);
      assert.deepEqual(localHead, remoteHead);
      assert.equal(remoteHead.message, 'fifth commit');
      assert.deepEqual(remoteHead, localRemoteHead);
    });
  });

  describe('getAheadCount(branchName) and getBehindCount(branchName)', function() {
    it('returns the number of commits ahead and behind the remote', async function() {
      const {localRepoPath} = await setUpLocalAndRemoteRepositories({remoteAhead: true});
      const localRepo = new Repository(localRepoPath);
      await localRepo.getLoadPromise();

      assert.equal(await localRepo.getBehindCount('master'), 0);
      assert.equal(await localRepo.getAheadCount('master'), 0);
      await localRepo.fetch('master');
      assert.equal(await localRepo.getBehindCount('master'), 1);
      assert.equal(await localRepo.getAheadCount('master'), 0);
      await localRepo.commit('new commit', {allowEmpty: true});
      await localRepo.commit('another commit', {allowEmpty: true});
      assert.equal(await localRepo.getBehindCount('master'), 1);
      assert.equal(await localRepo.getAheadCount('master'), 2);
    });
  });

  describe('getRemoteForBranch(branchName)', function() {
    it('returns the remote associated to the supplied branch name', async function() {
      const {localRepoPath} = await setUpLocalAndRemoteRepositories({remoteAhead: true});
      const localRepo = new Repository(localRepoPath);
      await localRepo.getLoadPromise();

      const remote0 = await localRepo.getRemoteForBranch('master');
      assert.isTrue(remote0.isPresent());
      assert.equal(remote0.getName(), 'origin');

      await localRepo.git.exec(['remote', 'rename', 'origin', 'foo']);
      localRepo.refresh();

      const remote1 = await localRepo.getRemoteForBranch('master');
      assert.isTrue(remote1.isPresent());
      assert.equal(remote1.getName(), 'foo');

      await localRepo.git.exec(['remote', 'rm', 'foo']);
      localRepo.refresh();

      const remote2 = await localRepo.getRemoteForBranch('master');
      assert.isFalse(remote2.isPresent());
    });
  });

  describe('merge conflicts', function() {
    describe('getMergeConflicts()', function() {
      it('returns a promise resolving to an array of MergeConflict objects', async function() {
        const workingDirPath = await cloneRepository('merge-conflict');
        const repo = new Repository(workingDirPath);
        await repo.getLoadPromise();
        await assert.isRejected(repo.git.merge('origin/branch'), /CONFLICT/);

        repo.refresh();
        let mergeConflicts = await repo.getMergeConflicts();
        const expected = [
          {
            filePath: 'added-to-both.txt',
            status: {
              file: 'modified',
              ours: 'added',
              theirs: 'added',
            },
          },
          {
            filePath: 'modified-on-both-ours.txt',
            status: {
              file: 'modified',
              ours: 'modified',
              theirs: 'modified',
            },
          },
          {
            filePath: 'modified-on-both-theirs.txt',
            status: {
              file: 'modified',
              ours: 'modified',
              theirs: 'modified',
            },
          },
          {
            filePath: 'removed-on-branch.txt',
            status: {
              file: 'equivalent',
              ours: 'modified',
              theirs: 'deleted',
            },
          },
          {
            filePath: 'removed-on-master.txt',
            status: {
              file: 'added',
              ours: 'deleted',
              theirs: 'modified',
            },
          },
        ];

        assertDeepPropertyVals(mergeConflicts, expected);

        fs.unlinkSync(path.join(workingDirPath, 'removed-on-branch.txt'));
        repo.refresh();
        mergeConflicts = await repo.getMergeConflicts();
        expected[3].status.file = 'deleted';
        assertDeepPropertyVals(mergeConflicts, expected);
      });

      it('returns an empty array if the repo has no merge conflicts', async function() {
        const workingDirPath = await cloneRepository('three-files');
        const repo = new Repository(workingDirPath);
        await repo.getLoadPromise();

        const mergeConflicts = await repo.getMergeConflicts();
        assert.deepEqual(mergeConflicts, []);
      });
    });

    describe('stageFiles([path])', function() {
      it('updates the staged changes accordingly', async function() {
        const workingDirPath = await cloneRepository('merge-conflict');
        const repo = new Repository(workingDirPath);
        await repo.getLoadPromise();
        await assert.isRejected(repo.git.merge('origin/branch'));

        repo.refresh();
        const mergeConflictPaths = (await repo.getMergeConflicts()).map(c => c.filePath);
        assert.deepEqual(mergeConflictPaths, ['added-to-both.txt', 'modified-on-both-ours.txt', 'modified-on-both-theirs.txt', 'removed-on-branch.txt', 'removed-on-master.txt']);

        let stagedFilePatches = await repo.getStagedChanges();
        assert.deepEqual(stagedFilePatches.map(patch => patch.filePath), []);

        await repo.stageFiles(['added-to-both.txt']);
        repo.refresh();
        stagedFilePatches = await repo.getStagedChanges();
        assert.deepEqual(stagedFilePatches.map(patch => patch.filePath), ['added-to-both.txt']);

        // choose version of the file on head
        fs.writeFileSync(path.join(workingDirPath, 'modified-on-both-ours.txt'), 'master modification\n', 'utf8');
        await repo.stageFiles(['modified-on-both-ours.txt']);
        repo.refresh();
        stagedFilePatches = await repo.getStagedChanges();
        // nothing additional to stage
        assert.deepEqual(stagedFilePatches.map(patch => patch.filePath), ['added-to-both.txt']);

        // choose version of the file on branch
        fs.writeFileSync(path.join(workingDirPath, 'modified-on-both-ours.txt'), 'branch modification\n', 'utf8');
        await repo.stageFiles(['modified-on-both-ours.txt']);
        repo.refresh();
        stagedFilePatches = await repo.getStagedChanges();
        assert.deepEqual(stagedFilePatches.map(patch => patch.filePath), ['added-to-both.txt', 'modified-on-both-ours.txt']);

        // remove file that was deleted on branch
        fs.unlinkSync(path.join(workingDirPath, 'removed-on-branch.txt'));
        await repo.stageFiles(['removed-on-branch.txt']);
        repo.refresh();
        stagedFilePatches = await repo.getStagedChanges();
        assert.deepEqual(stagedFilePatches.map(patch => patch.filePath), ['added-to-both.txt', 'modified-on-both-ours.txt', 'removed-on-branch.txt']);

        // remove file that was deleted on master
        fs.unlinkSync(path.join(workingDirPath, 'removed-on-master.txt'));
        await repo.stageFiles(['removed-on-master.txt']);
        repo.refresh();
        stagedFilePatches = await repo.getStagedChanges();
        // nothing additional to stage
        assert.deepEqual(stagedFilePatches.map(patch => patch.filePath), ['added-to-both.txt', 'modified-on-both-ours.txt', 'removed-on-branch.txt']);
      });
    });

    describe('pathHasMergeMarkers()', function() {
      it('returns true if and only if the file has merge markers', async function() {
        const workingDirPath = await cloneRepository('merge-conflict');
        const repo = new Repository(workingDirPath);
        await repo.getLoadPromise();
        await assert.isRejected(repo.git.merge('origin/branch'));

        assert.isTrue(await repo.pathHasMergeMarkers('added-to-both.txt'));
        assert.isFalse(await repo.pathHasMergeMarkers('removed-on-master.txt'));

        fs.writeFileSync(path.join(workingDirPath, 'file-with-chevrons.txt'), dedent`
          no branch name:
          >>>>>>>
          <<<<<<<

          not enough chevrons:
          >>> HEAD
          <<< branch

          too many chevrons:
          >>>>>>>>> HEAD
          <<<<<<<<< branch

          too many words after chevrons:
          >>>>>>> blah blah blah
          <<<<<<< blah blah blah

          not at line beginning:
          foo >>>>>>> bar
          baz <<<<<<< qux
        `);
        assert.isFalse(await repo.pathHasMergeMarkers('file-with-chevrons.txt'));

        assert.isFalse(await repo.pathHasMergeMarkers('nonexistent-file.txt'));
      });
    });

    describe('abortMerge()', function() {
      describe('when the working directory is clean', function() {
        it('resets the index and the working directory to match HEAD', async function() {
          const workingDirPath = await cloneRepository('merge-conflict-abort');
          const repo = new Repository(workingDirPath);
          await repo.getLoadPromise();

          await assert.isRejected(repo.git.merge('origin/spanish'));

          assert.equal(await repo.isMerging(), true);
          await repo.abortMerge();
          assert.equal(await repo.isMerging(), false);
        });
      });

      describe('when a dirty file in the working directory is NOT under conflict', function() {
        it('successfully aborts the merge and does not affect the dirty file', async function() {
          const workingDirPath = await cloneRepository('merge-conflict-abort');
          const repo = new Repository(workingDirPath);
          await repo.getLoadPromise();
          await assert.isRejected(repo.git.merge('origin/spanish'));

          fs.writeFileSync(path.join(workingDirPath, 'fruit.txt'), 'a change\n');
          assert.equal(await repo.isMerging(), true);

          await repo.abortMerge();
          assert.equal(await repo.isMerging(), false);
          assert.equal((await repo.getStagedChanges()).length, 0);
          assert.equal((await repo.getUnstagedChanges()).length, 1);
          assert.equal(fs.readFileSync(path.join(workingDirPath, 'fruit.txt')), 'a change\n');
        });
      });

      describe('when a dirty file in the working directory is under conflict', function() {
        it('throws an error indicating that the abort could not be completed', async function() {
          const workingDirPath = await cloneRepository('merge-conflict-abort');
          const repo = new Repository(workingDirPath);
          await repo.getLoadPromise();
          await assert.isRejected(repo.git.merge('origin/spanish'));

          fs.writeFileSync(path.join(workingDirPath, 'animal.txt'), 'a change\n');
          const stagedChanges = await repo.getStagedChanges();
          const unstagedChanges = await repo.getUnstagedChanges();

          assert.equal(await repo.isMerging(), true);
          try {
            await repo.abortMerge();
            assert.fail(null, null, 'repo.abortMerge() unexepctedly succeeded');
          } catch (e) {
            assert.match(e.command, /^git merge --abort/);
          }
          assert.equal(await repo.isMerging(), true);
          assert.deepEqual(await repo.getStagedChanges(), stagedChanges);
          assert.deepEqual(await repo.getUnstagedChanges(), unstagedChanges);
        });
      });
    });
  });

  describe('discardWorkDirChangesForPaths()', function() {
    it('can discard working directory changes in modified files', async function() {
      const workingDirPath = await cloneRepository('three-files');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      fs.writeFileSync(path.join(workingDirPath, 'subdir-1', 'a.txt'), 'qux\nfoo\nbar\n', 'utf8');
      fs.writeFileSync(path.join(workingDirPath, 'subdir-1', 'b.txt'), 'qux\nfoo\nbar\n', 'utf8');
      fs.writeFileSync(path.join(workingDirPath, 'new-file.txt'), 'hello there', 'utf8');
      const unstagedChanges = await repo.getUnstagedChanges();

      assert.equal(unstagedChanges.length, 3);
      await repo.discardWorkDirChangesForPaths(unstagedChanges.map(c => c.filePath));
      repo.refresh();
      assert.deepEqual(await repo.getUnstagedChanges(), []);
    });

    it('can discard working directory changes in removed files', async function() {
      const workingDirPath = await cloneRepository('three-files');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      fs.unlinkSync(path.join(workingDirPath, 'subdir-1', 'a.txt'));
      fs.unlinkSync(path.join(workingDirPath, 'subdir-1', 'b.txt'));
      const unstagedChanges = await repo.getUnstagedChanges();

      assert.equal(unstagedChanges.length, 2);
      await repo.discardWorkDirChangesForPaths(unstagedChanges.map(c => c.filePath));
      repo.refresh();
      assert.deepEqual(await repo.getUnstagedChanges(), []);
    });

    it('can discard working directory changes added files', async function() {
      const workingDirPath = await cloneRepository('three-files');
      const repo = new Repository(workingDirPath);
      await repo.getLoadPromise();

      fs.writeFileSync(path.join(workingDirPath, 'subdir-1', 'e.txt'), 'qux', 'utf8');
      fs.writeFileSync(path.join(workingDirPath, 'subdir-1', 'f.txt'), 'qux', 'utf8');
      const unstagedChanges = await repo.getUnstagedChanges();

      assert.equal(unstagedChanges.length, 2);
      await repo.discardWorkDirChangesForPaths(unstagedChanges.map(c => c.filePath));
      repo.refresh();
      assert.deepEqual(await repo.getUnstagedChanges(), []);
    });
  });

  describe('maintaining discard history across repository instances', function() {
    it('restores the history', async function() {
      const workingDirPath = await cloneRepository('three-files');
      const repo1 = new Repository(workingDirPath);
      await repo1.getLoadPromise();

      fs.writeFileSync(path.join(workingDirPath, 'a.txt'), 'qux\nfoo\nbar\n', 'utf8');
      fs.writeFileSync(path.join(workingDirPath, 'b.txt'), 'woohoo', 'utf8');
      fs.writeFileSync(path.join(workingDirPath, 'c.txt'), 'yayeah', 'utf8');

      const isSafe = () => true;
      await repo1.storeBeforeAndAfterBlobs(['a.txt'], isSafe, () => {
        fs.writeFileSync(path.join(workingDirPath, 'a.txt'), 'foo\nbar\n', 'utf8');
      }, 'a.txt');
      await repo1.storeBeforeAndAfterBlobs(['b.txt', 'c.txt'], isSafe, () => {
        fs.writeFileSync(path.join(workingDirPath, 'b.txt'), 'woot', 'utf8');
        fs.writeFileSync(path.join(workingDirPath, 'c.txt'), 'yup', 'utf8');
      });
      const repo1HistorySha = repo1.createDiscardHistoryBlob();

      const repo2 = new Repository(workingDirPath);
      await repo2.getLoadPromise();
      const repo2HistorySha = repo2.createDiscardHistoryBlob();

      assert.deepEqual(repo2HistorySha, repo1HistorySha);
    });

    it('is resilient to missing history blobs', async function() {
      const workingDirPath = await cloneRepository('three-files');
      const repo1 = new Repository(workingDirPath);
      await repo1.getLoadPromise();
      await repo1.setConfig('atomGithub.historySha', '1111111111111111111111111111111111111111');

      // Should not throw
      await repo1.updateDiscardHistory();

      // Also should not throw
      const repo2 = new Repository(workingDirPath);
      await repo2.getLoadPromise();
    });
  });

  describe('cache invalidation', function() {
    function getCacheReaderMethods(options) {
      const repository = options.repository;
      const calls = new Map();

      calls.set('getStatusesForChangedFiles', () => repository.getStatusesForChangedFiles());
      calls.set('getStagedChangesSinceParentCommit', () => repository.getStagedChangesSinceParentCommit());
      calls.set('getLastCommit', () => repository.getLastCommit());
      calls.set('getBranches', () => repository.getBranches());
      calls.set('getCurrentBranch', () => repository.getCurrentBranch());
      calls.set('getRemotes', () => repository.getRemotes());

      const withFile = fileName => {
        calls.set(
          `getFilePatchForPath {unstaged} ${fileName}`,
          () => repository.getFilePatchForPath(fileName, {staged: false}),
        );
        calls.set(
          `getFilePatchForPath {staged} ${fileName}`,
          () => repository.getFilePatchForPath(fileName, {staged: true}),
        );
        calls.set(
          `getFilePatchForPath {staged, amending} ${fileName}`,
          () => repository.getFilePatchForPath(fileName, {staged: true, amending: true}),
        );
        calls.set(`readFileFromIndex ${fileName}`, () => repository.readFileFromIndex(fileName));
      };

      for (const fileName of (options.files || [])) {
        withFile(fileName);
      }

      const withBranch = (branchName, description) => {
        calls.set(`getAheadCount ${description}`, () => repository.getAheadCount(branchName));
        calls.set(`getBehindCount ${description}`, () => repository.getBehindCount(branchName));
      };

      if (options.changedBranch) {
        withBranch(options.changedBranch);
      }
      if (options.unchangedBranch) {
        withBranch(options.unchangedBranch);
      }

      for (const optionName of (options.optionNames || [])) {
        calls.set(`getConfig ${optionName}`, () => repository.getConfig(optionName));
        calls.set(`getConfig {local} ${optionName}`, () => repository.getConfig(optionName, {local: true}));
      }

      return calls;
    }

    /**
     * Ensure that the correct cache keys are invalidated by a Repository operation.
     */
    async function assertCorrectInvalidation(options, operation) {
      const methods = getCacheReaderMethods(options);
      for (const opName of (options.skip || [])) {
        methods.delete(opName);
      }

      const record = () => {
        const results = new Map();
        for (const [name, call] of methods) {
          results.set(name, call());
        }
        return results;
      };

      const invalidatedKeys = (mapA, mapB) => {
        const allKeys = Array.from(mapA.keys());
        assert.sameMembers(allKeys, Array.from(mapB.keys()));

        return new Set(
          allKeys.filter(key => mapA.get(key) !== mapB.get(key)),
        );
      };

      const changedKeys = async (mapA, mapB) => {
        const allKeys = Array.from(mapA.keys());
        assert.sameMembers(allKeys, Array.from(mapB.keys()));

        const syncResults = await Promise.all(
          allKeys.map(async key => {
            return {
              key,
              aSync: await mapA.get(key).catch(e => e),
              bSync: await mapB.get(key).catch(e => e),
            };
          }),
        );

        return new Set(
          syncResults
            .filter(({aSync, bSync}) => !isEqual(aSync, bSync))
            .map(({key}) => key),
        );
      };

      const before = record();
      await operation();
      const cached = record();

      options.repository.state.cache.clear();
      const after = await record();

      const expected = await changedKeys(before, after);
      const actual = invalidatedKeys(before, cached);
      const {added, removed} = compareSets(expected, actual);

      if (options.expected) {
        for (const opName of options.expected) {
          added.delete(opName);
        }
      }

      /* eslint-disable no-console */
      if (added.size > 0 && (options.strict || options.verbose)) {
        console.log('These cached method results were invalidated, but should not have been:');

        for (const key of added) {
          console.log(` ${key}:`);
          console.log('  before:', before.get(key));
          console.log('  cached:', cached.get(key));
          console.log('   after:', after.get(key));
        }
      }

      if (removed.size > 0) {
        console.log('These cached method results should have been invalidated, but were not:');
        for (const key of removed) {
          console.log(` ${key}:`);
          console.log('  before:', before.get(key));
          console.log('  cached:', cached.get(key));
          console.log('   after:', after.get(key));
        }
      }
      /* eslint-enable no-console */

      if (options.strict) {
        assert.isTrue(added.size === 0 && removed.size === 0, 'invalidated different method results');
      } else {
        assert.isTrue(removed.size === 0, 'bzzzt, inadequate cache busting detected');
      }
    }

    describe('from method calls', function() {
      it('when staging files', async function() {
        const workdir = await cloneRepository('multi-commits-files');
        const repository = new Repository(workdir);
        await repository.getLoadPromise();

        const changedFile = 'a.txt';
        const unchangedFile = 'b.txt';

        await writeFile(path.join(workdir, changedFile), 'bar\nbar-1\n');

        const files = [changedFile, unchangedFile];
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.stageFiles([changedFile]);
        });
      });

      it('when unstaging files', async function() {
        const workdir = await cloneRepository('multi-commits-files');
        const repository = new Repository(workdir);
        await repository.getLoadPromise();

        const changedFile = 'a.txt';
        const unchangedFile = 'b.txt';

        await writeFile(path.join(workdir, changedFile), 'bar\nbaz\n');
        await repository.stageFiles([changedFile]);

        const files = [changedFile, unchangedFile];
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.unstageFiles([changedFile]);
        });
      });

      it('when staging files from a parent commit', async function() {
        const workdir = await cloneRepository('multi-commits-files');
        const repository = new Repository(workdir);
        await repository.getLoadPromise();

        const changedFile = 'a.txt';
        const unchangedFile = 'b.txt';

        await writeFile(path.join(workdir, changedFile), 'bar\nbaz\n');
        await repository.stageFiles([changedFile]);

        const files = [changedFile, unchangedFile];
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.stageFilesFromParentCommit([changedFile]);
        });
      });

      it('when applying a patch to the index', async function() {
        const workdir = await cloneRepository('multi-commits-files');
        const repository = new Repository(workdir);
        await repository.getLoadPromise();

        const changedFile = 'a.txt';
        const unchangedFile = 'b.txt';

        await writeFile(path.join(workdir, changedFile), 'foo\nfoo-1\n');
        const patch = await repository.getFilePatchForPath(changedFile);
        await writeFile(path.join(workdir, changedFile), 'foo\nfoo-1\nfoo-2\n');

        const files = [changedFile, unchangedFile];
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.applyPatchToIndex(patch);
        });
      });

      it('when applying a patch to the working directory', async function() {
        const workdir = await cloneRepository('multi-commits-files');
        const repository = new Repository(workdir);
        await repository.getLoadPromise();

        const changedFile = 'a.txt';
        const unchangedFile = 'b.txt';

        await writeFile(path.join(workdir, changedFile), 'foo\nfoo-1\n');
        const patch = (await repository.getFilePatchForPath(changedFile)).getUnstagePatch();

        const files = [changedFile, unchangedFile];
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.applyPatchToWorkdir(patch);
        });
      });

      it('when committing', async function() {
        const workdir = await cloneRepository('multi-commits-files');
        const repository = new Repository(workdir);
        await repository.getLoadPromise();

        const changedFile = 'b.txt';
        await writeFile(path.join(workdir, changedFile), 'foo\nfoo-1\nfoo-2\n');
        await repository.stageFiles([changedFile]);

        const files = [changedFile];
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.commit('message');
        });
      });

      it('when merging', async function() {
        const workdir = await cloneRepository('merge-conflict');
        const repository = new Repository(workdir);
        await repository.getLoadPromise();

        const skip = [
          'readFileFromIndex modified-on-both-ours.txt',
        ];
        const expected = [
          'getLastCommit', // Needs to be invalidated when the commit succeeds
        ];
        const files = ['modified-on-both-ours.txt'];
        await assertCorrectInvalidation({repository, files, expected, skip}, async () => {
          await assert.isRejected(repository.merge('origin/branch'));
        });
      });

      it('when aborting a merge', async function() {
        const workdir = await cloneRepository('merge-conflict');
        const repository = new Repository(workdir);
        await repository.getLoadPromise();
        await assert.isRejected(repository.merge('origin/branch'));

        const stagedFile = 'modified-on-both-ours.txt';
        await repository.stageFiles([stagedFile]);

        const expected = [
          'getFilePatchForPath {unstaged} modified-on-both-ours.txt',
        ];
        const files = [stagedFile];
        await assertCorrectInvalidation({repository, files, expected}, async () => {
          await repository.abortMerge();
        });
      });

      it('when writing a merge conflict to the index');

      it('when checking out a revision', async function() {
        const workdir = await cloneRepository('multi-commits-files');
        const repository = new Repository(workdir);
        await repository.getLoadPromise();

        const skip = [
          'getFilePatchForPath {staged, amending} b.txt',
        ];
        const files = ['b.txt'];
        await assertCorrectInvalidation({repository, files, skip}, async () => {
          await repository.checkout('HEAD^');
        });
      });

      it('when checking out paths', async function() {
        const workdir = await cloneRepository('multi-commits-files');
        const repository = new Repository(workdir);
        await repository.getLoadPromise();

        const changedFile = 'b.txt';
        const unchangedFile = 'c.txt';

        const files = [changedFile, unchangedFile];
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.checkoutPathsAtRevision([changedFile], 'HEAD^');
        });
      });

      it('when fetching', async function() {
        const {localRepoPath} = await setUpLocalAndRemoteRepositories();
        const repository = new Repository(localRepoPath);
        await repository.getLoadPromise();

        await repository.commit('wat', {allowEmpty: true});
        await repository.commit('huh', {allowEmpty: true});

        await assertCorrectInvalidation({repository}, async () => {
          await repository.fetch('master');
        });
      });

      it('when pulling', async function() {
        const {localRepoPath} = await setUpLocalAndRemoteRepositories({remoteAhead: true});
        const repository = new Repository(localRepoPath);
        await repository.getLoadPromise();

        await writeFile(path.join(localRepoPath, 'new-file.txt'), 'one\n');
        await repository.stageFiles(['new-file.txt']);
        await repository.commit('wat');

        const expected = [
          'getStatusesForChangedFiles',
          'readFileFromIndex new-file.txt',
        ];
        const files = ['new-file.txt', 'file.txt'];
        await assertCorrectInvalidation({repository, files, expected}, async () => {
          await repository.pull('master');
        });
      });

      it('when pushing', async function() {
        const {localRepoPath} = await setUpLocalAndRemoteRepositories();
        const repository = new Repository(localRepoPath);
        await repository.getLoadPromise();

        await writeFile(path.join(localRepoPath, 'new-file.txt'), 'one\n');
        await repository.stageFiles(['new-file.txt']);
        await repository.commit('wat');

        const files = ['new-file.txt', 'file.txt'];
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.push('master');
        });
      });

      it('when setting a config option', async function() {
        const workdir = await cloneRepository('three-files');
        const repository = new Repository(workdir);
        await repository.getLoadPromise();

        const optionNames = ['core.editor', 'color.ui'];
        await assertCorrectInvalidation({repository, optionNames}, async () => {
          await repository.setConfig('core.editor', 'atom --wait #obvs');
        });
      });

      it('when discarding working directory changes', async function() {
        const workdir = await cloneRepository('multi-commits-files');
        const repository = new Repository(workdir);
        await repository.getLoadPromise();

        await Promise.all([
          writeFile(path.join(workdir, 'a.txt'), 'aaa\n'),
          writeFile(path.join(workdir, 'c.txt'), 'baz\n'),
        ]);

        const files = ['a.txt', 'b.txt', 'c.txt'];
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.discardWorkDirChangesForPaths(['a.txt', 'c.txt']);
        });
      });
    });

    describe('from filesystem events', function() {
      let workdir, sub;
      let observedEvents, eventCallback;

      async function wireUpObserver(fixtureName = 'multi-commits-files', existingWorkdir = null) {
        observedEvents = [];
        eventCallback = () => {};

        workdir = existingWorkdir || await cloneRepository(fixtureName);
        const repository = new Repository(workdir);
        await repository.getLoadPromise();

        const observer = new FileSystemChangeObserver(repository);

        sub = new CompositeDisposable(
          new Disposable(async () => {
            await observer.destroy();
            repository.destroy();
          }),
        );

        sub.add(observer.onDidChange(events => {
          repository.observeFilesystemChange(events);
          observedEvents.push(...events);
          eventCallback();
        }));

        return {repository, observer};
      }

      function expectEvents(...fileNames) {
        return new Promise((resolve, reject) => {
          eventCallback = () => {
            const observedFileNames = new Set(observedEvents.map(event => event.file || event.newFile));
            if (fileNames.every(fileName => observedFileNames.has(fileName))) {
              resolve();
            }
          };

          if (observedEvents.length > 0) {
            eventCallback();
          }
        });
      }

      afterEach(function() {
        sub && sub.dispose();
      });

      it('when staging files', async function() {
        const {repository, observer} = await wireUpObserver();

        await writeFile(path.join(workdir, 'a.txt'), 'boop\n');

        const files = ['a.txt'];
        await observer.start();
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.git.stageFiles(['a.txt']);
          await expectEvents('index');
        });
      });

      it('when unstaging files', async function() {
        const {repository, observer} = await wireUpObserver();

        await writeFile(path.join(workdir, 'a.txt'), 'boop\n');
        await repository.git.stageFiles(['a.txt']);

        const files = ['a.txt'];
        await observer.start();
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.git.unstageFiles(['a.txt']);
          await expectEvents('index');
        });
      });

      it('when staging files from a parent commit', async function() {
        const {repository, observer} = await wireUpObserver();

        const files = ['a.txt'];
        await observer.start();
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.git.unstageFiles(['a.txt'], 'HEAD~');
          await expectEvents('index');
        });
      });

      it('when applying a patch to the index', async function() {
        const {repository, observer} = await wireUpObserver();

        await writeFile(path.join(workdir, 'a.txt'), 'boop\n');
        const patch = await repository.getFilePatchForPath('a.txt');

        const files = ['a.txt'];
        await observer.start();
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.git.applyPatch(patch.getHeaderString() + patch.toString(), {index: true});
          await expectEvents('index');
        });
      });

      it('when applying a patch to the working directory', async function() {
        const {repository, observer} = await wireUpObserver();

        await writeFile(path.join(workdir, 'a.txt'), 'boop\n');
        const patch = (await repository.getFilePatchForPath('a.txt')).getUnstagePatch();

        const files = ['a.txt'];
        await observer.start();
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.git.applyPatch(patch.getHeaderString() + patch.toString());
          await expectEvents('a.txt');
        });
      });

      it('when committing', async function() {
        const {repository, observer} = await wireUpObserver();

        await writeFile(path.join(workdir, 'a.txt'), 'boop\n');
        await repository.stageFiles(['a.txt']);

        const files = ['a.txt'];
        await observer.start();
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.git.commit('boop your snoot');
          await expectEvents('index', 'master');
        });
      });

      it('when merging', async function() {
        const {repository, observer} = await wireUpObserver('merge-conflict');

        const skip = [
          'readFileFromIndex modified-on-both-ours.txt',
        ];
        const files = ['modified-on-both-ours.txt'];
        await observer.start();
        await assertCorrectInvalidation({repository, files, skip}, async () => {
          await assert.isRejected(repository.git.merge('origin/branch'));
          await expectEvents('index', 'modified-on-both-ours.txt', 'MERGE_HEAD');
        });
      });

      it('when aborting a merge', async function() {
        const {repository, observer} = await wireUpObserver('merge-conflict');
        await assert.isRejected(repository.merge('origin/branch'));

        const skip = [
          'readFileFromIndex modified-on-both-ours.txt',
        ];
        const files = ['modified-on-both-ours.txt'];
        await observer.start();
        await assertCorrectInvalidation({repository, files, skip}, async () => {
          await repository.git.abortMerge();
          await expectEvents('index', 'modified-on-both-ours.txt', 'MERGE_HEAD', 'HEAD');
        });
      });

      it('when writing a merge conflict to the index');

      it('when checking out a revision', async function() {
        const {repository, observer} = await wireUpObserver();

        const skip = [
          'getFilePatchForPath {staged, amending} b.txt',
        ];
        const files = ['b.txt'];
        await observer.start();
        await assertCorrectInvalidation({repository, files, skip}, async () => {
          await repository.git.checkout('HEAD^');
          await expectEvents('index', 'HEAD', 'b.txt', 'c.txt');
        });
      });

      it('when checking out paths', async function() {
        const {repository, observer} = await wireUpObserver();

        const files = ['b.txt', 'c.txt'];

        await observer.start();
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.git.checkoutFiles(['b.txt'], 'HEAD^');
          await expectEvents('b.txt', 'index');
        });
      });

      it('when fetching', async function() {
        const {localRepoPath} = await setUpLocalAndRemoteRepositories({remoteAhead: true});
        const {repository, observer} = await wireUpObserver(null, localRepoPath);

        await repository.commit('wat', {allowEmpty: true});
        await repository.commit('huh', {allowEmpty: true});

        await observer.start();
        await assertCorrectInvalidation({repository}, async () => {
          await repository.git.fetch('origin', 'master');
          await expectEvents('master');
        });
      });

      it('when pulling', async function() {
        const {localRepoPath} = await setUpLocalAndRemoteRepositories({remoteAhead: true});
        const {repository, observer} = await wireUpObserver(null, localRepoPath);

        await writeFile(path.join(localRepoPath, 'file.txt'), 'one\n');
        await repository.stageFiles(['file.txt']);
        await repository.commit('wat');

        const skip = [
          'readFileFromIndex file.txt',
        ];
        const files = ['file.txt'];
        await observer.start();
        await assertCorrectInvalidation({repository, files, skip}, async () => {
          await assert.isRejected(repository.git.pull('origin', 'master'));
          await expectEvents('file.txt', 'master', 'MERGE_HEAD', 'index');
        });
      });

      it('when pushing', async function() {
        const {localRepoPath} = await setUpLocalAndRemoteRepositories();
        const {repository, observer} = await wireUpObserver(null, localRepoPath);

        await writeFile(path.join(localRepoPath, 'new-file.txt'), 'one\n');
        await repository.stageFiles(['new-file.txt']);
        await repository.commit('wat');

        const files = ['new-file.txt', 'file.txt'];
        await observer.start();
        await assertCorrectInvalidation({repository, files}, async () => {
          await repository.git.push('origin', 'master');
          await expectEvents('master');
        });
      });

      it('when setting a config option', async function() {
        const {repository, observer} = await wireUpObserver();

        const optionNames = ['core.editor', 'color.ui'];
        await observer.start();
        await assertCorrectInvalidation({repository, optionNames}, async () => {
          await repository.git.setConfig('core.editor', 'ed # :trollface:');
          await expectEvents('config');
        });
      });

      it('when changing files in the working directory', async function() {
        const {repository, observer} = await wireUpObserver();

        await observer.start();
        const files = ['b.txt'];
        await assertCorrectInvalidation({repository, files}, async () => {
          await writeFile(path.join(workdir, 'b.txt'), 'new contents\n');
          await expectEvents('b.txt');
        });
      });
    });
  });
});
