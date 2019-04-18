import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {remote, shell} from 'electron';
const {Menu, MenuItem} = remote;

import {autobind} from '../helpers';
import {IssueishPropType} from '../prop-types';
import Accordion from './accordion';
import Timeago from './timeago';
import StatusDonutChart from './status-donut-chart';
import QueryErrorTile from './query-error-tile';
import Octicon from '../atom/octicon';

export default class IssueishListView extends React.Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    isLoading: PropTypes.bool.isRequired,
    total: PropTypes.number.isRequired,
    issueishes: PropTypes.arrayOf(IssueishPropType).isRequired,

    repository: PropTypes.shape({
      defaultBranchRef: PropTypes.shape({
        prefix: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
      }),
    }),

    needReviewsButton: PropTypes.bool,
    onIssueishClick: PropTypes.func.isRequired,
    onMoreClick: PropTypes.func,
    openReviews: PropTypes.func,

    emptyComponent: PropTypes.func,
    error: PropTypes.object,
  }

  constructor(props) {
    super(props);

    autobind(this, 'renderIssueish', 'renderLoadingTile', 'renderEmptyTile', 'renderMoreTile');
  }

  render() {
    return (
      <Accordion
        leftTitle={this.props.title}
        isLoading={this.props.isLoading}
        results={this.props.issueishes}
        total={this.props.total}
        loadingComponent={this.renderLoadingTile}
        emptyComponent={this.renderEmptyTile}
        moreComponent={this.renderMoreTile}
        reviewsButton={this.renderReviewsButton}
        onClickItem={this.props.onIssueishClick}>
        {this.renderIssueish}
      </Accordion>
    );
  }

  renderReviewsButton = () => {
    if (!this.props.needReviewsButton || this.props.issueishes.length < 1) {
      return null;
    }
    return (
      <button
        className="btn btn-primary btn-sm github-IssueishList-openReviewsButton"
        onClick={e => {
          e.stopPropagation();
          this.props.openReviews(this.props.issueishes[0]);
        }}>
        See reviews
      </button>
    );
  }

  showActionsMenu(event, issueish) {
    event.preventDefault();
    event.stopPropagation();

    const menu = new Menu();

    menu.append(new MenuItem({
      label: 'See reviews',
      click: () => this.props.openReviews(issueish),
    }));

    menu.append(new MenuItem({
      label: 'Open on GitHub',
      click: () => this.onOpenIssueish(issueish),
    }));

    menu.popup(remote.getCurrentWindow());
  }

  onOpenIssueish = issueish => {
    return new Promise((resolve, reject) => {
      shell.openExternal(issueish.getGitHubURL(), {}, err => {
        if (err) { reject(err); } else { resolve(); }
      });
    });
  }

  renderIssueish(issueish) {
    return (
      <Fragment>
        <img
          className="github-IssueishList-item github-IssueishList-item--avatar"
          src={issueish.getAuthorAvatarURL(32)}
          title={issueish.getAuthorLogin()}
          alt={issueish.getAuthorLogin()}
        />
        <span className="github-IssueishList-item github-IssueishList-item--title">
          {issueish.getTitle()}
        </span>
        <span className="github-IssueishList-item github-IssueishList-item--number">
          #{issueish.getNumber()}
        </span>
        {this.renderStatusSummary(issueish.getStatusCounts())}
        <Timeago
          time={issueish.getCreatedAt()}
          displayStyle="short"
          className="github-IssueishList-item github-IssueishList-item--age"
        />
        <Octicon icon="ellipses"
          className="github-IssueishList-item github-IssueishList-item--menu"
          onClick={event => this.showActionsMenu(event, issueish)}
        />
      </Fragment>
    );
  }

  renderStatusSummary(statusCounts) {
    if (['success', 'failure', 'pending'].every(kind => statusCounts[kind] === 0)) {
      return <Octicon className="github-IssueishList-item github-IssueishList-item--status" icon="dash" />;
    }

    if (statusCounts.success > 0 && statusCounts.failure === 0 && statusCounts.pending === 0) {
      return <Octicon className="github-IssueishList-item github-IssueishList-item--status" icon="check" />;
    }

    if (statusCounts.success === 0 && statusCounts.failure > 0 && statusCounts.pending === 0) {
      return <Octicon className="github-IssueishList-item github-IssueishList-item--status" icon="x" />;
    }

    return <StatusDonutChart {...statusCounts} className="github-IssueishList-item github-IssueishList-item--status" />;
  }

  renderLoadingTile() {
    return (
      <div className="github-IssueishList-loading">
        Loading
      </div>
    );
  }

  renderEmptyTile() {
    if (this.props.error) {
      return <QueryErrorTile error={this.props.error} />;
    }

    if (this.props.emptyComponent) {
      const EmptyComponent = this.props.emptyComponent;
      return <EmptyComponent />;
    }

    return null;
  }

  renderMoreTile() {
    /* eslint-disable jsx-a11y/anchor-is-valid */
    if (this.props.onMoreClick) {
      return (
        <div className="github-IssueishList-more">
          <a onClick={this.props.onMoreClick}>
            More...
          </a>
        </div>
      );
    }

    return null;
  }
}
