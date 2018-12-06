import React from 'react';
import {graphql, createFragmentContainer} from 'react-relay';
import PropTypes from 'prop-types';

import Octicon from '../../atom/octicon';
import CommitView from './commit-view';

export class BareCommitsView extends React.Component {
  static propTypes = {
    nodes: PropTypes.arrayOf(
      PropTypes.shape({
        author: PropTypes.shape({
          name: PropTypes.string,
          user: PropTypes.shape({
            login: PropTypes.string.isRequired,
          }),
        }).isRequired,
      }).isRequired,
    ).isRequired,
    onBranch: PropTypes.bool.isRequired,
    openCommit: PropTypes.func.isRequired,
  }

  render() {
    return (
      <div className="timeline-item commits">
        {this.renderSummary()}
        {this.renderCommits()}
      </div>
    );
  }

  renderSummary() {
    if (this.props.nodes.length > 1) {
      const namesString = this.calculateNames(this.props.nodes);
      return (
        <div className="info-row">
          <Octicon className="pre-timeline-item-icon" icon="repo-push" />
          <span className="comment-message-header">
            {namesString} added some commits...
          </span>
        </div>
      );
    } else {
      return null;
    }
  }

  renderCommits() {
    return this.props.nodes.map(node => {
      return <CommitView key={node.id} commit={node} onBranch={this.props.onBranch} openCommit={this.props.openCommit} />;
    });
  }

  calculateNames(commits) {
    let names = new Set();
    commits.forEach(commit => {
      let name = null;
      if (commit.author.user) {
        name = commit.author.user.login;
      } else if (commit.author.name) {
        name = commit.author.name;
      }

      if (name && !names.has(name)) {
        names.add(name);
      }
    });

    names = Array.from(names);
    if (names.length === 1) {
      return names[0];
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]}`;
    } else if (names.length > 2) {
      return `${names[0]}, ${names[1]}, and others`;
    } else {
      return 'Someone';
    }
  }
}

export default createFragmentContainer(BareCommitsView, {
  nodes: graphql`
    fragment commitsView_nodes on Commit @relay(plural: true) {
      id author { name user { login } }
      ...commitView_commit
    }
  `,
});
