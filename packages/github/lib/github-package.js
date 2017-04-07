import {CompositeDisposable, Disposable, File} from 'atom';

import path from 'path';

import React from 'react';
import ReactDom from 'react-dom';
import {autobind} from 'core-decorators';
import compareSets from 'compare-sets';

import Repository from './models/repository';
import FileSystemChangeObserver from './models/file-system-change-observer';
import WorkspaceChangeObserver from './models/workspace-change-observer';
import ResolutionProgress from './models/conflicts/resolution-progress';
import StyleCalculator from './models/style-calculator';
import FilePatchController from './controllers/file-patch-controller';
import RootController from './controllers/root-controller';
import IssueishPaneItem from './atom-items/issueish-pane-item';
import GitTimingsView from './views/git-timings-view';
import AsyncQueue from './async-queue';

const defaultState = {
  resolutionProgressByPath: {},
};

export default class GithubPackage {
  constructor(workspace, project, commandRegistry, notificationManager, tooltips, styles, config, confirm) {
    this.workspace = workspace;
    this.project = project;
    this.commandRegistry = commandRegistry;
    this.notificationManager = notificationManager;
    this.tooltips = tooltips;
    this.config = config;
    this.styles = styles;

    this.styleCalculator = new StyleCalculator(this.styles, this.config);
    this.modelPromisesByProjectPath = new Map();
    this.modelsByProjectPath = new Map();
    this.confirm = confirm;

    this.activeModelQueue = new AsyncQueue();
    this.activeProjectPath = null;
    this.activeRepository = null;
    this.activeResolutionProgress = null;

    this.subscriptions = new CompositeDisposable();
    this.savedState = {};
  }

  activate(state = {}) {
    this.savedState = {...defaultState, ...state};

    this.subscriptions = new CompositeDisposable();
    const projectPaths = this.project.getDirectories().map(dir => dir.getRealPathSync());
    if (projectPaths.length > 0) {
      this.didChangeProjectPaths(projectPaths);
    }

    this.subscriptions.add(
      this.project.onDidChangePaths(this.didChangeProjectPaths),
      this.workspace.onDidChangeActivePaneItem(this.didChangeActivePaneItem),
      this.styleCalculator.startWatching(
        'github-package-styles',
        ['editor.fontSize', 'editor.fontFamily', 'editor.lineHeight'],
        config => `
          .github-FilePatchView {
            font-size: 1.1em;
          }

          .github-HunkView-line {
            font-size: ${config.get('editor.fontSize')}px;
            font-family: ${config.get('editor.fontFamily')};
            line-height: ${config.get('editor.lineHeight')};
          }
        `,
      ),
      this.workspace.addOpener(uri => {
        if (uri === 'atom-github://debug/timings') {
          return this.createGitTimingsView();
        } else {
          return null;
        }
      }),
      this.workspace.addOpener(IssueishPaneItem.opener),
    );

    this.rerender();
  }

  serialize() {
    const activeRepository = this.getActiveRepository();

    const resolutionProgressByPath = {};
    this.modelsByProjectPath.forEach((models, projectPath) => {
      const resolutionProgress = models.resolutionProgress;
      if (!resolutionProgress.isEmpty()) {
        resolutionProgressByPath[projectPath] = resolutionProgress.serialize();
      }
    });

    return {
      activeRepositoryPath: activeRepository ? activeRepository.getWorkingDirectoryPath() : null,
      gitController: this.controller.serialize(),
      resolutionProgressByPath,
    };
  }

  @autobind
  rerender() {
    if (!this.element) {
      this.element = document.createElement('div');
      this.subscriptions.add(new Disposable(() => {
        ReactDom.unmountComponentAtNode(this.element);
        delete this.element;
      }));
    }

    ReactDom.render(
      <RootController
        ref={c => { this.controller = c; }}
        workspace={this.workspace}
        commandRegistry={this.commandRegistry}
        notificationManager={this.notificationManager}
        tooltips={this.tooltips}
        config={this.config}
        confirm={this.confirm}
        activeProjectPath={this.activeProjectPath}
        repository={this.getActiveRepository()}
        resolutionProgress={this.getActiveResolutionProgress()}
        statusBar={this.statusBar}
        savedState={this.savedState.gitController}
        createRepositoryForProjectPath={this.createRepositoryForProjectPath}
        cloneRepositoryForProjectPath={this.cloneRepositoryForProjectPath}
      />, this.element,
    );
  }

