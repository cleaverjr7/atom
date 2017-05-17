import path from 'path';
import {CompositeDisposable, Disposable, Emitter} from 'event-kit';

import nsfw from 'nsfw';
import {autobind} from 'core-decorators';

import EventLogger from './event-logger';

export const FOCUS = Symbol('focus');

export default class WorkspaceChangeObserver {
  constructor(window, workspace, repository) {
    this.window = window;
    this.repository = repository;
    this.workspace = workspace;
    this.observedBuffers = new WeakSet();
    this.emitter = new Emitter();
    this.disposables = new CompositeDisposable();
    this.logger = new EventLogger('workspace watcher');
    this.started = false;
  }

  async start() {
    const focusHandler = event => {
      if (this.repository) {
        this.logger.showFocusEvent();
        this.didChange([{special: FOCUS}]);
      }
    };
    this.window.addEventListener('focus', focusHandler);
    this.disposables.add(
      this.workspace.observeTextEditors(this.observeTextEditor),
      new Disposable(() => this.window.removeEventListener('focus', focusHandler)),
    );
    await this.watchActiveRepositoryGitDirectory();
    this.started = true;
    return this;
  }

  async destroy() {
    this.started = false;
    this.observedBuffers = new WeakSet();
    this.emitter.dispose();
    this.disposables.dispose();
    await this.stopCurrentFileWatcher();
  }

  isStarted() {
    return this.started;
  }

  didChange(payload) {
    this.emitter.emit('did-change', payload);
  }

  didChangeWorkdirOrHead() {
    this.emitter.emit('did-change-workdir-or-head');
  }

  onDidChange(callback) {
    return this.emitter.on('did-change', callback);
  }

  onDidChangeWorkdirOrHead(callback) {
    return this.emitter.on('did-change-workdir-or-head', callback);
  }

  getRepository() {
    return this.repository;
  }

  async watchActiveRepositoryGitDirectory() {
    const repository = this.getRepository();
    const gitDirectoryPath = repository.getGitDirectoryPath();
    if (repository) {
      this.currentFileWatcher = await nsfw(
        gitDirectoryPath,
        events => {
          const filteredEvents = events.filter(e => {
            return ['config', 'index', 'HEAD', 'MERGE_HEAD'].includes(e.file || e.newFile) ||
              e.directory.includes(path.join('.git', 'refs'));
          });
          if (filteredEvents.length) {
            this.logger.showEvents(filteredEvents);
            this.didChange(filteredEvents);
            const workdirOrHeadEvent = filteredEvents.filter(e => !['config', 'index'].includes(e.file || e.newFile));
            if (workdirOrHeadEvent) {
              this.logger.showWorkdirOrHeadEvents();
              this.didChangeWorkdirOrHead();
            }
          }
        },
        {
          debounceMS: 100,
          errorCallback: errors => {
            const workingDirectory = repository.getWorkingDirectoryPath();
            // eslint-disable-next-line no-console
            console.warn(`Error in FileSystemChangeObserver in ${workingDirectory}:`, errors);
            this.stopCurrentFileWatcher();
          },
        },
      );
      await this.currentFileWatcher.start();
      this.logger.showStarted(gitDirectoryPath);
    }
  }

  async stopCurrentFileWatcher() {
    if (this.currentFileWatcher) {
      await this.currentFileWatcher.stop();
      this.currentFileWatcher = null;
      this.logger.showStopped();
    }
  }

  activeRepositoryContainsPath(filePath) {
    const repository = this.getRepository();
    if (repository) {
      return filePath.indexOf(repository.getWorkingDirectoryPath()) !== -1;
    } else {
      return false;
    }
  }

  @autobind
  observeTextEditor(editor) {
    const buffer = editor.getBuffer();
    if (!this.observedBuffers.has(buffer)) {
      const didChange = () => {
        const fullPath = buffer.getPath();
        const events = [{
          directory: path.dirname(fullPath),
          file: path.basename(fullPath),
        }];
        this.logger.showEvents(events);
        this.didChange(events);
      };

      this.observedBuffers.add(buffer);
      const disposables = new CompositeDisposable(
        buffer.onDidSave(() => {
          if (this.activeRepositoryContainsPath(buffer.getPath())) {
            didChange();
          }
        }),
        buffer.onDidReload(() => {
          if (this.activeRepositoryContainsPath(buffer.getPath())) {
            didChange();
          }
        }),
        buffer.onDidDestroy(() => {
          if (this.activeRepositoryContainsPath(buffer.getPath())) {
            didChange();
          }
          disposables.dispose();
        }),
      );
      this.disposables.add(disposables);
    }
  }
}
