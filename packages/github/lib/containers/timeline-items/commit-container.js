import React from 'react';
import Relay from 'react-relay';
import PropTypes from 'prop-types';

import Octicon from '../../views/octicon';

export class Commit extends React.Component {
  static propTypes = {
    item: PropTypes.object.isRequired,
  }

  render() {
    const commit = this.props.item;
    return (
      <div className="commit">
        <Octicon className="pre-timeline-item-icon" icon="git-commit" />
        <img
          className="author-avatar" src={commit.author.avatarURL}
          title={commit.author.user ? commit.author.user.login : commit.author.name}
        />
        <span
          className="commit-message-headline"
          title={commit.messageHeadline}
          dangerouslySetInnerHTML={{__html: commit.messageHeadlineHTML}}
        />
        <span className="commit-sha">{commit.oid.slice(0, 8)}</span>
      </div>
    );
  }
}

export default Relay.createContainer(Commit, {
  fragments: {
    item: () => Relay.QL`
      fragment on Commit {
        author {
          name avatarURL
          user {
            login
          }
        }
        oid messageHeadline messageHeadlineHTML
      }
    `,
  },
});
