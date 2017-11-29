/** @jsx etch.dom */
/* eslint react/no-unknown-property: "off" */

import {TextEditor} from 'atom';
import {CompositeDisposable} from 'event-kit';

import etch from 'etch';
import {autobind} from 'core-decorators';
import cx from 'classnames';

import {shortenSha} from '../helpers';

const LINE_ENDING_REGEX = /\r?\n/;

export default class CommitView {
  static focus = {
    EDITOR: Symbol('commit-editor'),
    ABORT_MERGE_BUTTON: Symbol('commit-abort-merge-button'),
    AMEND_BOX: Symbol('commit-amend-box'),
    COMMIT_BUTTON: Symbol('commit-button'),
  };

  constructor(props) {
    this.props = props;

    etch.initialize(this);

    this.editor = this.refs.editor;
    // FIXME Use props-injected view registry instead of the Atom global
    this.editorElement = atom.views.getView(this.editor);
    this.editor.setText(this.props.message || '');
    this.subscriptions = new CompositeDisposable(
      this.editor.onDidChange(() => this.props.onChangeMessage && this.props.onChangeMessage(this.editor.getText())),
      this.editor.onDidChangeCursorPosition(() => { etch.update(this); }),
      props.commandRegistry.add('atom-workspace', {
        'github:commit': this.commit,
        'github:toggle-expanded-commit-message-editor': this.toggleExpandedCommitMessageEditor,
      }),
      props.config.onDidChange('github.automaticCommitMessageWrapping', () => etch.update(this)),
    );
    this.registerTooltips();
  }

  destroy() {
    this.subscriptions.dispose();
    etch.destroy(this);
  }

  update(props) {
    const previousMessage = this.props.message;
    this.props = {...this.props, ...props};
    const newMessage = this.props.message;
    if (this.editor && previousMessage !== newMessage && this.editor.getText() !== newMessage) {
      this.editor.setText(newMessage);
    }
    return etch.update(this);
  }

  render() {
    let remainingCharsClassName = '';
    if (this.getRemainingCharacters() < 0) {
      remainingCharsClassName = 'is-error';
    } else if (this.getRemainingCharacters() < this.props.maximumCharacterLimit / 4) {
      remainingCharsClassName = 'is-warning';
    }

    const showAbortMergeButton = this.props.isMerging || null;
    const showAmendBox = (
      !this.props.isMerging &&
      this.props.lastCommit.isPresent() &&
      !this.props.lastCommit.isUnbornRef()
    ) || null;

    return (
      <div className="github-CommitView" ref="CommitView">
        <div className={cx('github-CommitView-editor', {'is-expanded': this.props.deactivateCommitBox})}>
          <TextEditor
            ref="editor"
            softWrapped={true}
            placeholderText="Commit message"
            lineNumberGutterVisible={false}
            showInvisibles={false}
            autoHeight={false}
            scrollPastEnd={false}
          />
          {this.renderHardWrapIcons()}
          <button className="github-CommitView-expandButton icon icon-screen-full"
            onClick={this.toggleExpandedCommitMessageEditor}
          />
        </div>
        <footer className="github-CommitView-bar">
          {showAbortMergeButton &&
            <button ref="abortMergeButton" className="btn github-CommitView-button is-secondary"
              onclick={this.abortMerge}>Abort Merge</button>
          }
          {showAmendBox &&
            <label className="github-CommitView-label input-label">
              <input
                ref="amend"
                className="input-checkbox"
                type="checkbox"
                onclick={this.handleAmendBoxClick}
                checked={this.props.isAmending}
              /> Amend
            </label>
          }
          <button ref="commitButton" className="btn github-CommitView-button"
            onclick={this.commit}
            disabled={!this.isCommitButtonEnabled()}>{this.commitButtonText()}</button>
          <div ref="remainingCharacters"
            className={`github-CommitView-remaining-characters ${remainingCharsClassName}`}>
            {this.getRemainingCharacters()}
          </div>
        </footer>
      </div>
    );
  }

  @autobind
  renderHardWrapIcons() {
    const singleLineMessage = this.editor && this.editor.getText().split(LINE_ENDING_REGEX).length === 1;
    const hardWrap = this.props.config.get('github.automaticCommitMessageWrapping');
    const notApplicable = this.props.deactivateCommitBox || singleLineMessage;
    return (
      <div onclick={this.toggleHardWrap} className="github-CommitView-hardwrap hard-wrap-icons">
        <div className={cx('icon', 'no-hardwrap', 'icon-hardwrap-disabled', {hidden: notApplicable || hardWrap})}>
          <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <g fillRule="evenodd">
              <path d="M6.88 9.5H6v2l-3.5-3 3.5-3v2h.88l1 1-1 1zM9 5.38V4.5h2v.88l-1 1-1-1z" />
              <path d="M8.225 10.968L9.993 9.2l1.767 1.768.778-.778-1.768-1.768 1.698-1.697-.708-.707-1.767 1.768-1.768-1.768-.707.707 1.768 1.768-1.768 1.767z" />
            </g>
          </svg>
        </div>
        <div className={cx('icon', 'hardwrap', 'icon-hardwrap-enabled', {hidden: notApplicable || !hardWrap})}>
          <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 8c0 .825-.675 1.5-1.5 1.5H6v2l-3.5-3 3.5-3v2h3v-3h2V8z" fillRule="evenodd" />
          </svg>
        </div>
      </div>
    );
  }

