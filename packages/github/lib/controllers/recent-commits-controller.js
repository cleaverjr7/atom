import React from 'react';
import PropTypes from 'prop-types';
import {autobind} from '../helpers';
import {addEvent} from '../reporter-proxy';

import CommitDetailItem from '../items/commit-detail-item';
import URIPattern from '../atom/uri-pattern';
import RecentCommitsView from '../views/recent-commits-view';
import {CompositeDisposable} from 'event-kit';

export default class RecentCommitsController extends React.Component {
  static propTypes = {
    commits: PropTypes.arrayOf(PropTypes.object).isRequired,
    isLoading: PropTypes.bool.isRequired,
    undoLastCommit: PropTypes.func.isRequired,
    workspace: PropTypes.object.isRequired,
    repository: PropTypes.object.isRequired,
  }

  constructor(props, context) {
    super(props, context);
    autobind(this, 'openCommit', 'updateSelectedCommit');

    this.subscriptions = new CompositeDisposable(
      this.props.workspace.onDidChangeActivePaneItem(this.updateSelectedCommit),
    );
    this.state = {selectedCommitSha: ''};
  }

  updateSelectedCommit() {
    const activeItem = this.props.workspace.getActivePaneItem();

    const pattern = new URIPattern(decodeURIComponent(
      CommitDetailItem.buildURI(
        this.props.repository.getWorkingDirectoryPath(),
        '{sha}'),
    ));

    if (activeItem && activeItem.getURI) {
      const match = pattern.matches(activeItem.getURI());
      if (match.ok()) {
        const {sha} = match.getParams();
        return new Promise(resolve => this.setState({selectedCommitSha: sha}, resolve));
      }
    }
    return Promise.resolve();
  }

  render() {
    return (
      <RecentCommitsView
        commits={this.props.commits}
        isLoading={this.props.isLoading}
        undoLastCommit={this.props.undoLastCommit}
        openCommit={this.openCommit}
        selectedCommitSha={this.state.selectedCommitSha}
      />
    );
  }

  openCommit({sha}) {
    const workdir = this.props.repository.getWorkingDirectoryPath();
    const uri = CommitDetailItem.buildURI(workdir, sha);
    this.props.workspace.open(uri).then(() => {
      addEvent('open-commit-in-pane', {package: 'github', from: 'recent commit'});
    });
  }
}
