/** @babel */
/** @jsx etch.dom */

import etch from 'etch'

import GitPanelView from '../views/git-panel-view'

export default class GitPanelController {
  constructor ({workspace, commandRegistry, repository, didSelectFilePatch}) {
    this.workspace = workspace
    this.commandRegistry = commandRegistry
    this.didSelectFilePatch = didSelectFilePatch
    this.push = this.push.bind(this)
    this.pull = this.pull.bind(this)
    this.fetch = this.fetch.bind(this)
    this.switchRepository(repository)
    etch.initialize(this)
  }

  render () {
    if (this.repository) {
      return (
        <GitPanelView
          ref='gitPanel'
          workspace={this.workspace}
          commandRegistry={this.commandRegistry}
          repository={this.repository}
          unstagedChanges={this.unstagedChanges}
          stagedChanges={this.stagedChanges}
          branchName={this.branchName}
          remoteName={this.remoteName}
          aheadCount={this.aheadCount}
          behindCount={this.behindCount}
          pullEnabled={this.isPullEnabled()}
          didSelectFilePatch={this.didSelectFilePatch}
          push={this.push}
          pull={this.pull}
          fetch={this.fetch}
        />
      )
    } else {
      return <div />
    }
  }

  update ({repository}) {
    return this.switchRepository(repository)
  }

  switchRepository (repository) {
    if (repository !== this.repository) {
      if (this.repositorySubscription) {
        this.repositorySubscription.dispose()
        this.repositorySubscription = null
      }
      if (repository) {
        this.repositorySubscription = repository.onDidUpdate(() => this.refreshModelData(repository))
      }

      return this.refreshModelData(repository)
    }
  }

  refreshModelData (repository) {
    this.lastModelDataRefreshPromise = this._refreshModelData(repository)
    return this.lastModelDataRefreshPromise
  }

  async _refreshModelData (repository) {
    if (repository) {
      const stagedChanges = await repository.getStagedChanges()
      const unstagedChanges = await repository.getUnstagedChanges()
      const branchName = await repository.getBranchName()
      const remoteName = await repository.getBranchRemoteName(branchName)
      let aheadCount, behindCount
      if (remoteName) {
        // TODO: re-enable this when authentication works
        // await repository.fetch(branchName)
        const counts = await repository.getAheadBehindCount(branchName)
        aheadCount = counts.ahead
        behindCount = counts.behind
      }

      this.unstagedChanges = unstagedChanges
      this.stagedChanges = stagedChanges
      this.branchName = branchName
      this.remoteName = remoteName
      this.aheadCount = aheadCount
      this.behindCount = behindCount
    }

    this.repository = repository
    return etch.update(this)
  }

  push () {
    return this.repository.push(this.branchName)
  }

  pull () {
    if (this.isPullEnabled()) {
      return this.repository.pull(this.branchName)
    } else {
      return Promise.resolve()
    }
  }

  fetch () {
    return this.repository.fetch(this.branchName)
  }

  isPullEnabled () {
    return this.stagedChanges.length === 0 && this.unstagedChanges.length === 0
  }
}
