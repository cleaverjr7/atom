import path from 'path';
import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

import {EnableableOperationPropType} from '../prop-types';
import Tooltip from '../atom/tooltip';
import Commands, {Command} from '../atom/commands';
import AggregatedReviewsContainer from '../containers/aggregated-reviews-container';
import EmojiReactionsView from '../views/emoji-reactions-view';
import GithubDotcomMarkdown from './github-dotcom-markdown';
import ErrorView from './error-view';
import PatchPreviewView from './patch-preview-view';
import Timeago from './timeago';
import {checkoutStates} from '../controllers/pr-checkout-controller';
import RefHolder from '../models/ref-holder';

export default class ReviewsView extends React.Component {
  static propTypes = {
    // GraphQL results
    repository: PropTypes.shape({
      pullRequest: PropTypes.object.isRequired,
    }).isRequired,

    // Package models
    multiFilePatch: PropTypes.object.isRequired,
    contextLines: PropTypes.number.isRequired,

    // for the dotcom link in the empty state
    number: PropTypes.number.isRequired,
    repo: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    workdir: PropTypes.string.isRequired,

    // Local model objects
    checkoutOp: EnableableOperationPropType.isRequired,

    // Atom environment
    workspace: PropTypes.object.isRequired,
    config: PropTypes.object.isRequired,
    commands: PropTypes.object.isRequired,
    tooltips: PropTypes.object.isRequired,

    // Action methods
    openFile: PropTypes.func.isRequired,
    openDiff: PropTypes.func.isRequired,
    moreContext: PropTypes.func.isRequired,
    lessContext: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);

