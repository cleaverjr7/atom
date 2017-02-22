import React from 'react';
import {autobind} from 'core-decorators';

import Commands, {Command} from './commands';
import {GitError} from '../git-shell-out-strategy';

export default class BranchMenuView extends React.Component {
  static propTypes = {
    workspace: React.PropTypes.object.isRequired,
    commandRegistry: React.PropTypes.object.isRequired,
    notificationManager: React.PropTypes.object.isRequired,
    branches: React.PropTypes.arrayOf(React.PropTypes.string),
    branchName: React.PropTypes.string,
    checkout: React.PropTypes.func,
  }

  static defaultProps = {
    checkout: () => Promise.resolve(),
  }

  constructor(props, context) {
    super(props, context);

    this.state = {
      createNew: false,
    };
  }

  render() {
    const TextEditor = this.props.workspace.buildTextEditor;

    const newBranchEditor = (
      <div className="github-BranchMenuView-item github-BranchMenuView-editor">
        <TextEditor
          ref={e => { this.editor = e; }}
          mini={true}
          softWrapped={true}
          placeholderText="enter new branch name"
          lineNumberGutterVisible={false}
          showInvisibles={false}
          scrollPastEnd={false}
        />
      </div>
    );

    const selectBranchView = (
      <select
        className="github-BranchMenuView-item github-BranchMenuView-select input-select"
        onChange={this.didSelectItem}>
        {this.props.branches.map(branch => {
          return <option key={branch} value={branch} selected={branch === this.props.branchName}>{branch}</option>;
        })}
      </select>
    );

    return (
      <div className="github-BranchMenuView">
        <Commands registry={this.props.commandRegistry} target=".github-BranchMenuView-editor atom-text-editor[mini]">
          <Command command="tool-panel:unfocus" callback={this.cancelCreateNewBranch} />
          <Command command="core:cancel" callback={this.cancelCreateNewBranch} />
          <Command command="core:confirm" callback={this.createBranch} />
        </Commands>
        <div className="github-BranchMenuView-selector">
          <span className="github-BranchMenuView-item icon icon-git-branch" />
          { this.state.createNew ? newBranchEditor : selectBranchView }
          <button ref="newBranchButton" className="github-BranchMenuView-item github-BranchMenuView-button btn"
            onClick={this.createBranch}> New Branch </button>
        </div>
      </div>
    );
  }

  @autobind
  async didSelectItem(event) {
    const branchName = event.target.value;
    try {
      await this.props.checkout(branchName);
    } catch (e) {
      if (!(e instanceof GitError)) { throw e; }
      if (e.stdErr.match(/local changes.*would be overwritten/)) {
        const files = e.stdErr.split(/\r?\n/).filter(l => l.startsWith('\t')).map(l => `\`${l.trim()}\``).join('<br>');
        this.props.notificationManager.addError(
          'Checkout aborted',
          {
            description: 'Local changes to the following would be overwritten:<br>' + files +
              '<br>Please commit your changes or stash them.',
            dismissable: true,
          },
        );
      } else {
        this.props.notificationManager.addError('Checkout aborted', {description: e.stdErr, dismissable: true});
      }
    }
    return null;
  }

  @autobind
  async createBranch() {
    if (this.state.createNew) {
      const branchName = this.editor.getText().trim();
      try {
        await this.props.checkout(branchName, {createNew: true});
      } catch (e) {
        if (!(e instanceof GitError)) { throw e; }
        if (e.stdErr.match(/branch.*already exists/)) {
          this.props.notificationManager.addError(
            'Cannot create branch',
            {
              description: `\`${branchName}\` already exists. Choose another branch name.`,
            },
          );
        } else if (e.stdErr.match(/error: you need to resolve your current index first/)) {
          this.props.notificationManager.addError(
            'Cannot create branch',
            {
              description: 'You must first resolve merge conflicts.',
            },
          );
        } else {
          this.props.notificationManager.addError('Cannot create branch', {description: e.stdErr, dismissable: true});
        }
        this.setState({createNew: false});
      }
    } else {
      this.setState({createNew: true});
    }
  }

  @autobind
  cancelCreateNewBranch() {
    this.setState({createNew: false});
  }
}
