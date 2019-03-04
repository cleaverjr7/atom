import React from 'react';
import PropTypes from 'prop-types';
import {graphql, createPaginationContainer} from 'react-relay';

import {PAGE_SIZE, PAGINATION_WAIT_TIME_MS} from '../../helpers';
import {RelayConnectionPropType} from '../prop-types';
import Accumulator from './accumulator';

class ReviewCommentsAccumulator extends React.Component {
  static propTypes = {
    // Relay props
    relay: PropTypes.shape({
      hasMore: PropTypes.func.isRequired,
      loadMore: PropTypes.func.isRequired,
      isLoading: PropTypes.func.isRequired,
    }).isRequired,
    reviewThread: PropTypes.shape({
      comments: RelayConnectionPropType(
        PropTypes.object,
      ),
    }),

    // Render prop. Called with (error or null, array of all review comments)
    children: PropTypes.func.isRequired,
  }

  render() {
    return (
      <Accumulator
        relay={this.props.relay}
        resultsBatch={this.props.reviewThread.comments}
        pageSize={PAGE_SIZE}
        waitTimeMs={PAGINATION_WAIT_TIME_MS}>
        {this.props.children}
      </Accumulator>
    );
  }
}

export default createPaginationContainer(ReviewCommentsAccumulator, {
  reviewThread: graphql`
    fragment reviewCommentsAccumulator_reviewThread on PullRequestReviewThread
    @argumentDefinitions(
      commentCount: {type: "Int!"}
      commentCursor: {type: "String"},
    ) {
      id
      comments(
        first: $commentCount
        after: $commentCursor
      ) @connection(key: "ReviewCommentsAccumulator_comments") {
        pageInfo {
          hasNextPage
          endCursor
        }

        edges {
          cursor
          node {
            id
            author {
              avatarUrl
              login
            }
            bodyHTML
            isMinimized
            path
            position
            createdAt
            url
          }
        }
      }
    }
  `,
}, {
  direction: 'forward',
  getConnectionFromProps(props) {
    return props.reviewThread.comments;
  },
  getFragmentVariables(prevVars, totalCount) {
    return {...prevVars, totalCount};
  },
  getVariables(props, {count, cursor}) {
    return {
      id: props.reviewThread.id,
      commentCount: count,
      commentCursor: cursor,
    };
  },
  query: graphql`
    query reviewCommentsAccumulatorQuery(
      $id: ID!
      $commentCount: Int!
      $commentCursor: String
    ) {
      node(id: $id) {
        ... on PullRequestReviewThread {
          ...reviewCommentsAccumulator_reviewThread @arguments(
            commentCount: $commentCount
            commentCursor: $commentCursor
          )
        }
      }
    }
  `,
});
