import {cloneRepository, buildRepository} from '../helpers';
import etch from 'etch';
import until from 'test-until';

import CommitView from '../../lib/views/commit-view';

describe('CommitView', function() {
  let atomEnv, commandRegistry;

  beforeEach(function() {
    atomEnv = global.buildAtomEnvironment();
    commandRegistry = atomEnv.commands;
  });

  afterEach(function() {
    atomEnv.destroy();
  });

  it('displays the remaining characters limit based on which line is being edited', async function() {
    const view = new CommitView({commandRegistry, stagedChangesExist: true, maximumCharacterLimit: 72, message: ''});
    assert.equal(view.refs.remainingCharacters.textContent, '72');

    await view.update({message: 'abcde fghij'});
    assert.equal(view.refs.remainingCharacters.textContent, '61');
    assert(!view.refs.remainingCharacters.classList.contains('is-error'));
    assert(!view.refs.remainingCharacters.classList.contains('is-warning'));

    await view.update({message: '\nklmno'});
    assert.equal(view.refs.remainingCharacters.textContent, '∞');
    assert(!view.refs.remainingCharacters.classList.contains('is-error'));
    assert(!view.refs.remainingCharacters.classList.contains('is-warning'));

    await view.update({message: 'abcde\npqrst'});
    assert.equal(view.refs.remainingCharacters.textContent, '∞');
    assert(!view.refs.remainingCharacters.classList.contains('is-error'));
    assert(!view.refs.remainingCharacters.classList.contains('is-warning'));

    view.editor.setCursorBufferPosition([0, 3]);
    await etch.getScheduler().getNextUpdatePromise();
    assert.equal(view.refs.remainingCharacters.textContent, '67');
    assert(!view.refs.remainingCharacters.classList.contains('is-error'));
    assert(!view.refs.remainingCharacters.classList.contains('is-warning'));

    await view.update({stagedChangesExist: true, maximumCharacterLimit: 50});
    assert.equal(view.refs.remainingCharacters.textContent, '45');
    assert(!view.refs.remainingCharacters.classList.contains('is-error'));
    assert(!view.refs.remainingCharacters.classList.contains('is-warning'));

    await view.update({message: 'a'.repeat(41)});
    assert.equal(view.refs.remainingCharacters.textContent, '9');
    assert(!view.refs.remainingCharacters.classList.contains('is-error'));
    assert(view.refs.remainingCharacters.classList.contains('is-warning'));

    await view.update({message: 'a'.repeat(58)});
    assert.equal(view.refs.remainingCharacters.textContent, '-8');
    assert(view.refs.remainingCharacters.classList.contains('is-error'));
    assert(!view.refs.remainingCharacters.classList.contains('is-warning'));
  });

  it('uses the git commit message grammar when the grammar is loaded', async function() {
    await atom.packages.activatePackage('language-git');

    const view = new CommitView({commandRegistry});
    assert.equal(view.editor.getGrammar().scopeName, 'text.git-commit');
  });

  it('uses the git commit message grammar when the grammar has not been loaded', async function() {
    atom.packages.deactivatePackage('language-git');

    const view = new CommitView({commandRegistry});
    assert(view.editor.getGrammar().scopeName.startsWith('text.plain'));

    await atom.packages.activatePackage('language-git');

    assert.equal(view.editor.getGrammar().scopeName, 'text.git-commit');
  });

  describe('the commit button', function() {
    let view, editor, commitButton;

    beforeEach(async function() {
      const workdirPath = await cloneRepository('three-files');
      const repository = await buildRepository(workdirPath);
      const viewState = {};
      view = new CommitView({repository, commandRegistry, stagedChangesExist: true, mergeConflictsExist: false, viewState});
      editor = view.refs.editor;
      commitButton = view.refs.commitButton;

      editor.setText('something');
      await etch.getScheduler().getNextUpdatePromise();
    });

    it('is disabled when no changes are staged', async function() {
      await view.update({stagedChangesExist: false});
      assert.isTrue(commitButton.disabled);

      await view.update({stagedChangesExist: true});
      assert.isFalse(commitButton.disabled);
    });

    it('is disabled when there are merge conflicts', async function() {
      await view.update({mergeConflictsExist: false});
      assert.isFalse(commitButton.disabled);

      await view.update({mergeConflictsExist: true});
      assert.isTrue(commitButton.disabled);
    });

    it('is disabled when the commit message is empty', async function() {
      editor.setText('');
      await etch.getScheduler().getNextUpdatePromise();
      assert.isTrue(commitButton.disabled);

      editor.setText('Not empty');
      await etch.getScheduler().getNextUpdatePromise();
      assert.isFalse(commitButton.disabled);
    });
  });

  describe('committing', function() {
    let view, commit, prepareToCommitResolution;
    let editor, commitButton, workspaceElement;

    beforeEach(async function() {
      const prepareToCommit = () => Promise.resolve(prepareToCommitResolution);

      commit = sinon.spy();
      view = new CommitView({commandRegistry, stagedChangesExist: true, prepareToCommit, commit, message: 'Something'});
      sinon.spy(view, 'focus');

      editor = view.refs.editor;
      commitButton = view.refs.commitButton;

      workspaceElement = atomEnv.views.getView(atomEnv.workspace);

      await view.update();
    });

    describe('when props.prepareToCommit() resolves true', function() {
      beforeEach(function() { prepareToCommitResolution = true; });

      it('calls props.commit(message) when the commit button is clicked', async function() {
        commitButton.dispatchEvent(new MouseEvent('click'));

        await until('props.commit() is called', () => commit.calledWith('Something'));

        // undo history is cleared
        commandRegistry.dispatch(editor.element, 'core:undo');
        assert.equal(editor.getText(), '');
      });

      it('calls props.commit(message) when github:commit is dispatched', async function() {
        commandRegistry.dispatch(workspaceElement, 'github:commit');

        await until('props.commit() is called', () => commit.calledWith('Something'));
      });
    });

    describe('when props.prepareToCommit() resolves false', function() {
      beforeEach(function() { prepareToCommitResolution = false; });

      it('takes no further action when the commit button is clicked', async function() {
        commitButton.dispatchEvent(new MouseEvent('click'));

        await until('focus() is called', () => view.focus.called);
        assert.isFalse(commit.called);
      });

      it('takes no further action when github:commit is dispatched', async function() {
        commandRegistry.dispatch(workspaceElement, 'github:commit');

        await until('focus() is called', () => view.focus.called);
        assert.isFalse(commit.called);
      });
    });
  });

  it('shows the "Abort Merge" button when props.isMerging is true', async function() {
    const view = new CommitView({commandRegistry, stagedChangesExist: true, isMerging: false});
    const {abortMergeButton} = view.refs;
    assert.equal(abortMergeButton.style.display, 'none');

    await view.update({isMerging: true});
    assert.equal(abortMergeButton.style.display, '');

    await view.update({isMerging: false});
    assert.equal(abortMergeButton.style.display, 'none');
  });

  it('calls props.abortMerge() when the "Abort Merge" button is clicked', function() {
    const abortMerge = sinon.spy(() => Promise.resolve());
    const view = new CommitView({commandRegistry, stagedChangesExist: true, isMerging: true, abortMerge});
    const {abortMergeButton} = view.refs;
    abortMergeButton.dispatchEvent(new MouseEvent('click'));
    assert(abortMerge.calledOnce);
  });

  describe('amending', function() {
    it('calls props.setAmending() when the box is checked or unchecked', function() {
      const setAmending = sinon.spy();
      const view = new CommitView({commandRegistry, stagedChangesExist: false, lastCommit: {message: 'previous commit\'s message'}, setAmending});
      const {amend} = view.refs;

      amend.click();
      assert.deepEqual(setAmending.args, [[true]]);

      amend.click();
      assert.deepEqual(setAmending.args, [[true], [false]]);
    });
  });
});
