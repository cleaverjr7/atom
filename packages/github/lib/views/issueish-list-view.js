import React, {Fragment} from 'react';
import PropTypes from 'prop-types';

import {SearchPropType, RemotePropType, BranchSetPropType} from '../prop-types';
import {autobind} from '../helpers';
import Accordion from './accordion';
import Timeago from './timeago';
import StatusDonutChart from './status-donut-chart';
import CreatePullRequestTile from './create-pull-request-tile';
import Octicon from '../atom/octicon';

export default class IssueishListView extends React.Component {
  static propTypes = {
    search: SearchPropType.isRequired,
    isLoading: PropTypes.bool.isRequired,
    total: PropTypes.number.isRequired,
    issueishes: PropTypes.arrayOf(PropTypes.any).isRequired,

    repository: PropTypes.shape({
      defaultBranchRef: PropTypes.shape({
        prefix: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
      }),
    }),

    remote: RemotePropType.isRequired,
    branches: BranchSetPropType.isRequired,
    aheadCount: PropTypes.number,
    pushInProgress: PropTypes.bool.isRequired,

    onIssueishClick: PropTypes.func.isRequired,
    onMoreClick: PropTypes.func.isRequired,
    onCreatePr: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);

    autobind(this, 'renderIssueish', 'renderEmptyTile', 'renderMoreTile');
  }

  render() {
    return (
      <Accordion
        leftTitle={this.props.search.getName()}
        isLoading={this.props.isLoading}
        results={this.props.issueishes}
        total={this.props.total}
        emptyComponent={this.renderEmptyTile}
        onClickItem={this.props.onIssueishClick}>
        {this.renderIssueish}
      </Accordion>
    );
  }

  renderIssueish(issueish) {
    return (
      <Fragment>
        <img
          className="github-IssueishList-item github-IssueishList-item--avatar"
          src={issueish.getAuthorAvatarURL(32)}
          title={issueish.getAuthorLogin()}
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

  renderEmptyTile() {
    if (this.props.search.showCreateOnEmpty()) {
      return (
        <CreatePullRequestTile
          repository={this.props.repository}
          remote={this.props.remote}
          branches={this.props.branches}
          aheadCount={this.props.aheadCount}
          pushInProgress={this.props.pushInProgress}
          onCreatePr={this.props.onCreatePr}
        />
      );
    }

    return null;
  }
}
