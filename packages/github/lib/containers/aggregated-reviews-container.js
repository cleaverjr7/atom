import React, {Fragment} from 'react';
import {graphql, createFragmentContainer} from 'react-relay';
import PropTypes from 'prop-types';
import moment from 'moment';

import ReviewSummariesAccumulator from './accumulators/review-summaries-accumulator';
import ReviewThreadsAccumulator from './accumulators/review-threads-accumulator';

class AggregatedReviewsContainer extends React.Component {
  static propTypes = {
    // Relay results.
    pullRequest: PropTypes.object.isRequired,

    // Render prop. Called with {errors, summaries, commentThreads, loading}.
    children: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);

    this.state = {
      errors: [],
      summaries: [],
      commentThreads: [],
      summariesLoading: true,
      threadsLoading: true,
    };
  }

  render() {
    return (
      <Fragment>
        <ReviewSummariesAccumulator pullRequest={this.props.pullRequest} handleResults={this.handleSummaryResults} />
        <ReviewThreadsAccumulator pullRequest={this.props.pullRequest} handleResults={this.handleThreadResults} />
        {this.props.children(this.getPayload())}
      </Fragment>
    );
  }

  handleSummaryResults = (err, summaries, loading) => {
    this.setState(prevState => {
      summaries.sort((a, b) => moment(a.submittedAt, moment.ISO_8601) - moment(b.submittedAt, moment.ISO_8601));

      return {
        errors: err !== null ? [...prevState.errors, err] : prevState.errors,
        summaries,
        summariesLoading: loading,
      };
    });
  }

  handleThreadResults = (errs, threads, commentsByThread, loading) => {
    this.setState(prevState => {
      const commentThreads = threads.map(thread => {
        return {thread, comments: commentsByThread.get(thread)};
      });

      return {
        errors: [...prevState.errors, ...errs.filter(err => err != null)],
        commentThreads,
        threadsLoading: loading,
      };
    });
  }

  getPayload() {
    return {
      errors: this.state.errors,
      summaries: this.state.summaries,
      commentThreads: this.state.commentThreads,
      loading: this.state.summariesLoading || this.state.threadsLoading,
    };
  }
}

export default createFragmentContainer(AggregatedReviewsContainer, {
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
});
