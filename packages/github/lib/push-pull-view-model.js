/* @flow */

import {Emitter} from 'atom'
import GitStore from './git-store'
import GitService from './git-service'

import type {Disposable} from 'atom'

export default class PushPullViewModel {
  gitStore: GitStore;
  gitService: GitService;
  token: ?string;
  inFlightRequests: number;
  emitter: Emitter;

  constructor (gitStore: GitStore) {
    this.inFlightRequests = 0
    this.emitter = new Emitter()

    this.gitStore = gitStore
    this.gitService = gitStore.getGitService()

    atom.commands.add('atom-workspace', 'git:fetch', () => this.fetch())
    atom.commands.add('atom-workspace', 'git:pull', () => this.pull())
    atom.commands.add('atom-workspace', 'git:push', () => this.push())
  }

  fetch (): Promise<void> {
    return this.performNetworkAction(async () => {
      const remotes = await this.gitService.getRemotes()
      // TODO: These credentials almost certainly won't be right on all remotes,
      // but let's roll with this for now.
      const creds = this.getCreds()
      // Gotta fetch 'em all!
      for (const remote of remotes) {
        await this.gitService.fetch(remote, creds, progress => {
          console.log('fetch progress', progress)
        })
      }
    })
  }

  pull (): Promise<void> {
    return this.performNetworkAction(() => {
      return this.gitService.pull(this.gitStore.branchName, this.getCreds(), progress => {
        console.log('pull progress', progress)
      })
    })
  }

  async push (): Promise<void> {
    return this.performNetworkAction(() => {
      return this.gitService.push(this.gitStore.branchName, this.getCreds(), progress => {
        console.log('push progress', progress)
      })
    })
  }

  async performNetworkAction (fn: () => Promise<void>): Promise<void> {
    this.inFlightRequests++
    this.emitter.emit('did-update')

    try {
      await fn()
    } finally {
      this.inFlightRequests--
      this.emitter.emit('did-update')
    }
  }

  getCreds (): {username: string, password: string} {
    return {username: this.token || '', password: 'x-oauth-basic'}
  }

  setToken (t: string) {
    this.token = t
  }

  requestsInFlight (): boolean {
    return this.inFlightRequests > 0
  }

  onDidUpdate (fn: Function): Disposable {
    return this.emitter.on('did-update', fn)
  }
}
