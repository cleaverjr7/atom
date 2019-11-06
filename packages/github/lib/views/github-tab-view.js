import React from 'react';
import PropTypes from 'prop-types';

import {
  GithubLoginModelPropType, RefHolderPropType, RemoteSetPropType, RemotePropType, BranchSetPropType, BranchPropType,
  OperationStateObserverPropType,
} from '../prop-types';
import LoadingView from './loading-view';
import RemoteSelectorView from './remote-selector-view';
import GithubTabHeaderContainer from '../containers/github-tab-header-container';
import GithubTabHeaderView from './github-tab-header-view';
import RemoteContainer from '../containers/remote-container';
import {nullAuthor} from '../models/author';

export default class GitHubTabView extends React.Component {
  static propTypes = {
    // Connection
    loginModel: PropTypes.object.isRequired,

    repository: PropTypes.object.isRequired,
    workspace: PropTypes.object.isRequired,
    remoteOperationObserver: OperationStateObserverPropType.isRequired,
    rootHolder: RefHolderPropType.isRequired,

    workingDirectory: PropTypes.string,
    branches: BranchSetPropType.isRequired,
    currentBranch: BranchPropType.isRequired,
    remotes: RemoteSetPropType.isRequired,
    currentRemote: RemotePropType.isRequired,
    manyRemotesAvailable: PropTypes.bool.isRequired,
    aheadCount: PropTypes.number,
    pushInProgress: PropTypes.bool.isRequired,
    isLoading: PropTypes.bool.isRequired,

    handlePushBranch: PropTypes.func.isRequired,
    handleRemoteSelect: PropTypes.func.isRequired,
    changeWorkingDirectory: PropTypes.func.isRequired,
    onDidChangeWorkDirs: PropTypes.func.isRequired,
    getCurrentWorkDirs: PropTypes.func.isRequired,
  }

  render() {
    return (
      <div className="github-GitHub" ref={this.props.rootHolder.setter}>
        {this.renderHeader()}
        <div className="github-GitHub-content">
          {this.renderRemote()}
        </div>
      </div>
    );
  }

  renderRemote() {
    if (this.props.isLoading) {
      return <LoadingView />;
    }

    if (this.props.currentRemote.isPresent()) {
      // Single, chosen or unambiguous remote
      return (
        <RemoteContainer
          // Connection
          loginModel={this.props.loginModel}
          endpoint={this.props.currentRemote.getEndpoint()}

          remoteOperationObserver={this.props.remoteOperationObserver}
          pushInProgress={this.props.pushInProgress}
          workingDirectory={this.props.workingDirectory}
          workspace={this.props.workspace}
          remote={this.props.currentRemote}
          remotes={this.props.remotes}
          branches={this.props.branches}
          aheadCount={this.props.aheadCount}

          onPushBranch={() => this.props.handlePushBranch(this.props.currentBranch, this.props.currentRemote)}
        />
      );
    }

    if (this.props.manyRemotesAvailable) {
      // No chosen remote, multiple remotes hosted on GitHub instances
      return (
        <RemoteSelectorView
          remotes={this.props.remotes}
          currentBranch={this.props.currentBranch}
          selectRemote={this.props.handleRemoteSelect}
        />
      );
    }

    // No remotes available
    // TODO: display a view that lets you create a repository on GitHub
    return (
      <div className="github-GitHub-noRemotes">
        <div className="github-GitHub-LargeIcon icon icon-mark-github" />
        <h1>No Remotes</h1>
        <div className="initialize-repo-description">
          <span>This repository does not have any remotes hosted at GitHub.com.</span>
        </div>
      </div>
    );
  }

  renderHeader() {
    if (this.props.currentRemote.isPresent()) {
      return (
        <GithubTabHeaderContainer
          // Connection
          loginModel={this.props.loginModel}
          endpoint={this.props.currentRemote.getEndpoint()}

          handleWorkDirSelect={e => this.props.changeWorkingDirectory(e.target.value)}
          currentWorkDir={this.props.workingDirectory}
          getCurrentWorkDirs={this.props.getCurrentWorkDirs}
          onDidChangeWorkDirs={this.props.onDidChangeWorkDirs}
        />
      );
    }
    return (
      <GithubTabHeaderView
        currentWorkDir={this.props.workingDirectory}
        committer={nullAuthor}
        handleWorkDirSelect={this.props.handleWorkDirSelect}
        getCurrentWorkDirs={this.props.getCurrentWorkDirs}
        onDidChangeWorkDirs={this.props.onDidChangeWorkDirs}
      />
    );
  }
}
