import React from 'react';
import PropTypes from 'prop-types';


export default class ReviewsFooterView extends React.Component {
  static propTypes = {
    commentsResolved: PropTypes.number.isRequired,
    totalComments: PropTypes.number.isRequired,
  };

  render() {
    return (
      <footer className="github-ReviewsFooterView-footer">
        <span className="github-ReviewsFooterView-footerTitle">
          Reviews
        </span>
        <span className="github-ReviewsFooterView">
          <span className="github-ReviewsFooterView-count">
          Resolved{' '}
            <span className="github-ReviewsFooterView-countNumber">
              {this.props.commentsResolved}
            </span>
            {' '}of{' '}
            <span className="github-Reviews-countNumber">
              {this.props.totalComments}
            </span>{' '}comments
          </span>
          <progress className="github-ReviewsFooterView-progessBar"
            value={this.props.commentsResolved} max={this.props.totalComments}>
            {' '}comments{' '}
          </progress>
        </span>
        <button className="github-ReviewsFooterView-openReviewsButton btn"
          onClick={this.handleOpenReviewsClick}>Open reviews</button>
        <button className="github-ReviewsFooterView-reviewChangesButton btn btn-primary">Review changes</button>
      </footer>
    );
  }
}
