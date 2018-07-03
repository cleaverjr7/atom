import React from 'react';
import {shallow} from 'enzyme';

import {BareIssueCommentView} from '../../../lib/views/timeline-items/issue-comment-view';

describe('IssueCommentView', function() {
  function buildApp(opts, overrideProps = {}) {
    const o = {
      includeAuthor: true,
      authorLogin: 'author',
      authorAvatarURL: 'https://avatars.com/u/1',
      bodyHTML: '<p>body</p>',
      createdAt: '2018-07-02T09:00:00Z',
      ...opts,
    };

    const props = {
      item: {
        bodyHTML: o.bodyHTML,
        createdAt: o.createdAt,
      },
      switchToIssueish: () => {},
      ...overrideProps,
    };

    if (o.includeAuthor) {
      props.item.author = {
        login: o.authorLogin,
        avatarUrl: o.authorAvatarURL,
      };
    }

    return (
      <BareIssueCommentView {...props} />
    );
  }

  it('renders the comment data', function() {
    const wrapper = shallow(buildApp({}));

    const avatarImg = wrapper.find('img.author-avatar');
    assert.strictEqual(avatarImg.prop('src'), 'https://avatars.com/u/1');
    assert.strictEqual(avatarImg.prop('title'), 'author');

    assert.match(wrapper.find('.comment-message-header').text(), /^author commented/);
    assert.strictEqual(wrapper.find('Timeago').prop('time'), '2018-07-02T09:00:00Z');

    assert.strictEqual(wrapper.find('GithubDotcomMarkdown').prop('html'), '<p>body</p>');
  });

  it('renders when no author is provided', function() {
    const wrapper = shallow(buildApp({includeAuthor: false}));

    assert.isFalse(wrapper.find('img.author-avatar').exists());
    assert.match(wrapper.find('.comment-message-header').text(), /^someone commented/);
  });
});
