import React from 'react';
import {mount} from 'enzyme';

import Remote from '../../lib/models/remote';
import Branch, {nullBranch} from '../../lib/models/branch';
import BranchSet from '../../lib/models/branch-set';
import GithubLoginModel from '../../lib/models/github-login-model';
import {InMemoryStrategy} from '../../lib/shared/keytar-strategy';
import RemoteContainer from '../../lib/containers/remote-container';
import {expectRelayQuery} from '../../lib/relay-network-layer-manager';

describe('RemoteContainer', function() {
  let model;

  beforeEach(function() {
    model = new GithubLoginModel(InMemoryStrategy);
  });

  function buildApp(overrideProps = {}) {
    const origin = new Remote('origin', 'git@github.com:atom/github.git');
    const branch = new Branch('master', nullBranch, nullBranch, true);
    const branchSet = new BranchSet();
    branchSet.add(branch);

    return (
      <RemoteContainer
        loginModel={model}

        host="https://api.github.com"

        remote={origin}
        branches={branchSet}

        aheadCount={0}
        pushInProgress={false}

        onPushBranch={() => {}}

        {...overrideProps}
      />
    );
  }

  function expectSuccessfulQuery() {
    return expectRelayQuery({
      name: 'remoteContainerQuery',
      variables: {
        owner: 'atom',
        name: 'github',
      },
    }, {
      repository: {
        defaultBranchRef: {
          prefix: 'refs/heads/',
          name: 'master',
          id: 'ref0',
        },
        id: 'repo0',
      },
    });
  }

  function expectEmptyIssueishQuery() {
    return expectRelayQuery({
      name: 'issueishListContainerQuery',
      variables: {
        query: 'repo:atom/github type:pr state:open',
      },
    }, {
      search: {
        issueCount: 0,
        nodes: [],
      },
    });
  }

  it('renders a loading spinner while the token is being fetched', function() {
    const wrapper = mount(buildApp());
    assert.isTrue(wrapper.find('LoadingView').exists());
  });

  it('renders a loading spinner while the GraphQL query is being performed', async function() {
    expectSuccessfulQuery();
    model.setToken('https://api.github.com', '1234');
    sinon.spy(model, 'getToken');
    sinon.stub(model, 'getScopes').resolves(GithubLoginModel.REQUIRED_SCOPES);

    const wrapper = mount(buildApp());
    await model.getToken.returnValues[0];

    assert.isTrue(wrapper.find('LoadingView').exists());
  });

  it('renders a login prompt if no token is found', async function() {
    sinon.spy(model, 'getToken');

    const wrapper = mount(buildApp());
    await model.getToken.returnValues[0];

    assert.isTrue(wrapper.update().find('GithubLoginView').exists());
  });

  it('renders a login prompt if the token has insufficient OAuth scopes', async function() {
    model.setToken('https://api.github.com', '1234');
    sinon.spy(model, 'getToken');
    sinon.stub(model, 'getScopes').resolves([]);

    const wrapper = mount(buildApp());
    await model.getToken.returnValues[0];

    assert.match(wrapper.update().find('GithubLoginView').find('p').text(), /sufficient/);
  });

  it('renders the controller once results have arrived', async function() {
    const {resolve} = expectSuccessfulQuery();
    expectEmptyIssueishQuery();
    model.setToken('https://api.github.com', '1234');
    sinon.stub(model, 'getScopes').resolves(GithubLoginModel.REQUIRED_SCOPES);

    const wrapper = mount(buildApp());

    resolve();

    await assert.async.isTrue(wrapper.update().find('RemoteController').exists());
    const controller = wrapper.find('RemoteController');
    assert.strictEqual(controller.prop('token'), '1234');
    assert.deepEqual(controller.prop('repository'), {
      defaultBranchRef: {
        prefix: 'refs/heads/',
        name: 'master',
      },
    });
  });
});