  writeAfterUpdate() {
    if (this.props.deactivateCommitBox && this.tooltipsExist()) {
      this.disposeTooltips();
    } else if (!this.props.deactivateCommitBox && !this.tooltipsExist()) {
      this.registerTooltips();
    }
  }

  registerTooltips() {
    const expandButton = this.element.getElementsByClassName('github-CommitView-expandButton')[0];
    const hardWrapButton = this.element.getElementsByClassName('github-CommitView-hardwrap')[0];
    this.expandTooltip = this.props.tooltips.add(expandButton, {
      title: 'Expand commit message editor',
      class: 'github-CommitView-expandButton-tooltip',
    });
    this.hardWrapTooltip = this.props.tooltips.add(hardWrapButton, {
      title: 'Toggle hard wrap on commit',
      class: 'github-CommitView-hardwrap-tooltip',
    });
    this.subscriptions.add(this.expandTooltip, this.hardWrapTooltip);
  }

  tooltipsExist() {
    return this.expandTooltip || this.hardWrapTooltip;
  }

  disposeTooltips() {
    this.expandTooltip && this.expandTooltip.dispose();
    this.hardWrapTooltip && this.hardWrapTooltip.dispose();
    this.expandTooltip = null;
    this.hardWrapTooltip = null;
  }

  @autobind
  toggleHardWrap() {
    const currentSetting = this.props.config.get('github.automaticCommitMessageWrapping');
    this.props.config.set('github.automaticCommitMessageWrapping', !currentSetting);
  }

  @autobind
  abortMerge() {
    this.props.abortMerge();
  }

  @autobind
  handleAmendBoxClick() {
    this.props.setAmending(this.refs.amend.checked);
  }

  @autobind
  async commit() {
    if (await this.props.prepareToCommit() && this.isCommitButtonEnabled()) {
      await this.props.commit(this.editor.getText());
    } else {
      this.setFocus(CommitView.focus.EDITOR);
    }
  }

  getRemainingCharacters() {
    if (this.editor != null) {
      if (this.editor.getCursorBufferPosition().row === 0) {
        return (this.props.maximumCharacterLimit - this.editor.lineTextForBufferRow(0).length).toString();
      } else {
        return '∞';
      }
    } else {
      return this.props.maximumCharacterLimit || '';
    }
  }

  isCommitButtonEnabled() {
    return !this.props.isCommitting &&
      this.props.stagedChangesExist &&
      !this.props.mergeConflictsExist &&
      this.props.lastCommit.isPresent() &&
      (this.props.deactivateCommitBox || (this.editor && this.editor.getText().length !== 0));
  }

  commitButtonText() {
    if (this.props.isAmending) {
      return `Amend commit (${shortenSha(this.props.lastCommit.getSha())})`;
    } else {
      if (this.props.branchName) {
        return `Commit to ${this.props.branchName}`;
      } else {
        return 'Commit';
      }
    }
  }

  @autobind
  toggleExpandedCommitMessageEditor() {
    return this.props.toggleExpandedCommitMessageEditor(this.editor && this.editor.getText());
  }

  rememberFocus(event) {
    if (this.editorElement.contains(event.target)) {
      return CommitView.focus.EDITOR;
    }

    if (this.refs.abortMergeButton && this.refs.abortMergeButton.contains(event.target)) {
      return CommitView.focus.ABORT_MERGE_BUTTON;
    }

    if (this.refs.amend && this.refs.amend.contains(event.target)) {
      return CommitView.focus.AMEND_BOX;
    }

    if (this.refs.commitButton && this.refs.commitButton.contains(event.target)) {
      return CommitView.focus.COMMIT_BUTTON;
    }

    return null;
  }

  setFocus(focus) {
    let fallback = false;

    if (focus === CommitView.focus.EDITOR) {
      this.editorElement.focus();
      return true;
    }

    if (focus === CommitView.focus.ABORT_MERGE_BUTTON) {
      if (this.refs.abortMergeButton) {
        this.refs.abortMergeButton.focus();
        return true;
      } else {
        fallback = true;
      }
    }

    if (focus === CommitView.focus.AMEND_BOX) {
      if (this.refs.amend) {
        this.refs.amend.focus();
        return true;
      } else {
        fallback = true;
      }
    }

    if (focus === CommitView.focus.COMMIT_BUTTON) {
      if (this.refs.commitButton) {
        this.refs.commitButton.focus();
        return true;
      } else {
        fallback = true;
      }
    }

    if (fallback) {
      this.editorElement.focus();
      return true;
    }

    return false;
  }
}