  async deactivate() {
    this.subscriptions.dispose();
    if (this.destroyedRepositorySubscription) { this.destroyedRepositorySubscription.dispose(); }
    await this.destroyModelsForPaths(Array.from(this.modelPromisesByProjectPath.keys()));
  }

  consumeStatusBar(statusBar) {
    this.statusBar = statusBar;
    this.rerender();
  }

  createGitTimingsView() {
    return GitTimingsView.createPaneItem();
  }

  createIssueishPaneItem({uri}) {
    return IssueishPaneItem.opener(uri);
  }

  @autobind
  async didChangeProjectPaths(projectPaths) {
    const previousProjectPaths = Array.from(this.modelPromisesByProjectPath.keys());
    const {added, removed} = compareSets(new Set(previousProjectPaths), new Set(projectPaths));
    await Promise.all([
      this.cacheModelsForPaths(Array.from(added)),
      this.destroyModelsForPaths(Array.from(removed)),
    ]);
    await this.scheduleActiveModelUpdate();
  }

  @autobind
  async createRepositoryForProjectPath(projectPath) {
    if (!projectPath) {
      throw new Error('Must specify a project path to create a repository for');
    }
    const repository = await Repository.init(projectPath);
    this.addRepository(repository);
    await this.scheduleActiveModelUpdate();
  }

  @autobind
  async cloneRepositoryForProjectPath(remoteUrl, projectPath) {
    const repository = await Repository.clone(remoteUrl, projectPath);
    this.addRepository(repository);
    this.project.addPath(projectPath);
    await this.scheduleActiveModelUpdate();
  }

  @autobind
  async didChangeActivePaneItem() {
    await this.scheduleActiveModelUpdate();
  }

  getActiveProjectPath() {
    return this.activeProjectPath;
  }

  getActiveRepository() {
    return this.activeRepository;
  }

  getActiveResolutionProgress() {
    return this.activeResolutionProgress;
  }

  async scheduleActiveModelUpdate(isActivating = false) {
    await this.activeModelQueue.push(this.updateActiveModels.bind(this, isActivating), {parallel: false});
  }

  async updateActiveModels(isActivating = false) {
    let foundActiveModels = false;

    let nextActiveRepository = this.activeRepository;
    let nextActiveResolutionProgress = this.activeResolutionProgress;
    let nextActiveProjectPath = this.activeProjectPath;

    const setByProjectPath = async projectPath => {
      if (!projectPath) {
        return;
      }

      nextActiveProjectPath = projectPath;
      nextActiveRepository = await this.getRepositoryForWorkdirPath(nextActiveProjectPath);
      nextActiveResolutionProgress = await this.getResolutionProgressForWorkdirPath(nextActiveProjectPath);

      foundActiveModels = true;
    };

    const activeItem = this.workspace.getActivePaneItem();

    if (activeItem) {
      if (typeof activeItem.getRepository === 'function') {
        // FilePatchController or other GitHub package pane
        const repository = activeItem.getRepository();
        if (!repository.isDestroyed()) {
          nextActiveRepository = repository;
          nextActiveResolutionProgress = this.props.activeResolutionProgress;
          nextActiveProjectPath = this.props.activeProjectPath;

          foundActiveModels = true;
        }

      } else if (typeof activeItem.getPath === 'function') {
        // TextEditor-like
        const projectPath = this.projectPathForItemPath(activeItem.getPath());
        await setByProjectPath(projectPath);
      }
    }

    if (!foundActiveModels && this.project.getPaths().length === 1) {
      // Single project
      await setByProjectPath(this.project.getPaths()[0]);
    }

    if (!foundActiveModels && isActivating) {
      // Restore models from saved state
      if (this.savedState.activeRepositoryPath) {
        const projectPath = this.projectPathForItemPath(this.savedState.activeRepositoryPath);
        await setByProjectPath(projectPath);
      }
    }

    this.setActiveModels(nextActiveProjectPath, nextActiveRepository, nextActiveResolutionProgress);
  }

