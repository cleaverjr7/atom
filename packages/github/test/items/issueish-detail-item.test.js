import React from 'react';
import {mount} from 'enzyme';
import {CompositeDisposable} from 'event-kit';

import {cloneRepository, deferSetState} from '../helpers';
import IssueishDetailItem from '../../lib/items/issueish-detail-item';
import PaneItem from '../../lib/atom/pane-item';
import WorkdirContextPool from '../../lib/models/workdir-context-pool';
import GithubLoginModel from '../../lib/models/github-login-model';
import {InMemoryStrategy} from '../../lib/shared/keytar-strategy';
import * as reporterProxy from '../../lib/reporter-proxy';

describe('IssueishDetailItem', function() {
  let atomEnv, workdirContextPool, subs;

  beforeEach(function() {
    atomEnv = global.buildAtomEnvironment();
    workdirContextPool = new WorkdirContextPool();

    subs = new CompositeDisposable();
  });

  afterEach(function() {
    subs.dispose();
    atomEnv.destroy();
  });

  function buildApp(override = {}) {
    const props = {
      workdirContextPool,
      loginModel: new GithubLoginModel(InMemoryStrategy),

      workspace: atomEnv.workspace,
      commands: atomEnv.commands,
      keymaps: atomEnv.keymaps,
      tooltips: atomEnv.tooltips,
      config: atomEnv.config,

      onTabSelected: () => {},
      selectedTab: 0,
      reportMutationErrors: () => {},

      ...override,
    };

    return (
      <PaneItem workspace={atomEnv.workspace} uriPattern={IssueishDetailItem.uriPattern}>
        {({itemHolder, params}) => (
          <IssueishDetailItem
            ref={itemHolder.setter}
            {...params}
            issueishNumber={parseInt(params.issueishNumber, 10)}
            {...props}
          />
        )}
      </PaneItem>
    );
  }

  it('renders within the workspace center', async function() {
    const wrapper = mount(buildApp({}));

    const uri = IssueishDetailItem.buildURI('one.com', 'me', 'code', 400, __dirname);
    const item = await atomEnv.workspace.open(uri);

    assert.lengthOf(wrapper.update().find('IssueishDetailItem'), 1);

    const centerPaneItems = atomEnv.workspace.getCenter().getPaneItems();
    assert.include(centerPaneItems.map(i => i.getURI()), uri);

    assert.strictEqual(item.getURI(), uri);
    assert.strictEqual(item.getTitle(), 'me/code#400');
  });

  describe('issueish switching', function() {
    let atomGithubRepo, atomAtomRepo;

    beforeEach(async function() {
      const atomGithubWorkdir = await cloneRepository();
      atomGithubRepo = workdirContextPool.add(atomGithubWorkdir).getRepository();
      await atomGithubRepo.getLoadPromise();
      await atomGithubRepo.addRemote('upstream', 'git@github.com:atom/github.git');

      const atomAtomWorkdir = await cloneRepository();
      atomAtomRepo = workdirContextPool.add(atomAtomWorkdir).getRepository();
      await atomAtomRepo.getLoadPromise();
      await atomAtomRepo.addRemote('upstream', 'https://github.com/atom/atom.git');
    });

    it('automatically switches when opened with an empty workdir', async function() {
      const wrapper = mount(buildApp({workdirContextPool}));
      const uri = IssueishDetailItem.buildURI('host.com', 'atom', 'atom', 500);
      await atomEnv.workspace.open(uri);

      const item = wrapper.update().find('IssueishDetailItem');
      assert.strictEqual(item.prop('workingDirectory'), '');
      await assert.async.strictEqual(
        wrapper.update().find('IssueishDetailContainer').prop('repository'),
        atomAtomRepo,
      );
    });

    it('switches to a different issueish', async function() {
      const wrapper = mount(buildApp({workdirContextPool}));
      await atomEnv.workspace.open(IssueishDetailItem.buildURI('host.com', 'me', 'original', 1, __dirname));

      const before = wrapper.update().find('IssueishDetailContainer');
      assert.strictEqual(before.prop('endpoint').getHost(), 'host.com');
      assert.strictEqual(before.prop('owner'), 'me');
      assert.strictEqual(before.prop('repo'), 'original');
      assert.strictEqual(before.prop('issueishNumber'), 1);

      await wrapper.find('IssueishDetailContainer').prop('switchToIssueish')('you', 'switched', 2);

      const after = wrapper.update().find('IssueishDetailContainer');
      assert.strictEqual(after.prop('endpoint').getHost(), 'host.com');
      assert.strictEqual(after.prop('owner'), 'you');
      assert.strictEqual(after.prop('repo'), 'switched');
      assert.strictEqual(after.prop('issueishNumber'), 2);
    });

    it('changes the active repository when its issueish changes', async function() {
      const wrapper = mount(buildApp({workdirContextPool}));
      await atomEnv.workspace.open(IssueishDetailItem.buildURI('host.com', 'me', 'original', 1, __dirname));

      wrapper.update();

      await wrapper.find('IssueishDetailContainer').prop('switchToIssueish')('atom', 'github', 2);
      wrapper.update();
      assert.strictEqual(wrapper.find('IssueishDetailContainer').prop('repository'), atomGithubRepo);

      await wrapper.find('IssueishDetailContainer').prop('switchToIssueish')('atom', 'atom', 100);
      wrapper.update();
      assert.strictEqual(wrapper.find('IssueishDetailContainer').prop('repository'), atomAtomRepo);
    });

    it('reverts to an absent repository when no matching repository is found', async function() {
      const workdir = atomAtomRepo.getWorkingDirectoryPath();
      const wrapper = mount(buildApp({workdirContextPool}));
      await atomEnv.workspace.open(IssueishDetailItem.buildURI('github.com', 'atom', 'atom', 5, workdir));

      wrapper.update();
      assert.strictEqual(wrapper.find('IssueishDetailContainer').prop('repository'), atomAtomRepo);

      await wrapper.find('IssueishDetailContainer').prop('switchToIssueish')('another', 'repo', 100);
      wrapper.update();
      assert.isTrue(wrapper.find('IssueishDetailContainer').prop('repository').isAbsent());
    });

    it('aborts a repository swap when pre-empted', async function() {
      const wrapper = mount(buildApp({workdirContextPool}));
      const item = await atomEnv.workspace.open(IssueishDetailItem.buildURI('github.com', 'another', 'repo', 5, __dirname));

      wrapper.update();

      const {resolve: resolve0, started: started0} = deferSetState(item.getRealItem());
      const swap0 = wrapper.find('IssueishDetailContainer').prop('switchToIssueish')('atom', 'github', 100);
      await started0;

      const {resolve: resolve1} = deferSetState(item.getRealItem());
      const swap1 = wrapper.find('IssueishDetailContainer').prop('switchToIssueish')('atom', 'atom', 200);

      resolve1();
      await swap1;
      resolve0();
      await swap0;

      wrapper.update();
      assert.strictEqual(wrapper.find('IssueishDetailContainer').prop('repository'), atomAtomRepo);
    });

    it('reverts to an absent repository when multiple potential repositories are found', async function() {
      const workdir = await cloneRepository();
      const repo = workdirContextPool.add(workdir).getRepository();
      await repo.getLoadPromise();
      await repo.addRemote('upstream', 'https://github.com/atom/atom.git');

      const wrapper = mount(buildApp({workdirContextPool}));
      await atomEnv.workspace.open(IssueishDetailItem.buildURI('host.com', 'me', 'original', 1, __dirname));
      wrapper.update();

      await wrapper.find('IssueishDetailContainer').prop('switchToIssueish')('atom', 'atom', 100);
      wrapper.update();

      assert.strictEqual(wrapper.find('IssueishDetailContainer').prop('owner'), 'atom');
      assert.strictEqual(wrapper.find('IssueishDetailContainer').prop('repo'), 'atom');
      assert.strictEqual(wrapper.find('IssueishDetailContainer').prop('issueishNumber'), 100);
      assert.isTrue(wrapper.find('IssueishDetailContainer').prop('repository').isAbsent());
    });

    it('preserves the current repository when switching if possible, even if others match', async function() {
      const workdir = await cloneRepository();
      const repo = workdirContextPool.add(workdir).getRepository();
      await repo.getLoadPromise();
      await repo.addRemote('upstream', 'https://github.com/atom/atom.git');

      const wrapper = mount(buildApp({workdirContextPool}));
      await atomEnv.workspace.open(IssueishDetailItem.buildURI('github.com', 'atom', 'atom', 1, workdir));
      wrapper.update();

      await wrapper.find('IssueishDetailContainer').prop('switchToIssueish')('atom', 'atom', 100);
      wrapper.update();

      assert.strictEqual(wrapper.find('IssueishDetailContainer').prop('owner'), 'atom');
      assert.strictEqual(wrapper.find('IssueishDetailContainer').prop('repo'), 'atom');
      assert.strictEqual(wrapper.find('IssueishDetailContainer').prop('issueishNumber'), 100);
      assert.strictEqual(wrapper.find('IssueishDetailContainer').prop('repository'), repo);
    });

    it('records an event after switching', async function() {
      const wrapper = mount(buildApp({workdirContextPool}));
      await atomEnv.workspace.open(IssueishDetailItem.buildURI('host.com', 'me', 'original', 1, __dirname));

      wrapper.update();

      sinon.stub(reporterProxy, 'addEvent');
      await wrapper.find('IssueishDetailContainer').prop('switchToIssueish')('atom', 'github', 2);
      assert.isTrue(reporterProxy.addEvent.calledWith('open-issueish-in-pane', {package: 'github', from: 'issueish-link', target: 'current-tab'}));
    });
  });

  it('reconstitutes its original URI', async function() {
    const wrapper = mount(buildApp({}));

    const uri = IssueishDetailItem.buildURI('host.com', 'me', 'original', 1, __dirname);
    const item = await atomEnv.workspace.open(uri);
    assert.strictEqual(item.getURI(), uri);
    assert.strictEqual(item.serialize().uri, uri);

    wrapper.update().find('IssueishDetailContainer').prop('switchToIssueish')('you', 'switched', 2);

    assert.strictEqual(item.getURI(), uri);
    assert.strictEqual(item.serialize().uri, uri);
  });

  it('broadcasts title changes', async function() {
    const wrapper = mount(buildApp({}));
    const item = await atomEnv.workspace.open(IssueishDetailItem.buildURI('host.com', 'user', 'repo', 1, __dirname));
    assert.strictEqual(item.getTitle(), 'user/repo#1');

    const handler = sinon.stub();
    subs.add(item.onDidChangeTitle(handler));

    wrapper.update().find('IssueishDetailContainer').prop('onTitleChange')('SUP');
    assert.strictEqual(handler.callCount, 1);
    assert.strictEqual(item.getTitle(), 'SUP');

    wrapper.update().find('IssueishDetailContainer').prop('onTitleChange')('SUP');
    assert.strictEqual(handler.callCount, 1);
  });

  it('tracks pending state termination', async function() {
    mount(buildApp({}));
    const item = await atomEnv.workspace.open(IssueishDetailItem.buildURI('host.com', 'user', 'repo', 1, __dirname));

    const handler = sinon.stub();
    subs.add(item.onDidTerminatePendingState(handler));

    item.terminatePendingState();
    assert.strictEqual(handler.callCount, 1);

    item.terminatePendingState();
    assert.strictEqual(handler.callCount, 1);
  });

  describe('observeEmbeddedTextEditor() to interoperate with find-and-replace', function() {
    let sub, uri, editor;

    beforeEach(function() {
      editor = Symbol('editor');
      uri = IssueishDetailItem.buildURI('one.com', 'me', 'code', 400, __dirname);
    });

    afterEach(function() {
      sub && sub.dispose();
    });

    it('calls its callback immediately if an editor is present', async function() {
      const wrapper = mount(buildApp());
      const item = await atomEnv.workspace.open(uri);

      wrapper.update().find('IssueishDetailContainer').prop('refEditor').setter(editor);

      const cb = sinon.spy();
      sub = item.observeEmbeddedTextEditor(cb);
      assert.isTrue(cb.calledWith(editor));
    });

    it('calls its callback later if the editor changes', async function() {
      const wrapper = mount(buildApp());
      const item = await atomEnv.workspace.open(uri);

      const cb = sinon.spy();
      sub = item.observeEmbeddedTextEditor(cb);

      wrapper.update().find('IssueishDetailContainer').prop('refEditor').setter(editor);
      assert.isTrue(cb.calledWith(editor));
    });
  });
});
