/** @babel */
/** @jsx etch.dom */

import etch from 'etch'

import GitPanelView from '../views/git-panel-view'

export default class GitPanelController {
  constructor (props) {
    this.props = props
    this.stageFilePatch = this.stageFilePatch.bind(this)
    this.unstageFilePatch = this.unstageFilePatch.bind(this)
    this.stageResolvedPath = this.stageResolvedPath.bind(this)
    this.push = this.push.bind(this)
    this.pull = this.pull.bind(this)
    this.fetch = this.fetch.bind(this)
    this.commit = this.commit.bind(this)
    this.abortMerge = this.abortMerge.bind(this)
    this.switchRepository(props.repository)
    etch.initialize(this)
  }

  render () {
    if (this.repository) {
      return (
        <GitPanelView
          ref='gitPanel'
          workspace={this.props.workspace}
          commandRegistry={this.props.commandRegistry}
          unstagedChanges={this.unstagedChanges}
          stagedChanges={this.stagedChanges}
          mergeConflicts={this.mergeConflicts}
          mergeMessage={this.mergeMessage}
          branchName={this.branchName}
          remoteName={this.remoteName}
          aheadCount={this.aheadCount}
          behindCount={this.behindCount}
          pullEnabled={this.isPullEnabled()}
          didSelectFilePatch={this.props.didSelectFilePatch}
          didSelectMergeConflictFile={this.props.didSelectMergeConflictFile}
          stageFilePatch={this.stageFilePatch}
          unstageFilePatch={this.unstageFilePatch}
          stageResolvedPath={this.stageResolvedPath}
          commit={this.commit}
          isMerging={this.isMerging}
          abortMerge={this.abortMerge}
          push={this.push}
          pull={this.pull}
          fetch={this.fetch}
        />
      )
    } else {
      return <div />
    }
  }

  update (props) {
    this.props = Object.assign({}, this.props, props)
    return this.switchRepository(props.repository)
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
      this.unstagedChanges = await repository.getUnstagedChanges()
      this.stagedChanges = await repository.getStagedChanges()
      this.isMerging = await repository.isMerging()
      this.mergeConflicts = await repository.getMergeConflictPaths()
      this.mergeMessage = await repository.getMergeMessage()
      this.branchName = await repository.getBranchName()
      this.remoteName = await repository.getBranchRemoteName(this.branchName)
      if (this.remoteName) {
        // TODO: re-enable this when authentication works
        // await repository.fetch(branchName)
        const counts = await repository.getAheadBehindCount(this.branchName)
        this.aheadCount = counts.ahead
        this.behindCount = counts.behind
      } else {
        this.aheadCount = null
        this.behindCount = null
      }
    }

    this.repository = repository
    return etch.update(this)
  }

  unstageFilePatch (filePatch) {
    return this.repository.applyPatchToIndex(filePatch.getUnstagePatch())
  }

  stageFilePatch (filePatch) {
    return this.repository.applyPatchToIndex(filePatch)
  }

  stageResolvedPath (filePath) {
    return this.repository.stageResolvedPath(filePath)
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

  commit (message) {
    return this.repository.commit(message)
  }

  abortMerge () {
    return this.repository.abortMerge()
  }
}
