/** @babel */

import {Emitter} from 'atom';
import nsfw from 'nsfw';

import path from 'path';

export default class FileSystemChangeObserver {
  constructor(repository) {
    this.emitter = new Emitter();
    this.repository = repository;
  }

  async start() {
    this.started = true;
    await this.watchRepository();
  }

  async destroy() {
    await this.stopCurrentFileWatcher();
    this.started = false;
  }

  onDidChange(callback) {
    return this.emitter.on('did-change', callback);
  }

  getRepository() {
    return this.repository;
  }

  async watchRepository() {
    if (this.repository) {
      this.lastFileChangePromise = new Promise(resolve => { this.resolveLastFileChangePromise = resolve; });
      this.currentFileWatcher = await nsfw(
        this.repository.getWorkingDirectoryPath(),
        events => {
          const isNonGitFile = event => !event.directory.split(path.sep).includes('.git') && event.file !== '.git';
          const isWatchedGitFile = event => {
            return ['index', 'HEAD', 'config'].includes(event.file) ||
              event.directory.includes(path.join('.git', 'refs', 'remotes'));
          };
          const filteredEvents = events.filter(e => isNonGitFile(e) || isWatchedGitFile(e));
          if (filteredEvents.length) {
            this.emitter.emit('did-change');
            this.resolveLastFileChangePromise();
            this.lastFileChangePromise = new Promise(resolve => { this.resolveLastFileChangePromise = resolve; });
          }
        },
        {
          debounceMS: 100,
          errorCallback: errors => {
            const workingDirectory = this.repository.getWorkingDirectoryPath();
            // eslint-disable-next-line no-console
            console.warn(`Error in FileSystemChangeObserver in ${workingDirectory}:`, errors);
            this.stopCurrentFileWatcher();
          },
        },
      );
      await this.currentFileWatcher.start();
    }
  }

  async stopCurrentFileWatcher() {
    if (this.currentFileWatcher) {
      await this.currentFileWatcher.stop();
      this.currentFileWatcher = null;
    }
  }
}
