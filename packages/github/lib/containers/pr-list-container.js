import React from 'react';
import Relay from 'react-relay';
import PropTypes from 'prop-types';

import PrInfoContainer from './pr-info-container';

export class PrList extends React.Component {
  static propTypes = {
    query: PropTypes.shape({
      repository: PropTypes.object,
    }),
  }

  render() {
    // TODO: render a selector if multiple PRs
    const repo = this.props.query.repository;
    if (!repo || !repo.pullRequests.edges.length) {
      return null; // TODO: no PRs
    }
    const pr = repo.pullRequests.edges[0].node;
    return (
      <PrInfoContainer repository={repo} pullRequest={pr} />
    );
  }
}

export default Relay.createContainer(PrList, {
  initialVariables: {
    repoOwner: null,
    repoName: null,
    branchName: null,
  },

  fragments: {
    query: () => Relay.QL`
      fragment on Query {
        repository(owner: $repoOwner, name: $repoName) {
          ${PrInfoContainer.getFragment('repository')}
          pullRequests(first: 30, headRefName: $branchName) {
            edges {
              node {
                ${PrInfoContainer.getFragment('pullRequest')}
              }
            }
          }
        }
      }
    `,
  },
});
