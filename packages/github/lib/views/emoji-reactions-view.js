import PropTypes from 'prop-types';
import React from 'react';
import {createFragmentContainer, graphql} from 'react-relay';
import cx from 'classnames';

const reactionTypeToEmoji = {
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  LAUGH: '😆',
  HOORAY: '🎉',
  CONFUSED: '😕',
  HEART: '❤️',
  ROCKET: '🚀',
  EYES: '👀',
};

export class BareEmojiReactionsView extends React.Component {
  static propTypes = {
    // Relay response
    reactable: PropTypes.shape({
      id: PropTypes.string.isRequired,
      reactionGroups: PropTypes.arrayOf(
        PropTypes.shape({
          content: PropTypes.string.isRequired,
          viewerHasReacted: PropTypes.bool.isRequired,
          users: PropTypes.shape({
            totalCount: PropTypes.number.isRequired,
          }).isRequired,
        }),
      ).isRequired,
      viewerCanReact: PropTypes.bool.isRequired,
    }).isRequired,

    // Action methods
    addReaction: PropTypes.func.isRequired,
    removeReaction: PropTypes.func.isRequired,
  }

  render() {
    return (
      <div className="github-EmojiReactions btn-group">
        {this.props.reactable.reactionGroups.map(group => {
          const emoji = reactionTypeToEmoji[group.content];
          if (!emoji) {
            return null;
          }
          if (group.users.totalCount === 0) {
            return null;
          }

          const className = cx(
            'github-EmojiReactions-group',
            'btn',
            group.content.toLowerCase(),
            {'btn-info': group.viewerHasReacted},
          );

          const toggle = !group.viewerHasReacted
            ? () => this.props.addReaction(group.content)
            : () => this.props.removeReaction(group.content);

          const disabled = !this.props.reactable.viewerCanReact;

          return (
            <button key={group.content} className={className} onClick={toggle} disabled={disabled}>
              {reactionTypeToEmoji[group.content]} &nbsp; {group.users.totalCount}
            </button>
          );
        })}
      </div>
    );
  }
}

export default createFragmentContainer(BareEmojiReactionsView, {
  reactable: graphql`
    fragment emojiReactionsView_reactable on Reactable {
      id
      reactionGroups {
        content
        viewerHasReacted
        users {
          totalCount
        }
      }
      viewerCanReact
    }
  `,
});
