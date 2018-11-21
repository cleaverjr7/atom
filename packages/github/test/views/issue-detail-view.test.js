import React from 'react';
import {shallow} from 'enzyme';

import {BareIssueDetailView} from '../../lib/views/issue-detail-view';
import EmojiReactionsView from '../../lib/views/emoji-reactions-view';
import {issueishDetailViewProps} from '../fixtures/props/issueish-pane-props';
import * as reporterProxy from '../../lib/reporter-proxy';

describe('IssueDetailView', function() {
  function buildApp(opts, overrideProps = {}) {
    return <BareIssueDetailView {...issueishDetailViewProps(opts, overrideProps)} />;
  }

  it('renders issue information', function() {
    const wrapper = shallow(buildApp({
      repositoryName: 'repo',
      ownerLogin: 'user1',

      issueishKind: 'Issue',
      issueishTitle: 'Issue title',
      issueishBodyHTML: '<code>nope</code>',
      issueishAuthorLogin: 'author1',
      issueishAuthorAvatarURL: 'https://avatars3.githubusercontent.com/u/2',
      issueishNumber: 200,
      issueishState: 'CLOSED',
      issueishReactions: [{content: 'THUMBS_UP', count: 6}, {content: 'THUMBS_DOWN', count: 0}, {content: 'LAUGH', count: 2}],
    }, {}));

    const badge = wrapper.find('IssueishBadge');
    assert.strictEqual(badge.prop('type'), 'Issue');
    assert.strictEqual(badge.prop('state'), 'CLOSED');

    const link = wrapper.find('a.github-IssueishDetailView-headerLink');
    assert.strictEqual(link.text(), 'user1/repo#200');
    assert.strictEqual(link.prop('href'), 'https://github.com/user1/repo/issues/200');

    assert.isFalse(wrapper.find('Relay(PrStatuses)').exists());
    assert.isFalse(wrapper.find('.github-IssueishDetailView-checkoutButton').exists());

    const avatarLink = wrapper.find('.github-IssueishDetailView-avatar');
    assert.strictEqual(avatarLink.prop('href'), 'https://github.com/author1');
    const avatar = avatarLink.find('img');
    assert.strictEqual(avatar.prop('src'), 'https://avatars3.githubusercontent.com/u/2');
    assert.strictEqual(avatar.prop('title'), 'author1');

    assert.strictEqual(wrapper.find('.github-IssueishDetailView-title').text(), 'Issue title');

    assert.isTrue(wrapper.find('GithubDotcomMarkdown').someWhere(n => n.prop('html') === '<code>nope</code>'));

    assert.lengthOf(wrapper.find(EmojiReactionsView), 1);

    assert.isNotNull(wrapper.find('Relay(IssueishTimelineView)').prop('issue'));
    assert.isNull(wrapper.find('Relay(IssueishTimelineView)').prop('pullRequest'));
  });

  it('renders a placeholder issue body', function() {
    const wrapper = shallow(buildApp({issueishBodyHTML: null}));
    assert.isTrue(wrapper.find('GithubDotcomMarkdown').someWhere(n => /No description/.test(n.prop('html'))));
  });

  it('refreshes on click', function() {
    let callback = null;
    const relayRefetch = sinon.stub().callsFake((_0, _1, cb) => {
      callback = cb;
    });
    const wrapper = shallow(buildApp({relayRefetch}, {}));

    wrapper.find('Octicon[icon="repo-sync"]').simulate('click', {preventDefault: () => {}});
    assert.isTrue(wrapper.find('Octicon[icon="repo-sync"]').hasClass('refreshing'));

    callback();
    wrapper.update();

    assert.isFalse(wrapper.find('Octicon[icon="repo-sync"]').hasClass('refreshing'));
  });

  it('disregardes a double refresh', function() {
    let callback = null;
    const relayRefetch = sinon.stub().callsFake((_0, _1, cb) => {
      callback = cb;
    });
    const wrapper = shallow(buildApp({relayRefetch}, {}));

    wrapper.find('Octicon[icon="repo-sync"]').simulate('click', {preventDefault: () => {}});
    assert.strictEqual(relayRefetch.callCount, 1);

    wrapper.find('Octicon[icon="repo-sync"]').simulate('click', {preventDefault: () => {}});
    assert.strictEqual(relayRefetch.callCount, 1);

    callback();
    wrapper.update();

    wrapper.find('Octicon[icon="repo-sync"]').simulate('click', {preventDefault: () => {}});
    assert.strictEqual(relayRefetch.callCount, 2);
  });

  it('configures the refresher with a 5 minute polling interval', function() {
    const wrapper = shallow(buildApp({}));

    assert.strictEqual(wrapper.instance().refresher.options.interval(), 5 * 60 * 1000);
  });

  it('destroys its refresher on unmount', function() {
    const wrapper = shallow(buildApp({}));

    const refresher = wrapper.instance().refresher;
    sinon.spy(refresher, 'destroy');

    wrapper.unmount();

    assert.isTrue(refresher.destroy.called);
  });

  describe('clicking link to view issueish link', function() {
    it('records an event', function() {
      const wrapper = shallow(buildApp({
        repositoryName: 'repo',
        ownerLogin: 'user0',
        issueishNumber: 100,
      }));

      sinon.stub(reporterProxy, 'addEvent');

      const link = wrapper.find('a.github-IssueishDetailView-headerLink');
      assert.strictEqual(link.text(), 'user0/repo#100');
      assert.strictEqual(link.prop('href'), 'https://github.com/user0/repo/pull/100');
      link.simulate('click');

      assert.isTrue(reporterProxy.addEvent.calledWith('open-issueish-in-browser', {package: 'github', from: 'issueish-header'}));
    });
  });
});
