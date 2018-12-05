import {cloneRepository, buildRepositoryWithPipeline} from './helpers';
import {GitError} from '../lib/git-shell-out-strategy';


describe('getRepoPipelineManager()', function() {

  let atomEnv, workspace, notificationManager, repo, pipelineManager, confirm;

  const getPipeline = (pm, actionName) => {
    const actionKey = pm.actionKeys[actionName];
    return pm.getPipeline(actionKey);
  };

  const buildRepo = (workdir, override = {}) => {
    const option = {
      confirm,
      notificationManager,
      workspace,
      ...override,
    };
    return buildRepositoryWithPipeline(workdir, option);
  };

  const gitErrorStub = (stdErr = '', stdOut = '') => {
    return sinon.stub().throws(() => {
      const err = new GitError();
      err.stdErr = stdErr;
      err.stdOut = stdOut;
      return err;
    });
  };

  beforeEach(async function() {
    atomEnv = global.buildAtomEnvironment();
    workspace = atomEnv.workspace;
    notificationManager = atomEnv.notifications;
    confirm = sinon.stub(atomEnv, 'confirm');

    const workdir = await cloneRepository('multiple-commits');
    repo = await buildRepo(workdir);
    pipelineManager = repo.pipelineManager;
  });

  afterEach(function() {
    atomEnv.destroy();
  });

  it('has all the action pipelines', function() {
    const expectedActions = ['PUSH', 'PULL', 'FETCH', 'COMMIT', 'CHECKOUT', 'ADDREMOTE'];
    for (const actionName of expectedActions) {
      assert.ok(getPipeline(pipelineManager, actionName));
    }
  });

  describe('PUSH pipeline', function() {

    it('confirm-force-push', function() {
      it('before confirming', function() {
        const pushPipeline = getPipeline(pipelineManager, 'PUSH');
        const pushStub = sinon.stub();
        sinon.spy(notificationManager, 'addError');
        pushPipeline.run(pushStub, repo, '', {force: true});
        assert.isTrue(confirm.calledWith({
          message: 'Are you sure you want to force push?',
          detailedMessage: 'This operation could result in losing data on the remote.',
          buttons: ['Force Push', 'Cancel'],
        }));
        assert.isTrue(pushStub.called());
      });

      it('after confirming', async function() {
        const nWorkdir = await cloneRepository('multiple-commits');
        const confirmStub = sinon.stub(atomEnv, 'confirm').return(0);
        const nRepo = buildRepo(nWorkdir, {confirm: confirmStub});
        const pushPipeline = getPipeline(nRepo.pipelineManager, 'PUSH');
        const pushStub = sinon.stub();
        sinon.spy(notificationManager, 'addError');

        pushPipeline.run(pushStub, repo, '', {force: true});
        assert.isFalse(confirm.called);
        assert.isFalse(pushStub.called);
      });
    });

    it('set-push-in-progress', async function() {
      const pushPipeline = getPipeline(pipelineManager, 'PUSH');
      const pushStub = sinon.stub().callsFake(() => {
        assert.isTrue(repo.getOperationStates().isPushInProgress());
        return Promise.resolve();
      });
      pushPipeline.run(pushStub, repo, '', {});
      assert.isTrue(pushStub.called);
      await assert.async.isFalse(repo.getOperationStates().isPushInProgress());
    });

    it('failed-to-push-error', function() {
      const pushPipeline = getPipeline(pipelineManager, 'PUSH');
      sinon.spy(notificationManager, 'addError');


      pushPipeline.run(gitErrorStub('rejected failed to push'), repo, '', {});
      assert.isTrue(notificationManager.addError.calledWithMatch('Push rejected', {dismissable: true}));

      pushPipeline.run(gitErrorStub('something else'), repo, '', {});
      assert.isTrue(notificationManager.addError.calledWithMatch('Unable to push', {dismissable: true}));
    });
  });

  describe('COMMIT pipeline', function() {
    it('confirm-commit', function() {

    });

    it('clean-up-disk-commit-msg', function() {

    });

    it('set-commit-in-progress', function() {

    });

    it('failed-to-commit-error', function() {

    });
  });

  describe('ADDREMOTE pipeline', function() {
    it('failed-to-add-remote', function() {

    });
  });
});