    this.rootHolder = new RefHolder();
  }

  render() {
    return (
      <div className="github-Reviews" ref={this.rootHolder.setter}>
        {this.renderCommands()}
        <header className="github-Reviews-topHeader">
          <span className="icon icon-comment-discussion" />
          <span className="github-Reviews-headerTitle">Reviews for atom/github#1983</span>
          <button className="github-Reviews-headerButton icon icon-repo-sync" />
          <button className="github-Reviews-headerButton icon icon-repo-pull github-Reviews-checkoutButton">
            Checkout PR
          </button>
        </header>
        <div className="github-Reviews-list">
          <AggregatedReviewsContainer pullRequest={this.props.repository.pullRequest}>
            {({errors, summaries, commentThreads, loading}) => {
              if (errors.length > 0) {
                return errors.map((error, i) => (
                  <ErrorView
                    key={`error-${i}`}
                    title="Pagination error"
                    descriptions={[error.stack || error.toString()]}
                  />
                ));
              }

              return (
                <Fragment>
                  {this.renderReviewSummaries(summaries)}
                  {this.renderReviewCommentThreads(commentThreads)}
                </Fragment>
              );
            }}
          </AggregatedReviewsContainer>
        </div>
      </div>
    );
  }

  renderCommands() {
    return (
      <Commands registry={this.props.commands} target={this.rootHolder}>
        <Command command="github:more-context" callback={this.props.moreContext} />
        <Command command="github:less-context" callback={this.props.lessContext} />
      </Commands>
    );
  }

  // todo: maybe extract this into its own component since it is used in 2 places.
  renderCheckoutButton() {
    const {checkoutOp} = this.props;
    let extraClass = null;
    let buttonText = 'Checkout';
    let buttonTitle = null;

    if (!checkoutOp.isEnabled()) {
      buttonTitle = checkoutOp.getMessage();
      const reason = checkoutOp.why();
      if (reason === checkoutStates.HIDDEN) {
        return null;
      }

      buttonText = reason.when({
        current: 'Checked out',
        default: 'Checkout',
      });

      extraClass = 'github-IssueishDetailView-checkoutButton--' + reason.when({
        disabled: 'disabled',
        busy: 'busy',
        current: 'current',
      });
    }

    const classNames = cx('btn', 'btn-primary', 'github-IssueishDetailView-checkoutButton', extraClass);
    return (
      <button
        className={classNames}
        disabled={!checkoutOp.isEnabled()}
        title={buttonTitle}
        onClick={() => checkoutOp.run()}>
        {buttonText}
      </button>
    );
  }

  renderEmptyState() {
    const {number, repo, owner} = this.props;
    // todo: make this open the review flow in Atom instead of dotcom
    const pullRequestURL = `https://www.github.com/${owner}/${repo}/pull/${number}/`;
    return (
      <div className="github-Reviews-emptyState">
        <img src="atom://github/img/mona.svg" alt="Mona the octocat in spaaaccee" className="github-Reviews-emptyImg" />
        <div className="github-Reviews-emptyText">
          This pull request has no reviews
        </div>
        <div className="github-Reviews-emptyCallToActionText">
          <a href={pullRequestURL}>
            Start a review
          </a>
        </div>
      </div>
    );
  }

  renderReviewSummaries = reviewSummaries => {
    if (reviewSummaries.length === 0) {
      return this.renderEmptyState();
    }
    return (
      <details className="github-Reviews-section summaries" open>
        <summary className="github-Reviews-header">
          <h1 className="github-Reviews-title">Reviews</h1>
          {this.renderCheckoutButton()}
        </summary>
        <main className="github-Reviews-container">
          {reviewSummaries.map(this.renderReviewSummary)}
        </main>
      </details>
    );
  }

  renderReviewSummary = review => {
    const reviewTypes = type => {
      return {
        APPROVED: {icon: 'icon-check', copy: 'approved these changes'},
        COMMENTED: {icon: 'icon-comment', copy: 'commented'},
        CHANGES_REQUESTED: {icon: 'icon-alert', copy: 'requested changes'},
      }[type] || {icon: '', copy: ''};
    };

    const {icon, copy} = reviewTypes(review.state);

    // filter non actionable empty summary comments from this view
    if (copy === 'commented' && review.body === '') {
      return null;
    }

    const reviewAuthor = review.author ? review.author.login : '';
    return (
      <div className="github-ReviewSummary" key={review.id}>
        <header className="github-ReviewSummary-header">
          <span className={`github-ReviewSummary-icon icon ${icon}`} />
          <img className="github-ReviewSummary-avatar"
            src={review.author ? review.author.avatarUrl : ''} alt={reviewAuthor}
          />
          <a className="github-ReviewSummary-username" href={`https://github.com/${reviewAuthor}`}>{reviewAuthor}</a>
          <span className="github-ReviewSummary-type">{copy}</span>
          <Timeago className="github-ReviewSummary-timeAgo" time={review.submittedAt} displayStyle="short" />
        </header>
        <main className="github-ReviewSummary-comment">
          <GithubDotcomMarkdown html={review.body} switchToIssueish={() => {}} />
          <EmojiReactionsView reactionGroups={review.reactionGroups} />
        </main>
      </div>
    );
  }

  renderReviewCommentThreads = commentThreads => {
    if (commentThreads.length === 0) {
      return null;
    }

    const resolvedThreads = commentThreads.filter(thread => thread.thread.isResolved).length;

    return (
      <details className="github-Reviews-section comments" open>
        <summary className="github-Reviews-header">
          <h1 className="github-Reviews-title">Review comments</h1>
          <span className="github-Reviews-progress">
            <span className="github-Reviews-count">
              Resolved
              {' '}<span className="github-Reviews-countNr">{resolvedThreads}</span>{' '}
              of
              {' '}<span className="github-Reviews-countNr">{commentThreads.length}</span>
            </span>
            <progress className="github-Reviews-progessBar" value={resolvedThreads} max={commentThreads.length} />
          </span>
        </summary>
        <main className="github-Reviews-container">
          {commentThreads.map(this.renderReviewCommentThread)}
        </main>
      </details>
    );
  }

  renderReviewCommentThread = commentThread => {
    const {comments} = commentThread;
    const rootComment = comments[0];
    const {dir, base} = path.parse(rootComment.path);
    // TODO: fixme
    const lineNumber = rootComment.position;

    const refJumpToFileButton = new RefHolder();
    const jumpToFileDisabledLabel = 'Checkout this pull request to enable Jump To File.';

    return (
      <details className="github-Review" key={`review-comment-${rootComment.id}`}>
        <summary className="github-Review-reference">
          <span className="github-Review-resolvedIcon icon icon-check" />
          <span className="github-Review-path">{dir}</span>
          <span className="github-Review-file">/{base}</span>
          <span className="github-Review-lineNr">{lineNumber}</span>
          <img className="github-Review-referenceAvatar"
            src={rootComment.author ? rootComment.author.avatarUrl : ''} alt={rootComment.author.login}
          />
          <Timeago className="github-Review-referenceTimeAgo" time={rootComment.createdAt} displayStyle="short" />
        </summary>
        <nav className="github-Review-nav">
          <button className="github-Review-navButton icon icon-code"
            data-path={rootComment.path} data-line={lineNumber}
            onClick={this.openFile} disabled={this.props.checkoutOp.isEnabled()}
            ref={refJumpToFileButton.setter}>
            Jump To File
          </button>
          <button className="github-Review-navButton icon icon-diff"
            data-path={rootComment.path} data-line={lineNumber}
            onClick={this.openDiff}>
            Open Diff
          </button>
          {this.props.checkoutOp.isEnabled() &&
            <Tooltip
              manager={this.props.tooltips}
              target={refJumpToFileButton}
              title={jumpToFileDisabledLabel}
              showDelay={200}
            />
          }
        </nav>

        {rootComment.position !== null && (
          <PatchPreviewView
            multiFilePatch={this.props.multiFilePatch}
            fileName={rootComment.path}
            diffRow={rootComment.position}
            maxRowCount={this.props.contextLines}
            config={this.props.config}
          />
        )}

        <main className="github-Review-comments">

          {comments.map(this.renderComment)}

          <div className="github-Review-reply">
            <textarea className="github-Review-replyInput input-textarea native-key-bindings" placeholder="Reply..." />
            <button className="github-Review-replyButton btn" title="Add your comment">Comment</button>
          </div>
        </main>
        <footer className="github-Review-footer">
          <button className="github-Review-resolveButton btn btn-primary icon icon-check" title="Mark as resolved">
            Mark as resolved
          </button>
        </footer>
      </details>
    );
  }

  renderComment = comment => {
    return (
      <div className="github-Review-comment" key={comment.id}>
        <header className="github-Review-header">
          <img className="github-Review-avatar"
            src={comment.author ? comment.author.avatarUrl : ''} alt={comment.author.login}
          />
          <a className="github-Review-username" href={`https://github.com/${comment.author.login}`}>{comment.author.login}</a>
          <a className="github-Review-timeAgo" href={comment.url}>
            <Timeago displayStyle="long" time={comment.createdAt} />
          </a>
        </header>
        <div className="github-Review-text">
          <GithubDotcomMarkdown html={comment.bodyHTML} switchToIssueish={() => {}} />
          <EmojiReactionsView reactionGroups={comment.reactionGroups} />
        </div>
      </div>
    );
  }

  openFile = evt => {
    if (!this.props.checkoutOp.isEnabled()) {
      const target = evt.currentTarget;
      this.props.openFile(target.dataset.path, target.dataset.line - 1);
    }
  }

  openDiff = evt => {
    const target = evt.currentTarget;
    this.props.openDiff(target.dataset.path, parseInt(target.dataset.line, 10));
  }
}
