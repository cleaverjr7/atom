import path from 'path';
import React from 'react';
import PropTypes from 'prop-types';
import PullRequestReviewsContainer from '../containers/pr-reviews-container';
import GithubDotcomMarkdown from './github-dotcom-markdown';
import Timeago from './timeago';

export default class ReviewsView extends React.Component {
  static propTypes = {
    repository: PropTypes.shape({
      pullRequest: PropTypes.object.isRequired,
    }).isRequired,
  }

  render() {
    return (
      <div className="github-Reviews">
        <PullRequestReviewsContainer pullRequest={this.props.repository.pullRequest}>
          {({reviews, commentThreads}) => [
            this.renderReviewSummaries(reviews),
            this.renderReviewCommentThreads(commentThreads),
          ]}
        </PullRequestReviewsContainer>
      </div>
    );
  }

  renderReviewSummaries(reviews) {
    return (
      <details className="github-Reviews-section" open>
        <summary className="github-Reviews-header">
          <h1 className="github-Reviews-title">Reviews</h1>
        </summary>
        <main className="github-Reviews-container">
          {reviews.map(this.renderReviewSummary)}
        </main>
      </details>
    );
  }

  renderReviewSummary(review) {
    const reviewTypes = type => {
      return {
        APPROVED: {icon: 'icon-check', copy: 'approved these changes.'},
        COMMENT: {icon: 'icon-comment', copy: 'commented.'},
        CHANGES_REQUESTED: {icon: 'icon-alert', copy: 'requested changes.'},
      }[type] || {icon: '', copy: ''};
    }

    const {icon, copy} = reviewTypes(review.state);
    return (
      <div className="github-ReviewSummary" key={review.id}>
        <header className="github-ReviewSummary-header">
          <span className={`github-ReviewSummary-icon icon ${icon}`} />
          <img className="github-ReviewSummary-avatar"
            src={review.author ? review.author.avatarUrl : ''} alt={review.author.login}
          />
          <a className="github-ReviewSummary-username" href={`https://github.com/${review.author.login}`}>{review.author.login}</a>
          <span className="github-ReviewSummary-type">{copy}</span>
          <span className="github-ReviewSummary-timeAgo"><Timeago time={review.submittedAt} /></span>
        </header>
        <main className="github-ReviewSummary-comment">
          <GithubDotcomMarkdown html={review.body} />
        </main>
      </div>
    );
  }

  renderReviewCommentThreads(commentThreads) {
    if (commentThreads.length === 0) {
      return null;
    }
    return (
      <details className="github-Reviews-section" open>
        <summary className="github-Reviews-header">
          <h1 className="github-Reviews-title">Review comments</h1>
          <span className="github-Reviews-progress">
            <span className="github-Reviews-count">Resolved <span className="github-Reviews-countNr">1</span> of <span className="github-Reviews-countNr">7</span></span>
            <progress className="github-Reviews-progessBar" value="1" max="7"></progress>
          </span>
        </summary>
        <main className="github-Reviews-container">
          {commentThreads.map(this.renderReviewCommentThread)}
        </main>
      </details>
    );
  }

  renderReviewCommentThread(commentThread) {
    const {comments} = commentThread;
    const rootComment = comments[0];
    const {dir, base} = path.parse(rootComment.path);
    // TODO: fixme
    const lineNumber = rootComment.position;

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
          <span className="github-Review-referenceTimeAgo"><Timeago time={rootComment.createdAt} /></span>
          <nav className="github-Review-nav">
            <button className="github-Review-navButton icon icon-diff" />
            <button className="github-Review-navButton icon icon-code"
              data-path={rootComment.path} data-line="{lineNumber}"
            />
          </nav>
        </summary>
        <pre className="github-Review-diff">
          <div className="github-Review-diffLine            ">{ '      messageCollapsible: this.props.commit.isBodyLong(),' }</div>
          <div className="github-Review-diffLine            ">{ '      messageOpen: !this.props.commit.isBodyLong(),' }</div>
          <div className="github-Review-diffLine is-deleted ">{ '    };' }</div>
          <div className="github-Review-diffLine is-added   ">{ '    }' }</div>
        </pre>

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

  renderComment(comment) {
    return (
      <div className="github-Review-comment" key={comment.id}>
        <header className="github-Review-header">
          <img className="github-Review-avatar"
            src={comment.author ? comment.author.avatarUrl : ''} alt={comment.author.login}
          />
          <a className="github-Review-username" href="https://github.com/annthurium">{comment.author.login}</a>
          <a className="github-Review-timeAgo" href={comment.url}>
            <Timeago time={comment.createdAt} />
          </a>
        </header>
        <div className="github-Review-text">
          <GithubDotcomMarkdown html={comment.bodyHTML} />
        </div>
      </div>
    );
  }
}
