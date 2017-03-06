import React from 'react';
import {mount} from 'enzyme';

import CloneDialog from '../../lib/views/clone-dialog';

describe('CloneDialog', function() {
  let atomEnv, config;
  let wrapper, didAccept, didCancel;

  beforeEach(function() {
    atomEnv = global.buildAtomEnvironment();
    config = atomEnv.config;
    sinon.stub(config, 'get').returns('/home/me/codes');

    didAccept = sinon.stub();
    didCancel = sinon.stub();

    const app = (
      <CloneDialog
        config={config}
        didAccept={didAccept}
        didCancel={didCancel}
      />
    );
    wrapper = mount(app);
  });

  afterEach(function() {
    atomEnv.destroy();
  });

  const setTextIn = function(selector, text) {
    wrapper.find(selector).getDOMNode().getModel().setText(text);
  };

  describe('entering a remote URL', function() {
    it("updates the project path automatically if it hasn't been modified", function() {
      setTextIn('.github-CloneUrl atom-text-editor', 'git@github.com:atom/github.git');

      assert.equal(wrapper.instance().getProjectPath(), '/home/me/codes/github');
    });

    it('updates the project path for https URLs', function() {
      setTextIn('.github-CloneUrl atom-text-editor', 'https://github.com/smashwilson/slack-emojinator.git');

      assert.equal(wrapper.instance().getProjectPath(), '/home/me/codes/slack-emojinator');
    });

    it("doesn't update the project path if it has been modified", function() {
      setTextIn('.github-ProjectPath atom-text-editor', '/somewhere/else/');
      setTextIn('.github-CloneUrl atom-text-editor', 'git@github.com:atom/github.git');

      assert.equal(wrapper.instance().getProjectPath(), '/somewhere/else/');
    });

    it('does update the project path if it was modified automatically', function() {
      setTextIn('.github-CloneUrl atom-text-editor', 'git@github.com:atom/atom1.git');
      assert.equal(wrapper.instance().getProjectPath(), '/home/me/codes/atom1');

      setTextIn('.github-CloneUrl atom-text-editor', 'git@github.com:atom/atom2.git');
      assert.equal(wrapper.instance().getProjectPath(), '/home/me/codes/atom2');
    });
  });

  describe('clone button enablement', function() {
    it('disables the clone button with no remote URL', function() {
      setTextIn('.github-ProjectPath atom-text-editor', '/somewhere/else/');
      setTextIn('.github-CloneUrl atom-text-editor', '');

      assert.isTrue(wrapper.find('button.icon-repo-clone').prop('disabled'));
    });

    it('disables the clone button with no project path', function() {
      setTextIn('.github-ProjectPath atom-text-editor', '');
      setTextIn('.github-CloneUrl atom-text-editor', 'git@github.com:atom/github.git');

      assert.isTrue(wrapper.find('button.icon-repo-clone').prop('disabled'));
    });

    it('enables the clone button when both text boxes are populated', function() {
      setTextIn('.github-ProjectPath atom-text-editor', '/somewhere/else/');
      setTextIn('.github-CloneUrl atom-text-editor', 'git@github.com:atom/github.git');

      assert.isFalse(wrapper.find('button.icon-repo-clone').prop('disabled'));
    });
  });

  it('calls the acceptance callback', function() {
    setTextIn('.github-ProjectPath atom-text-editor', '/somewhere/directory/');
    setTextIn('.github-CloneUrl atom-text-editor', 'git@github.com:atom/atom.git');

    wrapper.find('button.icon-repo-clone').simulate('click');

    assert.isTrue(didAccept.calledWith('git@github.com:atom/atom.git', '/somewhere/directory/'));
  });

  it('calls the cancellation callback', function() {
    wrapper.find('button.github-CancelButton').simulate('click');
    assert.isTrue(didCancel.called);
  });
});
