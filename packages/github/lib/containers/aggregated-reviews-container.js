import React, {Fragment} from 'react';
import {Emitter} from 'event-kit';
import {graphql, createRefetchContainer} from 'react-relay';
import PropTypes from 'prop-types';

import {PAGE_SIZE} from '../helpers';
import ReviewSummariesAccumulator from './accumulators/review-summaries-accumulator';
import ReviewThreadsAccumulator from './accumulators/review-threads-accumulator';

export class BareAggregatedReviewsContainer extends React.Component {
  static propTypes = {
    // Relay response
    relay: PropTypes.shape({
      refetch: PropTypes.func.isRequired,
    }),

    // Relay results.
    pullRequest: PropTypes.shape({
      id: PropTypes.string.isRequired,
    }).isRequired,

    // Render prop. Called with {errors, summaries, commentThreads, loading}.
    children: PropTypes.func,

    // only fetch summaries when we specify a summariesRenderer
    summariesRenderer: PropTypes.func,
  }

  static defaultProps = {
    children: () => null,
  }

  constructor(props) {
    super(props);
    this.emitter = new Emitter();
  }

  render() {
    const summaries = this.props.summariesRenderer ?
      (<ReviewSummariesAccumulator
        onDidRefetch={this.onDidRefetch}
        pullRequest={this.props.pullRequest}>
        {this.props.summariesRenderer}
      </ReviewSummariesAccumulator>) : null;

    return (
      <Fragment>
        <ReviewThreadsAccumulator
          onDidRefetch={this.onDidRefetch}
          pullRequest={this.props.pullRequest}>
          {payload => this.props.children({summaries, refetch: this.refetch, ...payload})}
        </ReviewThreadsAccumulator>
      </Fragment>
    );
  }


  refetch = callback => {
    this.props.relay.refetch({
      prId: this.props.pullRequest.id,
      reviewCount: PAGE_SIZE,
      reviewCursor: null,
      threadCount: PAGE_SIZE,
      threadCursor: null,
      commentCount: PAGE_SIZE,
      commentCursor: null,
    },
    null,
    () => {
      this.emitter.emit('did-refetch');
      callback();
    },
    {force: true});
  }

  onDidRefetch = callback => this.emitter.on('did-refetch', callback);
}

export default createRefetchContainer(BareAggregatedReviewsContainer, {
  pullRequest: graphql`
    fragment aggregatedReviewsContainer_pullRequest on PullRequest
    @argumentDefinitions(
      reviewCount: {type: "Int!"}
      reviewCursor: {type: "String"}
      threadCount: {type: "Int!"}
      threadCursor: {type: "String"}
      commentCount: {type: "Int!"}
      commentCursor: {type: "String"}
    ) {
      id
      ...reviewSummariesAccumulator_pullRequest @arguments(
        reviewCount: $reviewCount
        reviewCursor: $reviewCursor
      )
      ...reviewThreadsAccumulator_pullRequest @arguments(
        threadCount: $threadCount
        threadCursor: $threadCursor
        commentCount: $commentCount
        commentCursor: $commentCursor
      )
    }
  `,
}, graphql`
  query aggregatedReviewsContainerRefetchQuery
  (
    $prId: ID!
    $reviewCount: Int!
    $reviewCursor: String
    $threadCount: Int!
    $threadCursor: String
    $commentCount: Int!
    $commentCursor: String
  ) {
    pullRequest: node(id: $prId) {
      ...prCheckoutController_pullRequest
      ...aggregatedReviewsContainer_pullRequest @arguments(
        reviewCount: $reviewCount
        reviewCursor: $reviewCursor
        threadCount: $threadCount
        threadCursor: $threadCursor
        commentCount: $commentCount
        commentCursor: $commentCursor
      )
    }
  }
`);
