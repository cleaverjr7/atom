import React from 'react';
import Relay from 'react-relay';

import Octicon from '../../views/octicon';
import Timeago from '../../views/timeago';
import GithubDotcomMarkdown from '../../views/github-dotcom-markdown';

export class IssueComment extends React.Component {
  static propTypes = {
    switchToIssueish: React.PropTypes.func.isRequired,
    item: React.PropTypes.object.isRequired,
  }

  render() {
    const comment = this.props.item;
    return (
      <div className="issue">
        <div className="info-row">
          <Octicon className="pre-timeline-item-icon" icon="comment" />
          <img className="author-avatar" src={comment.author.avatarURL} title={comment.author.login} />
          <span className="comment-message-header">
            {comment.author.login} commented on <Timeago time={comment.createdAt} />
          </span>
        </div>
        <GithubDotcomMarkdown html={comment.bodyHTML} switchToIssueish={this.props.switchToIssueish} />
      </div>
    );
  }
}

export default Relay.createContainer(IssueComment, {
  fragments: {
    item: () => Relay.QL`
      fragment on IssueComment {
        author {
          avatarURL login
        }
        bodyHTML createdAt
      }
    `,
  },
});
