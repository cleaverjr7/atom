import React from 'react';
import PropTypes from 'prop-types';
import {graphql, createFragmentContainer} from 'react-relay';
import {RelayConnectionPropType} from '../prop-types';
import PrCommitView from './pr-commit-view';

export class PrCommitsView extends React.Component {
  static propTypes = {
    pullRequest: PropTypes.shape({
      commits: RelayConnectionPropType(
        PropTypes.shape({
          commit: PropTypes.shape({
            committer: PropTypes.shape({
              name: PropTypes.string.isRequired,
              date: PropTypes.string.isRequired,
            }),
            message: PropTypes.string.isRequired,
            abbreviatedOid: PropTypes.string.isRequired,
            url: PropTypes.string.isRequired,
          }),
        })
      )
    }),
  }

  render() {
    return this.props.pullRequest.commits.edges.map(edge => {
      const commit = edge.node.commit;
      console.log(commit);
      return <PrCommitView key={commit.abbreviatedOid} commit={commit} />;
    });
  }
}

export default createFragmentContainer(PrCommitsView, {
  pullRequest: graphql`
    fragment prCommitsView_pullRequest on PullRequest {
      commits(last:100) {
        edges {
          node {
            commit {
              committer {
                name
                date
              }
              messageHeadline
              messageBody
              abbreviatedOid
              url
            }
          }
        }
      }
    }
  `,
});
