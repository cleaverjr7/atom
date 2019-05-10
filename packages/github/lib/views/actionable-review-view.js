import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import {remote, shell} from 'electron';
import {TextBuffer} from 'atom';
import AtomTextEditor from '../atom/atom-text-editor';
import RefHolder from '../models/ref-holder';
import {addEvent} from '../reporter-proxy';
import Commands, {Command} from '../atom/commands';
const {Menu, MenuItem} = remote;

export default class ActionableReviewView extends React.Component {
  static propTypes = {
    // Model
    originalContent: PropTypes.object.isRequired,
    isPosting: PropTypes.bool,

    // Atom environment
    commands: PropTypes.object.isRequired,
    confirm: PropTypes.func.isRequired,

    // Action methods
    contentUpdater: PropTypes.func.isRequired,

    // Render prop
    render: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);
    this.refEditor = new RefHolder();
    this.refRoot = new RefHolder();
    this.buffer = new TextBuffer();
    this.state = {editing: false};
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.editing && !prevState.editing) {
      this.buffer.setText(this.props.originalContent.body);
      this.refEditor.map(e => e.getElement().focus());
    }
  }

  render() {
    return this.state.editing ? this.renderEditor() : this.props.render(this.showActionsMenu);
  }

  renderEditor() {
    const className = cx('github-Review-editable', {'github-Review-editable--disabled': this.props.isPosting});

    return (
      <div className={className} ref={this.refRoot.setter}>
        <AtomTextEditor
          buffer={this.buffer}
          lineNumberGutterVisible={false}
          softWrapped={true}
          autoHeight={true}
          readOnly={this.props.isPosting}
          refModel={this.refEditor}
        />
        <footer className="github-Review-editable-footer">
          <button
            className="github-Review-editableCancelButton btn btn-sm"
            title="Cancel editing comment"
            disabled={this.props.isPosting}
            onClick={this.onCancel}>
            Cancel
          </button>
          <button
            className="github-Review-updateCommentButton btn btn-sm btn-primary"
            title="Update comment"
            disabled={this.props.isPosting}
            onClick={this.onSubmitUpdate}>
            Update comment
          </button>
        </footer>
      </div>
    );
  }

  renderCommands() {
    return (
      <Commands registry={this.props.commands} target={this.refRoot}>
        <Command command="github:submit-comment" callback={this.onSubmitUpdate} />
        <Command command="core:cancel" callback={this.onCancel} />
      </Commands>
    );
  }

  onCancel = () => {
    if (this.buffer.getText() === this.props.originalContent.body) {
      this.setState({editing: false});
    } else {
      const choice = this.props.confirm({
        message: 'Are you sure you want to discard your unsaved changes?',
        buttons: ['OK', 'Cancel'],
      });
      if (choice === 0) {
        this.setState({editing: false});
      }
    }
  }

  onSubmitUpdate = () => {
    if (this.buffer.getText() === this.props.originalContent.body || this.buffer.getText() === '') {
      this.setState({editing: false});
      return;
    }
    const didUpdateComment = () => this.setState({editing: false});
    this.props.contentUpdater(this.props.originalContent.id, this.buffer.getText(), didUpdateComment);
  }

  reportAbuse = (commentUrl, author) => {
    return new Promise((resolve, reject) => {
      const url = 'https://github.com/contact/report-content?report=' +
        `${encodeURIComponent(author)}&content_url=${encodeURIComponent(commentUrl)}`;
      shell.openExternal(url, {}, err => {
        if (err) { reject(err); } else {
          resolve();
          addEvent('report-abuse', {package: 'github', component: this.constructor.name});
        }
      });
    });
  }

  openOnGitHub = url => {
    return new Promise((resolve, reject) => {
      shell.openExternal(url, {}, err => {
        if (err) { reject(err); } else {
          resolve();
          addEvent('open-comment-in-browser', {package: 'github', component: this.constructor.name});
        }
      });
    });
  }

  showActionsMenu = (event, content, author) => {
    event.preventDefault();

    const menu = new Menu();

    if (content.viewerCanUpdate) {
      menu.append(new MenuItem({
        label: 'Edit',
        click: () => this.setState({editing: true}),
      }));
    }

    menu.append(new MenuItem({
      label: 'Open on GitHub',
      click: () => this.openOnGitHub(content.url),
    }));

    menu.append(new MenuItem({
      label: 'Report abuse',
      click: () => this.reportAbuse(content.url, author.login),
    }));

    menu.popup(remote.getCurrentWindow());
  }
}
