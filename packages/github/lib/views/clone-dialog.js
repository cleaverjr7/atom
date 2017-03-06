import React from 'react';
import {autobind} from 'core-decorators';
import {CompositeDisposable} from 'atom';
import url from 'url';
import path from 'path';

import Commands, {Command} from './commands';

export default class CloneDialog extends React.Component {
  static propTypes = {
    config: React.PropTypes.object.isRequired,
    commandRegistry: React.PropTypes.object.isRequired,
    inProgress: React.PropTypes.bool,
    didAccept: React.PropTypes.func,
    didCancel: React.PropTypes.func,
  }

  static defaultProps = {
    inProgress: false,
    didAccept: () => {},
    didCancel: () => {},
  }

  constructor(props, context) {
    super(props, context);

    this.state = {
      cloneDisabled: false,
    };

    this.projectHome = this.props.config.get('core.projectHome');
    this.subs = new CompositeDisposable();
  }

  componentDidMount() {
    if (this.projectPathEditor) {
      this.projectPathEditor.setText(this.props.config.get('core.projectHome'));
      this.projectPathModified = false;
    }

    if (this.remoteUrlElement) {
      setTimeout(() => this.remoteUrlElement.focus());
    }
  }

  render() {
    if (!this.props.inProgress) {
      return this.renderDialog();
    } else {
      return this.renderSpinner();
    }
  }

  renderDialog() {
    return (
      <div className="github-Clone modal">
        <Commands registry={this.props.commandRegistry} target=".github-Clone">
          <Command command="core:cancel" callback={this.cancel} />
          <Command command="core:confirm" callback={this.clone} />
        </Commands>
        <main className="github-CloneInputs">
          <label className="github-CloneLabel github-CloneUrl">
            Clone from
            <atom-text-editor mini={true} ref={this.editorRefs('remoteUrl')} tabIndex="1" />
          </label>
          <label className="github-CloneLabel github-ProjectPath">
            To directory
            <atom-text-editor mini={true} ref={this.editorRefs('projectPath')} tabIndex="2" />
          </label>
        </main>
        <div className="github-CloneButtons">
          <button className="btn github-CancelButton" onClick={this.cancel} tabIndex="3">
            Cancel
          </button>
          <button
            className="btn btn-primary icon icon-repo-clone"
            onClick={this.clone}
            disabled={this.state.cloneDisabled}
            tabIndex="4">
            Clone
          </button>
        </div>
      </div>
    );
  }

  renderSpinner() {
    return (
      <div className="github-Clone modal">
        <main className="github-CloneSpinner">
          <span className="loading loading-spinner-large">
            Cloning <em>{this.getRemoteUrl()}</em>
          </span>
        </main>
      </div>
    );
  }

  @autobind
  clone() {
    if (this.getRemoteUrl().length === 0 || this.getProjectPath().length === 0) {
      return;
    }

    this.props.didAccept(this.getRemoteUrl(), this.getProjectPath());
  }

  @autobind
  cancel() {
    this.props.didCancel();
  }

  @autobind
  didChangeRemoteUrl() {
    if (!this.projectPathModified) {
      const name = path.basename(url.parse(this.getRemoteUrl()).pathname, '.git') || '';

      if (name.length > 0) {
        const proposedPath = path.join(this.projectHome, name);
        this.projectPathEditor.setText(proposedPath);
        this.projectPathModified = false;
      }
    }

    this.setCloneEnablement();
  }

  @autobind
  didChangeProjectPath() {
    this.projectPathModified = true;
    this.setCloneEnablement();
  }

  @autobind
  editorRefs(baseName) {
    const elementName = `${baseName}Element`;
    const modelName = `${baseName}Editor`;
    const subName = `${baseName}Subs`;
    const changeMethodName = `didChange${baseName[0].toUpperCase()}${baseName.substring(1)}`;

    return element => {
      if (!element) {
        return;
      }

      this[elementName] = element;
      const editor = element.getModel();
      if (this[modelName] !== editor) {
        this[modelName] = editor;

        if (this[subName]) {
          this[subName].dispose();
          this.subs.remove(this[subName]);
        }

        this[subName] = editor.onDidChange(this[changeMethodName]);
        this.subs.add(this[subName]);
      }
    };
  }

  getProjectPath() {
    return this.projectPathEditor ? this.projectPathEditor.getText() : '';
  }

  getRemoteUrl() {
    return this.remoteUrlEditor ? this.remoteUrlEditor.getText() : '';
  }

  setCloneEnablement() {
    const disabled = this.getRemoteUrl().length === 0 || this.getProjectPath().length === 0;
    this.setState({cloneDisabled: disabled});
  }
}
