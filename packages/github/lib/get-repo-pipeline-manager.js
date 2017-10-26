import path from 'path';

import ActionPipelineManager from './action-pipeline';
import {GitError} from './git-shell-out-strategy';
import {deleteFileOrFolder} from './helpers';
import FilePatchController from './controllers/file-patch-controller';

export default function({confirm, notificationManager, workspace}) {
  const pipelineManager = new ActionPipelineManager({
    actionNames: ['PUSH', 'PULL', 'FETCH', 'COMMIT', 'CHECKOUT'],
  });

  const pushPipeline = pipelineManager.getPipeline(pipelineManager.actionKeys.PUSH);
  pushPipeline.addMiddleware('confirm-force-push', async (next, repository, branchName, options) => {
    if (options.force) {
      const choice = confirm({
        message: 'Are you sure you want to force push?',
        detailedMessage: 'This operation could result in losing data on the remote.',
        buttons: ['Force Push', 'Cancel Push'],
      });
      if (choice !== 0) { /* do nothing */ } else { await next(); }
    } else {
      await next();
    }
  });
  pushPipeline.addMiddleware('set-push-in-progress', async (next, repository, branchName, options) => {
    repository.setOperationProgressState('push', true);
    await next();
    repository.setOperationProgressState('push', false);
  });
  pushPipeline.addMiddleware('failed-to-push-error', async (next, repository, branchName, options) => {
    try {
      const result = await next();
      return result;
    } catch (error) {
      if (!(error instanceof GitError)) { throw error; }
      if (/rejected[\s\S]*failed to push/.test(error.stdErr)) {
        notificationManager.addError('Push rejected', {
          description: 'The tip of your current branch is behind its remote counterpart.' +
            ' Try pulling before pushing again. Or, to force push, hold `cmd` or `ctrl` while clicking.',
          dismissable: true,
        });
      } else {
        console.error(error);
        notificationManager.addError('Unable to push', {
          description: `<pre>${error.stdErr}</pre>`,
          dismissable: true,
        });
      }
      return error;
    }
  });

  const pullPipeline = pipelineManager.getPipeline(pipelineManager.actionKeys.PULL);
  pullPipeline.addMiddleware('set-pull-in-progress', async (next, repository, branchName) => {
    repository.setOperationProgressState('pull', true);
    await next();
    repository.setOperationProgressState('pull', false);
  });
  pullPipeline.addMiddleware('failed-to-pull-error', async (next, repository, branchName) => {
    try {
      const result = await next();
      return result;
    } catch (error) {
      if (!(error instanceof GitError)) { throw error; }
      if (/error: Your local changes to the following files would be overwritten by merge/.test(error.stdErr)) {
        const lines = error.stdErr.split('\n');
        const files = lines.slice(3, lines.length - 3).map(l => `\`${l.trim()}\``).join('<br>');
        notificationManager.addError('Pull aborted', {
          description: 'Local changes to the following would be overwritten by merge:<br>' + files +
            '<br>Please commit your changes or stash them before you merge.',
          dismissable: true,
        });
      } else if (/Automatic merge failed; fix conflicts and then commit the result./.test(error.stdOut)) {
        repository.didMergeError();
        notificationManager.addInfo('Merge conflicts', {
          description: `Your local changes conflicted with changes made on the remote branch. Resolve the conflicts
            with the Git panel and commit to continue.`,
          dismissable: true,
        });
      } else {
        console.error(error);
        notificationManager.addError('Unable to pull', {
          description: `<pre>${error.stdErr}</pre>`,
          dismissable: true,
        });
      }
      return error;
    }
  });

  const fetchPipeline = pipelineManager.getPipeline(pipelineManager.actionKeys.FETCH);
  fetchPipeline.addMiddleware('set-fetch-in-progress', async (next, repository) => {
    repository.setOperationProgressState('fetch', true);
    await next();
    repository.setOperationProgressState('fetch', false);
  });
  fetchPipeline.addMiddleware('failed-to-fetch-error', async (next, repository) => {
    try {
      const result = await next();
      return result;
    } catch (error) {
      if (!(error instanceof GitError)) { throw error; }
      console.error(error);
      notificationManager.addError('Unable to fetch', {
        description: `<pre>${error.stdErr}</pre>`,
        dismissable: true,
      });
      return error;
    }
  });

  const checkoutPipeline = pipelineManager.getPipeline(pipelineManager.actionKeys.CHECKOUT);
  checkoutPipeline.addMiddleware('set-checkout-in-progress', async (next, repository, branchName) => {
    repository.setOperationProgressState('checkout', branchName);
    await next();
    repository.setOperationProgressState('checkout', false);
  });
  checkoutPipeline.addMiddleware('failed-to-checkout-error', async (next, repository, branchName, options) => {
    try {
      const result = await next();
      return result;
    } catch (error) {
      if (!(error instanceof GitError)) { throw error; }
      const message = options.createNew ? 'Cannot create branch' : 'Checkout aborted';
      let description = `<pre>${error.stdErr}</pre>`;
      if (error.stdErr.match(/local changes.*would be overwritten/)) {
        const files = error.stdErr.split(/\r?\n/).filter(l => l.startsWith('\t'))
          .map(l => `\`${l.trim()}\``).join('<br>');
        description = 'Local changes to the following would be overwritten:<br>' + files +
          '<br>Please commit your changes or stash them.';
      } else if (error.stdErr.match(/branch.*already exists/)) {
        description = `\`${branchName}\` already exists. Choose another branch name.`;
      } else if (error.stdErr.match(/error: you need to resolve your current index first/)) {
        description = 'You must first resolve merge conflicts.';
      } else {
        console.error(error);
      }
      notificationManager.addError(message, {description, dismissable: true});
      return error;
    }
  });

  const commitPipeline = pipelineManager.getPipeline(pipelineManager.actionKeys.COMMIT);
  commitPipeline.addMiddleware('confirm-commit', async (next, repository) => {
    function confirmCommit() {
      const choice = confirm({
        message: 'One or more text editors for the commit message are unsaved.',
        detailedMessage: 'Do you want to commit and close all open commit message editors?',
        buttons: ['Commit', 'Cancel'],
      });
      return choice === 0;
    }

    const commitMessageEditors = getCommitMessageEditors(repository);
    if (commitMessageEditors.length > 0) {
      if (!commitMessageEditors.some(e => e.isModified()) || confirmCommit()) {
        await next();
        commitMessageEditors.forEach(editor => editor.destroy());
      }
    } else {
      await next();
    }
  });
  commitPipeline.addMiddleware('clean-up-disk-commit-msg', async (next, repository) => {
    await next();
    deleteFileOrFolder(getCommitMessagePath(repository))
      .catch(() => null);
  });
  commitPipeline.addMiddleware('set-commit-in-progress', async (next, repository) => {
    repository.setOperationProgressState('commit', true);
    await next();
    repository.setOperationProgressState('commit', false);
  });
  commitPipeline.addMiddleware('failed-to-commit-error', async (next, repository) => {
    try {
      const result = await next();
      repository.setAmending(false);
      repository.setAmendingCommitMessage('');
      repository.setRegularCommitMessage('');
      destroyFilePatchPaneItems({onlyStaged: true});
      return result;
    } catch (error) {
      if (!(error instanceof GitError)) { throw error; }
      const message = 'Unable to commit';
      let description = `<pre>${error.stdErr || error.stack}</pre>`;
      if (error.code === 'ECONFLICT') {
        description = 'All merge conflicts must be resolved first.';
      } else {
        console.error(error);
      }
      notificationManager.addError(message, {description, dismissable: true});
      return error;
    }
  });

  function getCommitMessagePath(repository) {
    return path.join(repository.getGitDirectoryPath(), 'ATOM_COMMIT_EDITMSG');
  }

  function getCommitMessageEditors(repository) {
    if (!repository.isPresent()) {
      return [];
    }
    return workspace.getTextEditors().filter(editor => editor.getPath() === getCommitMessagePath(repository));
  }

  function destroyFilePatchPaneItems({onlyStaged} = {}) {
    const itemsToDestroy = getFilePatchPaneItems({onlyStaged});
    itemsToDestroy.forEach(item => item.destroy());
  }

  function getFilePatchPaneItems({onlyStaged, empty} = {}) {
    return workspace.getPaneItems().filter(item => {
      const isFilePatchItem = item && item.getRealItem && item.getRealItem() instanceof FilePatchController;
      if (onlyStaged) {
        return isFilePatchItem && item.stagingStatus === 'staged';
      } else if (empty) {
        return isFilePatchItem ? item.isEmpty() : false;
      } else {
        return isFilePatchItem;
      }
    });
  }

  return pipelineManager;
}
