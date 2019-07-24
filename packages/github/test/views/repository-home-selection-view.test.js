import React from 'react';
import {shallow} from 'enzyme';
import {TextBuffer} from 'atom';

import {BareRepositoryHomeSelectionView} from '../../lib/views/repository-home-selection-view';
import userQuery from '../../lib/views/__generated__/repositoryHomeSelectionView_user.graphql';
import {userBuilder} from '../builder/graphql/user';

describe('RepositoryHomeSelectionView', function() {
  let atomEnv;

  beforeEach(function() {
    atomEnv = global.buildAtomEnvironment();
  });

  afterEach(function() {
    atomEnv.destroy();
  });

  function buildApp(override = {}) {
    const nameBuffer = new TextBuffer();

    return (
      <BareRepositoryHomeSelectionView
        isLoading={false}
        nameBuffer={nameBuffer}
        selectedOwnerID={''}
        didChangeOwnerID={() => {}}
        {...override}
      />
    );
  }

  it('disables the select list and text input while loading', function() {
    const wrapper = shallow(buildApp({isLoading: true}));

    assert.isTrue(wrapper.find('Select').prop('disabled'));
    assert.isTrue(wrapper.find('AtomTextEditor').prop('readOnly'));
  });

  it('passes a provided buffer to the name entry box', function() {
    const nameBuffer = new TextBuffer();
    const wrapper = shallow(buildApp({nameBuffer}));

    assert.isFalse(wrapper.find('AtomTextEditor').prop('readOnly'));
    assert.strictEqual(wrapper.find('AtomTextEditor').prop('buffer'), nameBuffer);
  });

  it('translates loaded organizations and the current user as options for the select list', function() {
    const user = userBuilder(userQuery)
      .id('user0')
      .login('me')
      .avatarUrl('https://avatars2.githubusercontent.com/u/17565?s=24&v=4')
      .organizations(conn => {
        conn.addEdge(edge => edge.node(o => {
          o.id('org0');
          o.login('enabled');
          o.avatarUrl('https://avatars2.githubusercontent.com/u/1089146?s=24&v=4');
          o.viewerCanCreateRepositories(true);
        }));
        conn.addEdge(edge => edge.node(o => {
          o.id('org1');
          o.login('disabled');
          o.avatarUrl('https://avatars1.githubusercontent.com/u/1507452?s=24&v=4');
          o.viewerCanCreateRepositories(false);
        }));
      })
      .build();

    const wrapper = shallow(buildApp({user}));

    assert.deepEqual(wrapper.find('Select').prop('options'), [
      {id: 'user0', login: 'me', avatarURL: 'https://avatars2.githubusercontent.com/u/17565?s=24&v=4', disabled: false},
      {id: 'org0', login: 'enabled', avatarURL: 'https://avatars2.githubusercontent.com/u/1089146?s=24&v=4', disabled: false},
      {id: 'org1', login: 'disabled', avatarURL: 'https://avatars1.githubusercontent.com/u/1507452?s=24&v=4', disabled: true},
    ]);
  });

  it('uses custom renderers for the options and value', function() {
    const user = userBuilder(userQuery)
      .id('user0')
      .login('me')
      .avatarUrl('https://avatars2.githubusercontent.com/u/17565?s=24&v=4')
      .organizations(conn => {
        conn.addEdge(edge => edge.node(o => {
          o.id('org0');
          o.login('atom');
          o.avatarUrl('https://avatars2.githubusercontent.com/u/1089146?s=24&v=4');
          o.viewerCanCreateRepositories(false);
        }));
      })
      .build();
    const wrapper = shallow(buildApp({user}));

    const optionWrapper = wrapper.find('Select').renderProp('optionRenderer')({
      id: user.id,
      login: user.login,
      avatarURL: user.avatarUrl,
      disabled: false,
    });

    assert.strictEqual(optionWrapper.find('img').prop('src'), 'https://avatars2.githubusercontent.com/u/17565?s=24&v=4');
    assert.strictEqual(optionWrapper.find('.github-RepositoryHome-ownerName').text(), 'me');
    assert.isFalse(optionWrapper.exists('.github-RepositoryHome-ownerUnwritable'));

    const org = user.organizations.edges[0].node;
    const valueWrapper = wrapper.find('Select').renderProp('valueRenderer')({
      id: org.id,
      login: org.login,
      avatarURL: org.avatarUrl,
      disabled: true,
    });

    assert.strictEqual(valueWrapper.find('img').prop('src'), 'https://avatars2.githubusercontent.com/u/1089146?s=24&v=4');
    assert.strictEqual(valueWrapper.find('.github-RepositoryHome-ownerName').text(), 'atom');
    assert.strictEqual(valueWrapper.find('.github-RepositoryHome-ownerUnwritable').text(), '(insufficient permissions)');
  });

  it('loads more organizations as the user scrolls');

  it('passes the currently chosen owner to the select list', function() {
    const user = userBuilder(userQuery)
      .id('user0')
      .login('me')
      .avatarUrl('https://avatars2.githubusercontent.com/u/17565?s=24&v=4')
      .organizations(conn => {
        conn.addEdge(edge => edge.node(o => {
          o.id('org0');
          o.login('zero');
        }));
        conn.addEdge(edge => edge.node(o => {
          o.id('org1');
          o.login('one');
          o.avatarUrl('https://avatars3.githubusercontent.com/u/13409222?s=24&v=4');
          o.viewerCanCreateRepositories(true);
        }));
      })
      .build();

    const wrapper = shallow(buildApp({user, selectedOwnerID: 'user0'}));

    assert.deepEqual(wrapper.find('Select').prop('value'), {
      id: 'user0',
      login: 'me',
      avatarURL: 'https://avatars2.githubusercontent.com/u/17565?s=24&v=4',
      disabled: false,
    });

    wrapper.setProps({selectedOwnerID: 'org1'});

    assert.deepEqual(wrapper.find('Select').prop('value'), {
      id: 'org1',
      login: 'one',
      avatarURL: 'https://avatars3.githubusercontent.com/u/13409222?s=24&v=4',
      disabled: false,
    });
  });

  it('triggers a callback when a new owner is selected', function() {
    const didChangeOwnerID = sinon.spy();

    const user = userBuilder(userQuery)
      .organizations(conn => {
        conn.addEdge(edge => edge.node(o => {
          o.id('org0');
          o.login('ansible');
          o.avatarUrl('https://avatars1.githubusercontent.com/u/1507452?s=24&v=4');
        }));
      })
      .build();
    const org = user.organizations.edges[0].node;

    const wrapper = shallow(buildApp({user, didChangeOwnerID}));

    wrapper.find('Select').prop('onChange')(org);
    assert.isTrue(didChangeOwnerID.calledWith('org0'));
  });
});
