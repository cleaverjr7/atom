import fs from 'fs-extra';
import path from 'path';
import temp from 'temp';
import until from 'test-until';

import {cloneRepository, disableFilesystemWatchers} from './helpers';
import {fileExists, getTempDir} from '../lib/helpers';
import GithubPackage from '../lib/github-package';

describe('GithubPackage', function() {
  let atomEnv, workspace, project, commands, notificationManager, grammars, config, keymaps;
  let confirm, tooltips, styles;
  let getLoadSettings, currentWindow, configDirPath, deserializers;
  let githubPackage, contextPool;

  beforeEach(async function() {
    atomEnv = global.buildAtomEnvironment();
    await disableFilesystemWatchers(atomEnv);

    workspace = atomEnv.workspace;
    project = atomEnv.project;
    commands = atomEnv.commands;
    deserializers = atomEnv.deserializers;
    notificationManager = atomEnv.notifications;
    tooltips = atomEnv.tooltips;
    config = atomEnv.config;
    keymaps = atomEnv.keymaps;
    confirm = atomEnv.confirm.bind(atomEnv);
    styles = atomEnv.styles;
    grammars = atomEnv.grammars;
    getLoadSettings = atomEnv.getLoadSettings.bind(atomEnv);
    currentWindow = atomEnv.getCurrentWindow();
    configDirPath = path.join(__dirname, 'fixtures', 'atomenv-config');

    githubPackage = new GithubPackage({
      workspace, project, commands, notificationManager, tooltips, styles, grammars,
      keymaps, config, deserializers,
      confirm, getLoadSettings, currentWindow,
      configDirPath,
      renderFn: sinon.stub().callsFake((component, element, callback) => {
        if (callback) {
          process.nextTick(callback);
        }
      }),
    });

    contextPool = githubPackage.getContextPool();
  });

  afterEach(async function() {
    await githubPackage.deactivate();

    atomEnv.destroy();
  });

  async function contextUpdateAfter(chunk) {
    const updatePromise = githubPackage.getSwitchboard().getFinishActiveContextUpdatePromise();
    await chunk();
    return updatePromise;
  }

  describe('construction', function() {
    let githubPackage1;

    afterEach(async function() {
      if (githubPackage1) {
        await githubPackage1.deactivate();
      }
    });

    async function constructWith(projectPaths, initialPaths) {
      const realProjectPaths = await Promise.all(
        projectPaths.map(projectPath => getTempDir({prefix: projectPath})),
      );

      project.setPaths(realProjectPaths);
      const getLoadSettings1 = () => ({initialPaths});

      githubPackage1 = new GithubPackage({
        workspace, project, commands, notificationManager, tooltips, styles, grammars, keymaps,
        config, deserializers, confirm, getLoadSettings: getLoadSettings1, currentWindow,
        configDirPath,
      });
    }

    function assertAbsentLike() {
      const repository = githubPackage1.getActiveRepository();
      assert.isTrue(repository.isUndetermined());
      assert.isFalse(repository.showGitTabLoading());
      assert.isTrue(repository.showGitTabInit());
    }

    function assertLoadingLike() {
      const repository = githubPackage1.getActiveRepository();
      assert.isTrue(repository.isUndetermined());
      assert.isTrue(repository.showGitTabLoading());
      assert.isFalse(repository.showGitTabInit());
    }

    it('with no projects or initial paths begins with an absent-like undetermined context', async function() {
      await constructWith([], []);
      assertAbsentLike();
    });

    it('with one existing project begins with a loading-like undetermined context', async function() {
      await constructWith(['one'], []);
      assertLoadingLike();
    });

    it('with several existing projects begins with an absent-like undetermined context', async function() {
      await constructWith(['one', 'two'], []);
      assertAbsentLike();
    });

    it('with no projects but one initial path begins with a loading-like undetermined context', async function() {
      await constructWith([], ['one']);
      assertLoadingLike();
    });

    it('with no projects and several initial paths begins with an absent-like undetermined context', async function() {
      await constructWith([], ['one', 'two']);
      assertAbsentLike();
    });

    it('with one project and initial paths begins with a loading-like undetermined context', async function() {
      await constructWith(['one'], ['two', 'three']);
      assertLoadingLike();
    });

    it('with several projects and an initial path begins with an absent-like undetermined context', async function() {
      await constructWith(['one', 'two'], ['three']);
      assertAbsentLike();
    });
  });

  describe('activate()', function() {
    it('begins with an undetermined repository context', async function() {
      await contextUpdateAfter(() => githubPackage.activate());

      assert.isTrue(githubPackage.getActiveRepository().isUndetermined());
    });

    it('uses models from preexisting projects', async function() {
      const [workdirPath1, workdirPath2, nonRepositoryPath] = await Promise.all([
        cloneRepository('three-files'),
        cloneRepository('three-files'),
        getTempDir(),
      ]);
      project.setPaths([workdirPath1, workdirPath2, nonRepositoryPath]);

      await contextUpdateAfter(() => githubPackage.activate());

      assert.isTrue(contextPool.getContext(workdirPath1).isPresent());
      assert.isTrue(contextPool.getContext(workdirPath2).isPresent());
      assert.isTrue(contextPool.getContext(nonRepositoryPath).isPresent());
    });

    context('uses an active model', function() {
      specify('from a single preexisting project', async function() {
        const workdirPath = await cloneRepository('three-files');
        project.setPaths([workdirPath]);

        await contextUpdateAfter(() => githubPackage.activate());

        const context = contextPool.getContext(workdirPath);
        assert.isTrue(context.isPresent());

        assert.strictEqual(context.getRepository(), githubPackage.getActiveRepository());
        assert.strictEqual(context.getResolutionProgress(), githubPackage.getActiveResolutionProgress());
        assert.equal(githubPackage.getActiveWorkdir(), workdirPath);
      });

      specify('from the first working directory when multiple are availible and no preference is set', async function() {
        const [workdirPath1, workdirPath2] = await Promise.all([
          cloneRepository('three-files'),
          cloneRepository('three-files'),
        ]);
        project.setPaths([workdirPath1, workdirPath2]);

        await contextUpdateAfter(() => githubPackage.activate());

        const context = contextPool.getContext(workdirPath1);
        assert.isTrue(context.isPresent());
        assert.strictEqual(context.getRepository(), githubPackage.getActiveRepository());
        assert.strictEqual(context.getResolutionProgress(), githubPackage.getActiveResolutionProgress());
        assert.equal(githubPackage.getActiveWorkdir(), workdirPath1);
      });

      specify('from serialized state', async function() {
        const [workdirPath1, workdirPath2, workdirPath3] = await Promise.all([
          cloneRepository('three-files'),
          cloneRepository('three-files'),
          cloneRepository('three-files'),
        ]);
        project.setPaths([workdirPath1, workdirPath2, workdirPath3]);

        await contextUpdateAfter(() => githubPackage.activate({
          activeRepositoryPath: workdirPath2,
        }));

        const context = contextPool.getContext(workdirPath2);
        assert.isTrue(context.isPresent());
        assert.strictEqual(context.getRepository(), githubPackage.getActiveRepository());
        assert.strictEqual(context.getResolutionProgress(), githubPackage.getActiveResolutionProgress());
        assert.equal(githubPackage.getActiveWorkdir(), workdirPath2);
      });
    });

    it('prefers the active model from serialized state to first working directory', async function() {
      const [workdirPath1, workdirPath2] = await Promise.all([
        cloneRepository('three-files'),
        cloneRepository('three-files'),
      ]);
      project.setPaths([workdirPath1, workdirPath2]);

      await contextUpdateAfter(() => githubPackage.activate({
        activeRepositoryPath: workdirPath2,
      }));

      const context = contextPool.getContext(workdirPath2);
      assert.isTrue(context.isPresent());
      assert.strictEqual(context.getRepository(), githubPackage.getActiveRepository());
      assert.strictEqual(context.getResolutionProgress(), githubPackage.getActiveResolutionProgress());
      assert.equal(githubPackage.getActiveWorkdir(), workdirPath2);
    });

    it('prefers the active model from a single project to non-active serialized state', async function() {
      const [workdirPath1, workdirPath2] = await Promise.all([
        cloneRepository('three-files'),
        cloneRepository('three-files'),
      ]);
      project.setPaths([workdirPath1]);

      await contextUpdateAfter(() => githubPackage.activate({
        activeRepositoryPath: workdirPath2,
      }));

      const context = contextPool.getContext(workdirPath1);
      assert.isTrue(context.isPresent());
      assert.strictEqual(context.getRepository(), githubPackage.getActiveRepository());
      assert.strictEqual(context.getResolutionProgress(), githubPackage.getActiveResolutionProgress());
      assert.equal(githubPackage.getActiveWorkdir(), workdirPath1);
    });

    it('restores the active resolution progress', async function() {
      // Repository with a merge conflict, repository without a merge conflict, path without a repository
      const workdirMergeConflict = await cloneRepository('merge-conflict');
      const workdirNoConflict = await cloneRepository('three-files');
      const nonRepositoryPath = await fs.realpath(temp.mkdirSync());
      fs.writeFileSync(path.join(nonRepositoryPath, 'c.txt'));

      project.setPaths([workdirMergeConflict, workdirNoConflict, nonRepositoryPath]);
      await contextUpdateAfter(() => githubPackage.activate());

      // Switch to the merge conflict repository.
      // Equivalent of user choosing a different project
      await githubPackage.scheduleActiveContextUpdate({activeRepositoryPath: workdirMergeConflict});

      const resolutionMergeConflict = contextPool.getContext(workdirMergeConflict).getResolutionProgress();
      await assert.strictEqual(githubPackage.getActiveResolutionProgress(), resolutionMergeConflict);

      // Record some resolution progress to recall later
      resolutionMergeConflict.reportMarkerCount('modified-on-both-ours.txt', 3);

      // Switch to the non-merge conflict repository.
      // Equivalent of user choosing a different project
      await githubPackage.scheduleActiveContextUpdate({activeRepositoryPath: workdirNoConflict});

      const resolutionNoConflict = contextPool.getContext(workdirNoConflict).getResolutionProgress();
      assert.strictEqual(githubPackage.getActiveResolutionProgress(), resolutionNoConflict);
      assert.isTrue(githubPackage.getActiveResolutionProgress().isEmpty());

      // Switch to the workdir with no repository.
      // Equivalent of user choosing a different project
      await githubPackage.scheduleActiveContextUpdate({activeRepositoryPath: nonRepositoryPath});

      assert.isTrue(githubPackage.getActiveResolutionProgress().isEmpty());

      // Switch back to the merge conflict repository.
      // Equivalent of user choosing a different project
      await githubPackage.scheduleActiveContextUpdate({activeRepositoryPath: workdirMergeConflict});

      assert.strictEqual(githubPackage.getActiveResolutionProgress(), resolutionMergeConflict);
      assert.isFalse(githubPackage.getActiveResolutionProgress().isEmpty());
      assert.equal(githubPackage.getActiveResolutionProgress().getRemaining('modified-on-both-ours.txt'), 3);
    });

    describe('startOpen and startRevealed', function() {
      let confFile;

      beforeEach(async function() {
        confFile = path.join(configDirPath, 'github.cson');
        await fs.remove(confFile);
      });

      it('renders with startOpen and startRevealed on the first run with the welcome package dismissed', async function() {
        config.set('welcome.showOnStartup', false);
        await githubPackage.activate();

        assert.isTrue(githubPackage.startOpen);
        assert.isTrue(githubPackage.startRevealed);
        assert.isTrue(await fileExists(confFile));
      });

      it('renders with startOpen but not startRevealed on the first run with the welcome package undismissed', async function() {
        config.set('welcome.showOnStartup', true);
        await githubPackage.activate();

        assert.isTrue(githubPackage.startOpen);
        assert.isFalse(githubPackage.startRevealed);
        assert.isTrue(await fileExists(confFile));
      });

      it('renders with startOpen but not startRevealed on non-first runs on new projects', async function() {
        await fs.writeFile(confFile, '', {encoding: 'utf8'});
        await githubPackage.activate();

        assert.isTrue(githubPackage.startOpen);
        assert.isFalse(githubPackage.startRevealed);
        assert.isTrue(await fileExists(confFile));
      });

      it('renders without startOpen or startRevealed on non-first runs on existing projects', async function() {
        await fs.writeFile(confFile, '', {encoding: 'utf8'});
        await githubPackage.activate({newProject: false});

        assert.isFalse(githubPackage.startOpen);
        assert.isFalse(githubPackage.startRevealed);
        assert.isTrue(await fileExists(confFile));
      });
    });
  });

  describe('when the project paths change', function() {
    it('adds new workdirs to the pool', async function() {
      const [workdirPath1, workdirPath2, workdirPath3] = await Promise.all([
        cloneRepository('three-files'),
        cloneRepository('three-files'),
        cloneRepository('three-files'),
      ]);

      project.setPaths([workdirPath1, workdirPath2]);
      await contextUpdateAfter(() => githubPackage.activate());

      assert.isTrue(contextPool.getContext(workdirPath1).isPresent());
      assert.isTrue(contextPool.getContext(workdirPath2).isPresent());
      assert.isFalse(contextPool.getContext(workdirPath3).isPresent());

      await contextUpdateAfter(() => project.setPaths([workdirPath1, workdirPath2, workdirPath3]));

      assert.isTrue(contextPool.getContext(workdirPath1).isPresent());
      assert.isTrue(contextPool.getContext(workdirPath2).isPresent());
      assert.isTrue(contextPool.getContext(workdirPath3).isPresent());
    });

    it('destroys contexts associated with the removed project folders', async function() {
      const [workdirPath1, workdirPath2, workdirPath3] = await Promise.all([
        cloneRepository('three-files'),
        cloneRepository('three-files'),
        cloneRepository('three-files'),
      ]);
      project.setPaths([workdirPath1, workdirPath2, workdirPath3]);
      await contextUpdateAfter(() => githubPackage.activate());

      const [repository1, repository2, repository3] = [workdirPath1, workdirPath2, workdirPath3].map(workdir => {
        return contextPool.getContext(workdir).getRepository();
      });

      sinon.stub(repository1, 'destroy');
      sinon.stub(repository2, 'destroy');
      sinon.stub(repository3, 'destroy');

      await contextUpdateAfter(() => project.removePath(workdirPath1));
      await contextUpdateAfter(() => project.removePath(workdirPath3));

      assert.equal(repository1.destroy.callCount, 1);
      assert.equal(repository3.destroy.callCount, 1);
      assert.isFalse(repository2.destroy.called);

      assert.isFalse(contextPool.getContext(workdirPath1).isPresent());
      assert.isFalse(contextPool.getContext(workdirPath3).isPresent());
      assert.isTrue(contextPool.getContext(workdirPath2).isPresent());
    });

    it('returns to an absent context when the last project folder is removed', async function() {
      const workdirPath = await cloneRepository('three-files');
      project.setPaths([workdirPath]);
      await contextUpdateAfter(() => githubPackage.activate());

      assert.isTrue(githubPackage.getActiveRepository().isLoading() || githubPackage.getActiveRepository().isPresent());

      await contextUpdateAfter(() => project.setPaths([]));

      assert.isTrue(githubPackage.getActiveRepository().isAbsent());
    });

    it('does not transition away from an absent guess when no project folders are present', async function() {
      await contextUpdateAfter(() => githubPackage.activate());

      assert.isTrue(githubPackage.getActiveRepository().isAbsentGuess());
    });
  });

  describe('scheduleActiveContextUpdate()', function() {
    beforeEach(function() {
      // Necessary since we skip activate()
      githubPackage.savedState = {};
      githubPackage.useLegacyPanels = !workspace.getLeftDock;
    });

    it('prefers the context of the first working directory', async function() {
      const [workdirPath1, workdirPath2, workdirPath3] = await Promise.all([
        cloneRepository('three-files'),
        cloneRepository('three-files'),
        cloneRepository('three-files'),
      ]);
      project.setPaths([workdirPath1, workdirPath2]);

      await githubPackage.scheduleActiveContextUpdate({
        activeRepositoryPath: workdirPath3,
      });

      assert.equal(githubPackage.getActiveWorkdir(), workdirPath1);
    });

    it('uses an absent context when the active item is not in a git repository', async function() {
      const nonRepositoryPath = await fs.realpath(temp.mkdirSync());
      const workdir = await cloneRepository('three-files');
      project.setPaths([nonRepositoryPath, workdir]);
      await fs.writeFile(path.join(nonRepositoryPath, 'a.txt'), 'stuff', {encoding: 'utf8'});

      await workspace.open(path.join(nonRepositoryPath, 'a.txt'));

      await githubPackage.scheduleActiveContextUpdate();

      assert.isTrue(githubPackage.getActiveRepository().isAbsent());
    });

    it('uses the context of the PaneItem active in the workspace center', async function() {
      if (!workspace.getLeftDock) {
        this.skip();
      }

      const [workdir0, workdir1] = await Promise.all([
        cloneRepository('three-files'),
        cloneRepository('three-files'),
      ]);
      project.setPaths([workdir1]);

      await workspace.open(path.join(workdir0, 'a.txt'));
      commands.dispatch(atomEnv.views.getView(workspace), 'tree-view:toggle-focus');
      workspace.getLeftDock().activate();

      await githubPackage.scheduleActiveContextUpdate();

      assert.equal(githubPackage.getActiveWorkdir(), workdir0);
    });

    it('uses the context of a single open project', async function() {
      const [workdirPath1, workdirPath2] = await Promise.all([
        cloneRepository('three-files'),
        cloneRepository('three-files'),
      ]);
      project.setPaths([workdirPath1]);

      await githubPackage.scheduleActiveContextUpdate({
        activeRepositoryPath: workdirPath2,
      });

      assert.equal(githubPackage.getActiveWorkdir(), workdirPath1);
    });

    it('uses an empty context with a single open project without a git workdir', async function() {
      const nonRepositoryPath = await getTempDir();
      project.setPaths([nonRepositoryPath]);

      await githubPackage.scheduleActiveContextUpdate();
      await githubPackage.getActiveRepository().getLoadPromise();

      assert.isTrue(contextPool.getContext(nonRepositoryPath).isPresent());
      assert.isTrue(githubPackage.getActiveRepository().isEmpty());
      assert.isFalse(githubPackage.getActiveRepository().isAbsent());
    });

    it('activates a saved context state', async function() {
      const [workdirPath1, workdirPath2] = await Promise.all([
        cloneRepository('three-files'),
        cloneRepository('three-files'),
      ]);
      project.setPaths([workdirPath1, workdirPath2]);

      await githubPackage.scheduleActiveContextUpdate({
        activeRepositoryPath: workdirPath2,
      });

      assert.equal(githubPackage.getActiveWorkdir(), workdirPath2);
    });

    it('falls back to keeping the context the same', async function() {
      const [workdirPath1, workdirPath2] = await Promise.all([
        cloneRepository('three-files'),
        cloneRepository('three-files'),
      ]);
      project.setPaths([workdirPath1, workdirPath2]);

      contextPool.set([workdirPath1, workdirPath2]);
      githubPackage.setActiveContext(contextPool.getContext(workdirPath1));

      await githubPackage.scheduleActiveContextUpdate();

      assert.equal(githubPackage.getActiveWorkdir(), workdirPath1);
    });

    it('discovers a context from an open subdirectory', async function() {
      const workdirPath = await cloneRepository('three-files');
      const projectPath = path.join(workdirPath, 'subdir-1');
      project.setPaths([projectPath]);

      await githubPackage.scheduleActiveContextUpdate();

      assert.equal(githubPackage.getActiveWorkdir(), workdirPath);
    });

    it('reverts to an empty context if the active repository is destroyed', async function() {
      const workdirPath = await cloneRepository('three-files');
      project.setPaths([workdirPath]);

      await githubPackage.scheduleActiveContextUpdate();

      assert.isTrue(contextPool.getContext(workdirPath).isPresent());
      const repository = contextPool.getContext(workdirPath).getRepository();

      repository.destroy();

      assert.isTrue(githubPackage.getActiveRepository().isAbsent());
    });

    // Don't worry about this on Windows as it's not a common op
    if (process.platform !== 'win32') {
      it('handles symlinked project paths', async function() {
        const workdirPath = await cloneRepository('three-files');
        const symlinkPath = (await fs.realpath(temp.mkdirSync())) + '-symlink';
        fs.symlinkSync(workdirPath, symlinkPath);
        project.setPaths([symlinkPath]);
        await workspace.open(path.join(symlinkPath, 'a.txt'));

        await githubPackage.scheduleActiveContextUpdate();
        await assert.async.isOk(githubPackage.getActiveRepository());
      });
    }
  });

  describe('when there is a change in the repository', function() {
    let workdirPath1, atomGitRepository1, repository1;
    let workdirPath2, atomGitRepository2, repository2;

    beforeEach(async function() {
      this.retries(5); // FLAKE

      [workdirPath1, workdirPath2] = await Promise.all([
        cloneRepository('three-files'),
        cloneRepository('three-files'),
      ]);

      fs.writeFileSync(path.join(workdirPath1, 'c.txt'), 'ch-ch-ch-changes', 'utf8');
      fs.writeFileSync(path.join(workdirPath2, 'c.txt'), 'ch-ch-ch-changes', 'utf8');

      project.setPaths([workdirPath1, workdirPath2]);
      await githubPackage.activate();

      const watcherPromises = [
        until(() => contextPool.getContext(workdirPath1).getChangeObserver().isStarted()),
        until(() => contextPool.getContext(workdirPath2).getChangeObserver().isStarted()),
      ];

      if (project.getWatcherPromise) {
        watcherPromises.push(project.getWatcherPromise(workdirPath1));
        watcherPromises.push(project.getWatcherPromise(workdirPath2));
      }

      await Promise.all(watcherPromises);

      [atomGitRepository1, atomGitRepository2] = githubPackage.project.getRepositories();
      sinon.stub(atomGitRepository1, 'refreshStatus');
      sinon.stub(atomGitRepository2, 'refreshStatus');

      repository1 = contextPool.getContext(workdirPath1).getRepository();
      repository2 = contextPool.getContext(workdirPath2).getRepository();
      sinon.stub(repository1, 'observeFilesystemChange');
      sinon.stub(repository2, 'observeFilesystemChange');
    });

    it('refreshes the appropriate Repository and Atom GitRepository when a file is changed in workspace 1', async function() {
      if (process.platform === 'linux') {
        this.skip();
      }
      this.retries(5); // FLAKE

      fs.writeFileSync(path.join(workdirPath1, 'a.txt'), 'some changes', 'utf8');

      await assert.async.isTrue(repository1.observeFilesystemChange.called);
      await assert.async.isTrue(atomGitRepository1.refreshStatus.called);
    });

    it('refreshes the appropriate Repository and Atom GitRepository when a file is changed in workspace 2', async function() {
      if (process.platform === 'linux') {
        this.skip();
      }
      this.retries(5); // FLAKE

      fs.writeFileSync(path.join(workdirPath2, 'b.txt'), 'other changes', 'utf8');

      await assert.async.isTrue(repository2.observeFilesystemChange.called);
      await assert.async.isTrue(atomGitRepository2.refreshStatus.called);
    });

    it('refreshes the appropriate Repository and Atom GitRepository when a commit is made in workspace 1', async function() {
      await repository1.git.exec(['commit', '-am', 'commit in repository1']);

      await assert.async.isTrue(repository1.observeFilesystemChange.called);
      await assert.async.isTrue(atomGitRepository1.refreshStatus.called);
    });

    it('refreshes the appropriate Repository and Atom GitRepository when a commit is made in workspace 2', async function() {
      await repository2.git.exec(['commit', '-am', 'commit in repository2']);

      await assert.async.isTrue(repository2.observeFilesystemChange.called);
      await assert.async.isTrue(atomGitRepository2.refreshStatus.called);
    });
  });

  describe('initialize', function() {
    it('creates and sets a repository for the given project path', async function() {
      const nonRepositoryPath = await getTempDir();
      project.setPaths([nonRepositoryPath]);

      await contextUpdateAfter(() => githubPackage.activate());
      await githubPackage.getActiveRepository().getLoadPromise();

      assert.isTrue(githubPackage.getActiveRepository().isEmpty());
      assert.isFalse(githubPackage.getActiveRepository().isAbsent());

      await githubPackage.initialize(nonRepositoryPath);

      assert.isTrue(githubPackage.getActiveRepository().isPresent());
      assert.strictEqual(
        githubPackage.getActiveRepository(),
        await contextPool.getContext(nonRepositoryPath).getRepository(),
      );
    });
  });

  describe('clone', function() {
    it('clones into an existing project path', async function() {
      const sourcePath = await cloneRepository();
      const existingPath = await getTempDir();
      project.setPaths([existingPath]);

      await contextUpdateAfter(() => githubPackage.activate());
      const repository = githubPackage.getActiveRepository();
      await repository.getLoadPromise();
      assert.isTrue(repository.isEmpty());

      assert.isNull(await githubPackage.workdirCache.find(existingPath));

      await githubPackage.clone(sourcePath, existingPath);

      assert.strictEqual(await githubPackage.workdirCache.find(existingPath), existingPath);
    });

    it('clones into a new project path', async function() {
      const sourcePath = await cloneRepository();
      const newPath = await getTempDir();

      await contextUpdateAfter(() => githubPackage.activate());
      const original = githubPackage.getActiveRepository();
      await original.getLoadPromise();
      assert.isTrue(original.isAbsentGuess());
      assert.deepEqual(project.getPaths(), []);

      await contextUpdateAfter(() => githubPackage.clone(sourcePath, newPath));

      assert.deepEqual(project.getPaths(), [newPath]);
      const replaced = githubPackage.getActiveRepository();
      assert.notStrictEqual(original, replaced);
    });
  });

  describe('stub item creation', function() {
    beforeEach(function() {
      sinon.spy(githubPackage, 'rerender');
    });

    describe('before the initial render', function() {
      it('creates a stub item for a commit preview item', function() {
        const item = githubPackage.createCommitPreviewStub({uri: 'atom-github://commit-preview'});

        assert.isFalse(githubPackage.rerender.called);
        assert.strictEqual(item.getTitle(), 'Commit preview');
        assert.strictEqual(item.getURI(), 'atom-github://commit-preview');
      });

      it('creates a stub item for a commit detail item', function() {
        const item = githubPackage.createCommitDetailStub({uri: 'atom-github://commit-detail?workdir=/home&sha=1234'});

        assert.isFalse(githubPackage.rerender.called);
        assert.strictEqual(item.getTitle(), 'Commit');
        assert.strictEqual(item.getURI(), 'atom-github://commit-detail?workdir=/home&sha=1234');
      });
    });

    describe('after the initial render', function() {
      beforeEach(function() {
        githubPackage.controller = Symbol('controller');
      });

      it('creates a stub item for a commit preview item', function() {
        const item = githubPackage.createCommitPreviewStub({uri: 'atom-github://commit-preview'});

        assert.isTrue(githubPackage.rerender.called);
        assert.strictEqual(item.getTitle(), 'Commit preview');
        assert.strictEqual(item.getURI(), 'atom-github://commit-preview');
      });

      it('creates a stub item for a commit detail item', function() {
        const item = githubPackage.createCommitDetailStub({uri: 'atom-github://commit-detail?workdir=/home&sha=1234'});

        assert.isTrue(githubPackage.rerender.called);
        assert.strictEqual(item.getTitle(), 'Commit');
        assert.strictEqual(item.getURI(), 'atom-github://commit-detail?workdir=/home&sha=1234');
      });
    });
  });
});
