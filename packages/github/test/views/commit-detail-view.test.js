import React from 'react';
import {shallow} from 'enzyme';
import moment from 'moment';
import dedent from 'dedent-js';

import CommitDetailView from '../../lib/views/commit-detail-view';
import CommitDetailItem from '../../lib/items/commit-detail-item';
import {cloneRepository, buildRepository} from '../helpers';
import {commitBuilder} from '../builder/commit';

describe('CommitDetailView', function() {
  let repository, atomEnv;

  beforeEach(async function() {
    atomEnv = global.buildAtomEnvironment();
    repository = await buildRepository(await cloneRepository('multiple-commits'));
  });

  afterEach(function() {
    atomEnv.destroy();
  });

  function buildApp(override = {}) {
    const props = {
      repository,
      commit: commitBuilder().build(),
      messageCollapsible: false,
      messageOpen: true,
      itemType: CommitDetailItem,

      workspace: atomEnv.workspace,
      commands: atomEnv.commands,
      keymaps: atomEnv.keymaps,
      tooltips: atomEnv.tooltips,
      config: atomEnv.config,

      destroy: () => {},
      toggleMessage: () => {},
      ...override,
    };

    return <CommitDetailView {...props} />;
  }

  it('has a MultiFilePatchController that its itemType set', function() {
    const wrapper = shallow(buildApp({itemType: CommitDetailItem}));
    assert.strictEqual(wrapper.find('MultiFilePatchController').prop('itemType'), CommitDetailItem);
  });

  it('passes unrecognized props to a MultiFilePatchController', function() {
    const extra = Symbol('extra');
    const wrapper = shallow(buildApp({extra}));
    assert.strictEqual(wrapper.find('MultiFilePatchController').prop('extra'), extra);
  });

  it('renders commit details properly', function() {
    const commit = commitBuilder()
      .sha('420')
      .authorEmail('very@nice.com')
      .authorDate(moment().subtract(2, 'days').unix())
      .messageSubject('subject')
      .messageBody('body')
      .setMultiFileDiff()
      .build();
    const wrapper = shallow(buildApp({commit}));

    assert.strictEqual(wrapper.find('.github-CommitDetailView-title').text(), 'subject');
    assert.strictEqual(wrapper.find('.github-CommitDetailView-moreText').text(), 'body');
    assert.strictEqual(wrapper.find('.github-CommitDetailView-metaText').text(), 'very@nice.com committed 2 days ago');
    assert.strictEqual(wrapper.find('.github-CommitDetailView-sha').text(), '420');
    // assert.strictEqual(wrapper.find('.github-CommitDetailView-sha a').prop('href'), '420');
    assert.strictEqual(
      wrapper.find('img.github-RecentCommit-avatar').prop('src'),
      'https://avatars.githubusercontent.com/u/e?email=very%40nice.com&s=32',
    );
  });

  it('renders multiple avatars for co-authored commit', function() {
    const commit = commitBuilder()
      .authorEmail('blaze@it.com')
      .addCoAuthor('two', 'two@coauthor.com')
      .addCoAuthor('three', 'three@coauthor.com')
      .build();
    const wrapper = shallow(buildApp({commit}));
    assert.deepEqual(
      wrapper.find('img.github-RecentCommit-avatar').map(w => w.prop('src')),
      [
        'https://avatars.githubusercontent.com/u/e?email=blaze%40it.com&s=32',
        'https://avatars.githubusercontent.com/u/e?email=two%40coauthor.com&s=32',
        'https://avatars.githubusercontent.com/u/e?email=three%40coauthor.com&s=32',
      ],
    );
  });

  describe('commit message collapsibility', function() {
    let wrapper;
    const commitMessageBody = dedent`
          if every pork chop was perfect...



          we wouldn't have hot dogs!
          🌭🌭🌭🌭🌭🌭🌭
          `;
    const commit = commitBuilder()
      .authorEmail('greg@mruniverse.biz')
      .messageBody(commitMessageBody)
      .build();
    describe('when messageCollapsible is false', function() {
      beforeEach(function() {
        wrapper = shallow(buildApp({commit, messageCollapsible: false}));
      });
      it('renders the full message body', function() {
        assert.deepEqual(wrapper.find('.github-CommitDetailView-moreText').text(), commitMessageBody);
      });
      it('does not render a button', function() {

      });
    });
    describe('when messageCollapsible is true and messageOpen is false', function() {
      beforeEach(function() {
        wrapper = shallow(buildApp({commit, messageCollapsible: true, messageOpen: false}));
      });
      it('does not render commit message', function() {
        assert.lengthOf(wrapper.find('.github-CommitDetailView-moreText'), 0);
      });

      it('renders button with the text `Show More`', function() {
        const button = wrapper.find('.github-CommitDetailView-moreButton');
        assert.lengthOf(button, 1);
        assert.deepEqual(button.text(), 'Show More');
      });
    });

    describe('when messageCollapsible is true and messageOpen is true', function() {
      let toggleMessage;
      beforeEach(function() {
        toggleMessage = sinon.spy();
        wrapper = shallow(buildApp({commit, messageCollapsible: true, messageOpen: true, toggleMessage}));
      });
      it('renders the full message', function() {
        assert.deepEqual(wrapper.find('.github-CommitDetailView-moreText').text(), commitMessageBody);
      });
      it('renders a button with the text `Hide More`', function() {
        const button = wrapper.find('.github-CommitDetailView-moreButton');
        assert.lengthOf(button, 1);
        assert.deepEqual(button.text(), 'Hide More');
      });
      it('button calls `toggleMessage` prop when clicked', function() {
        const button = wrapper.find('.github-CommitDetailView-moreButton');
        button.simulate('click');
        assert.ok(toggleMessage.called);
      });

    });
  });
});
