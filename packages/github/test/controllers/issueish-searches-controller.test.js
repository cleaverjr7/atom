import React from 'react';
import {shallow} from 'enzyme';

import {createRepositoryResult} from '../fixtures/factories/repository-result';
import {createPullRequestResult} from '../fixtures/factories/pull-request-result';
import IssueishSearchesController from '../../lib/controllers/issueish-searches-controller';
import Remote from '../../lib/models/remote';
import RemoteSet from '../../lib/models/remote-set';
import Branch from '../../lib/models/branch';
import BranchSet from '../../lib/models/branch-set';
import Issueish from '../../lib/models/issueish';
import {getEndpoint} from '../../lib/models/endpoint';
import {nullOperationStateObserver} from '../../lib/models/operation-state-observer';
import * as reporterProxy from '../../lib/reporter-proxy';

describe('IssueishSearchesController', function() {
  let atomEnv;
  const origin = new Remote('origin', 'git@github.com:atom/github.git');
  const upstreamMaster = Branch.createRemoteTracking('origin/master', 'origin', 'refs/heads/master');
  const master = new Branch('master', upstreamMaster);

  beforeEach(function() {
    atomEnv = global.buildAtomEnvironment();
  });

  afterEach(function() {
    atomEnv.destroy();
  });

  function buildApp(overloadProps = {}) {
    const branches = new BranchSet();
    branches.add(master);

    return (
      <IssueishSearchesController
        token="1234"
        endpoint={getEndpoint('github.com')}
        repository={createRepositoryResult()}

        remoteOperationObserver={nullOperationStateObserver}
        workingDirectory={__dirname}
        workspace={atomEnv.workspace}
        remote={origin}
        remotes={new RemoteSet([origin])}
        branches={branches}
        aheadCount={0}
        pushInProgress={false}

        onCreatePr={() => {}}

        {...overloadProps}
      />
    );
  }

  it('renders a CurrentPullRequestContainer', function() {
    const branches = new BranchSet();
    branches.add(master);

    const p = {
      token: '4321',
      endpoint: getEndpoint('mygithub.com'),
      repository: createRepositoryResult(),
      remote: origin,
      remotes: new RemoteSet([origin]),
      branches,
      aheadCount: 4,
      pushInProgress: true,
    };

    const wrapper = shallow(buildApp(p));
    const container = wrapper.find('CurrentPullRequestContainer');
    assert.isTrue(container.exists());

    for (const key in p) {
      assert.strictEqual(container.prop(key), p[key], `expected prop ${key} to be passed`);
    }
  });

  it('renders an IssueishSearchContainer for each Search', function() {
    const wrapper = shallow(buildApp());
    assert.isTrue(wrapper.state('searches').length > 0);

    for (const search of wrapper.state('searches')) {
      const list = wrapper.find('IssueishSearchContainer').filterWhere(w => w.prop('search') === search);
      assert.isTrue(list.exists());
      assert.strictEqual(list.prop('token'), '1234');
      assert.strictEqual(list.prop('endpoint').getHost(), 'github.com');
    }
  });

  it('passes a handler to open an issueish pane and reports an event', async function() {
    sinon.spy(atomEnv.workspace, 'open');

    const wrapper = shallow(buildApp());
    const container = wrapper.find('IssueishSearchContainer').at(0);

    const issueish = new Issueish(createPullRequestResult({number: 123}));

    sinon.stub(reporterProxy, 'addEvent');
    await container.prop('onOpenIssueish')(issueish);
    assert.isTrue(
      atomEnv.workspace.open.calledWith(
        `atom-github://issueish/github.com/atom/github/123?workdir=${encodeURIComponent(__dirname)}`,
        {pending: true, searchAllPanes: true},
      ),
    );
    assert.isTrue(reporterProxy.addEvent.calledWith('open-issueish-in-pane', {package: 'github', from: 'issueish-list'}));
  });
});
