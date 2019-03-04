import React from 'react';
import PropTypes from 'prop-types';
import {graphql, createPaginationContainer} from 'react-relay';

import {PAGE_SIZE, PAGINATION_WAIT_TIME_MS} from '../../helpers';
import {RelayConnectionPropType} from '../prop-types';
import Accumulator from './accumulator';

class ReviewsAccumulator extends React.Component {
  static propTypes = {
    // Relay props
    relay: PropTypes.shape({
      hasMore: PropTypes.func.isRequired,
      loadMore: PropTypes.func.isRequired,
      isLoading: PropTypes.func.isRequired,
    }).isRequired,
    pullRequest: PropTypes.shape({
      reviews: RelayConnectionPropType(
        PropTypes.object,
      ),
    }),

    // Render prop. Called with (error or null, array of all reviews)
    children: PropTypes.func.isRequired,
  }

  render() {
    return (
      <Accumulator
        relay={this.props.relay}
        resultsBatch={this.props.pullRequest.reviews}
        pageSize={PAGE_SIZE}
        waitTimeMs={PAGINATION_WAIT_TIME_MS}>
        {this.props.children}
      </Accumulator>
    );
  }
}

export default createPaginationContainer(ReviewsAccumulator, {
  pullRequest: graphql`
    fragment reviewsAccumulator_pullRequest on PullRequest
    @argumentDefinitions(
      reviewCount: {type: "Int!"}
      reviewCursor: {type: "String"},
    ) {
      url
      reviews(
        first: $reviewCount
        after: $reviewCursor
      ) @connection(key: "ReviewsAccumulator_reviews") {
        pageInfo {
          hasNextPage
          endCursor
        }

        edges {
          cursor
          node {
            id
            body
            state
            submittedAt
            author {
              login
              avatarUrl
            }
          }
        }
      }
    }
  `,
}, {
  direction: 'forward',
  getConnectionFromProps(props) {
    return props.pullRequest.reviews;
  },
  getFragmentVariables(prevVars, totalCount) {
    return {...prevVars, totalCount};
  },
  getVariables(props, {count, cursor}) {
    return {
      url: props.pullRequest.url,
      reviewCount: count,
      reviewCursor: cursor,
    };
  },
  query: graphql`
    query reviewsAccumulatorQuery(
      $url: URI!
      $reviewCount: Int!
      $reviewCursor: String
    ) {
      resource(url: $url) {
        ... on PullRequest {
          ...reviewsAccumulator_pullRequest @arguments(
            reviewCount: $reviewCount
            reviewCursor: $reviewCursor
          )
        }
      }
    }
  `,
});