  setActiveModels(projectPath, repository, resolutionProgress) {
    // Ensure that models are updated again when a non-null repository is destroyed
    if (repository) {
      if (this.destroyedRepositorySubscription) {
        this.destroyedRepositorySubscription.dispose();
      }

      this.destroyedRepositorySubscription = repository.onDidDestroy(() => {
        if (repository === this.activeRepository) {
          this.setActiveModels(null, null, null);
        }
        this.destroyedRepositorySubscription.dispose();
      });
    }

    const isChanging = this.activeProjectPath !== projectPath ||
      this.activeRepository !== repository ||
      this.activeResolutionProgress !== resolutionProgress;

    this.activeProjectPath = projectPath;
    this.activeRepository = repository;
    this.activeResolutionProgress = resolutionProgress;

    if (isChanging) {
      this.rerender();
    }
  }

  refreshAtomGitRepository(repository) {
    const repoPath = repository.getWorkingDirectoryPath();
    const atomGitRepo = this.project.getRepositories().find(repo => {
      return repo && path.normalize(repo.getWorkingDirectory()) === repoPath;
    });
    return atomGitRepo ? atomGitRepo.refreshStatus() : Promise.resolve();
  }

  projectPathForItemPath(filePath) {
    if (!filePath) { return null; }
    const realFilePath = new File(filePath).getRealPathSync();
    const directory = this.project.getDirectories().find(projectDir => {
      const fixedPath = projectDir.getRealPathSync() + path.sep;
      return realFilePath.startsWith(fixedPath);
    });
    return directory ? directory.getRealPathSync() : null;
  }

  getRepositoryForWorkdirPath(workdirPath) {
    const models = this.modelPromisesByProjectPath.get(workdirPath);
    return models ? models.repositoryPromise : Promise.resolve(null);
  }

  getResolutionProgressForWorkdirPath(workdirPath) {
    const models = this.modelPromisesByProjectPath.get(workdirPath);
    return models ? models.resolutionProgressPromise : Promise.resolve(null);
  }

  getChangeObserverForWorkdirPath(workdirPath) {
    const models = this.modelPromisesByProjectPath.get(workdirPath);
    return models ? models.changeObserverPromise : Promise.resolve(null);
  }

  cacheModelsForPaths(addedPaths) {

    return Promise.all(addedPaths.map(async projectPath => {
      const repository = await Repository.open(projectPath);
      if (!repository) {
        return;
      }

      this.addRepository(repository);
    }));
  }

  addRepository(repository) {
    const projectPath = repository.getWorkingDirectoryPath();
    repository.setPromptCallback(query => this.controller.promptForCredentials(query));

    // TODO Since we need to await the repositoryPromise to see if a promise is available or not anyway, other
    // calls that are initialized with the promise aren't actually necessary anymore.
    const repositoryPromise = Promise.resolve(repository);

    const changeObserver = process.platform === 'linux'
      ? new WorkspaceChangeObserver(window, this.workspace, repositoryPromise)
      : new FileSystemChangeObserver(repositoryPromise);
    this.subscriptions.add(
      changeObserver.onDidChange(() => repository.refresh()),
      changeObserver.onDidChangeWorkdirOrHead(() => this.refreshAtomGitRepository(repository)),
    );
    const changeObserverPromise = changeObserver.start();

    const savedResolutionProgress = this.savedState.resolutionProgressByPath[projectPath] || {};
    const resolutionProgressPromise = repository.getLastCommit()
      .then(commit => new ResolutionProgress(commit.sha, savedResolutionProgress));

    // Once they resolve, stash the models in modelsByProjectPath for synchronous access when they're needed.
    const models = {
      repository,
      changeObserver: null,
      resolutionProgress: null,
    };
    this.modelsByProjectPath.set(projectPath, models);
    changeObserverPromise.then(() => {
      models.changeObserver = changeObserver;
    });
    resolutionProgressPromise.then(rp => {
      models.resolutionProgress = rp;
    });

    this.modelPromisesByProjectPath.set(projectPath, {
      repositoryPromise,
      changeObserverPromise,
      resolutionProgressPromise,
    });
  }

  destroyModelsForPaths(removedPaths) {
    return Promise.all(
      removedPaths.map(async projectPath => {
        const repositoryPromise = this.getRepositoryForWorkdirPath(projectPath);
        const changeObserverPromise = this.getChangeObserverForWorkdirPath(projectPath);
        this.modelPromisesByProjectPath.delete(projectPath);

        const repository = await repositoryPromise;
        const changeObserver = await changeObserverPromise;
        // repository and changeObserver may be null if the associated workdir was not a Git repo
        repository && repository.destroy();
        changeObserver && await changeObserver.destroy();
      }),
    );
  }
}
