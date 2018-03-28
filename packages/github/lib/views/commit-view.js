import React from 'react';
import PropTypes from 'prop-types';
import {CompositeDisposable} from 'event-kit';
import {autobind} from 'core-decorators';
import cx from 'classnames';
import Select from 'react-select';

import Tooltip from './tooltip';
import AtomTextEditor from './atom-text-editor';
import {LINE_ENDING_REGEX} from '../helpers';
import AuthorPropType from '../prop-types'

class FakeKeyDownEvent extends CustomEvent {
  constructor(keyCode) {
    super('keydown');
    this.keyCode = keyCode;
  }
}

export default class CommitView extends React.Component {
  static focus = {
    EDITOR: Symbol('commit-editor'),
    ABORT_MERGE_BUTTON: Symbol('commit-abort-merge-button'),
    COMMIT_BUTTON: Symbol('commit-button'),
  };

  static propTypes = {
    config: PropTypes.object.isRequired,
    tooltips: PropTypes.object.isRequired,
    commandRegistry: PropTypes.object.isRequired,

    lastCommit: PropTypes.object.isRequired,
    currentBranch: PropTypes.object.isRequired,
    isMerging: PropTypes.bool.isRequired,
    mergeConflictsExist: PropTypes.bool.isRequired,
    stagedChangesExist: PropTypes.bool.isRequired,
    isCommitting: PropTypes.bool.isRequired,
    deactivateCommitBox: PropTypes.bool.isRequired,
    maximumCharacterLimit: PropTypes.number.isRequired,
    message: PropTypes.string.isRequired,
    mentionableUsers: PropTypes.arrayOf(AuthorPropType),
    selectedCoAuthors: PropTypes.arrayOf(AuthorPropType),
    updateSelectedCoAuthors: PropTypes.func.isRequired,
    commit: PropTypes.func.isRequired,
    abortMerge: PropTypes.func.isRequired,
    onChangeMessage: PropTypes.func.isRequired,
    prepareToCommit: PropTypes.func.isRequired,
    toggleExpandedCommitMessageEditor: PropTypes.func.isRequired,
  };

  constructor(props, context) {
    super(props, context);

    this.state = {
      showWorking: false,
      showCoAuthorInput: false,
    };

    this.timeoutHandle = null;
    this.subscriptions = new CompositeDisposable();

    this.refExpandButton = null;
    this.refCommitButton = null;
    this.refHardWrapButton = null;
    this.refAbortMergeButton = null;
    this.refCoAuthorSelect = null;
  }

  proxyKeyCode(keyCode) {
    return e => {
      if (!this.refCoAuthorSelect) {
        return;
      }

      const fakeEvent = new FakeKeyDownEvent(keyCode);
      this.refCoAuthorSelect.handleKeyDown(fakeEvent);

      if (!fakeEvent.defaultPrevented) {
        e.abortKeyBinding();
      }
    };
  }

  componentWillMount() {
    this.scheduleShowWorking(this.props);

    this.subscriptions = new CompositeDisposable(
      this.props.commandRegistry.add('atom-workspace', {
        'github:commit': this.commit,
        'github:amend-last-commit': this.amendLastCommit,
        'github:toggle-expanded-commit-message-editor': this.toggleExpandedCommitMessageEditor,

        'github:co-author:down': this.proxyKeyCode(40),
        'github:co-author:up': this.proxyKeyCode(38),
        'github:co-author:enter': this.proxyKeyCode(13),
        'github:co-author:tab': this.proxyKeyCode(9),
        'github:co-author:backspace': this.proxyKeyCode(8),
        'github:co-author:pageup': this.proxyKeyCode(33),
        'github:co-author:pagedown': this.proxyKeyCode(34),
        'github:co-author:end': this.proxyKeyCode(35),
        'github:co-author:home': this.proxyKeyCode(36),
        'github:co-author:delete': this.proxyKeyCode(46),
      }),
      this.props.config.onDidChange('github.automaticCommitMessageWrapping', () => this.forceUpdate()),
    );
  }

  render() {
    let remainingCharsClassName = '';
    if (this.getRemainingCharacters() < 0) {
      remainingCharsClassName = 'is-error';
    } else if (this.getRemainingCharacters() < this.props.maximumCharacterLimit / 4) {
      remainingCharsClassName = 'is-warning';
    }

    const showAbortMergeButton = this.props.isMerging || null;

    return (
      <div className="github-CommitView">
        <div className={cx('github-CommitView-editor', {'is-expanded': this.props.deactivateCommitBox})}>
          <AtomTextEditor
            ref={c => {
              this.editorElement = c;
              this.editor = c && c.getModel();
            }}
            softWrapped={true}
            placeholderText="Commit message"
            lineNumberGutterVisible={false}
            showInvisibles={false}
            autoHeight={false}
            scrollPastEnd={false}
            text={this.props.message}
            didChange={this.didChangeCommitMessage}
            didChangeCursorPosition={this.didMoveCursor}
          />
          <button
            ref={c => { this.refCoAuthorToggle = c; }}
            className="github-CommitView-coAuthorToggle"
            onClick={this.toggleCoAuthorInput}>
            {this.renderCoAuthorToggleIcon()}
          </button>
          <Tooltip
            manager={this.props.tooltips}
            target={() => this.refCoAuthorToggle}
            title="Toggle co-authors"
          />
          <button
            ref={c => { this.refHardWrapButton = c; }}
            onClick={this.toggleHardWrap}
            className="github-CommitView-hardwrap hard-wrap-icons">
            {this.renderHardWrapIcon()}
          </button>
          <Tooltip
            manager={this.props.tooltips}
            target={() => this.refHardWrapButton}
            className="github-CommitView-hardwrap-tooltip"
            title="Toggle hard wrap on commit"
          />
          <button
            ref={c => { this.refExpandButton = c; }}
            className="github-CommitView-expandButton icon icon-screen-full"
            onClick={this.toggleExpandedCommitMessageEditor}
          />
          <Tooltip
            manager={this.props.tooltips}
            target={() => this.refExpandButton}
            className="github-CommitView-expandButton-tooltip"
            title="Expand commit message editor"
          />
        </div>

        {this.renderCoAuthorInput()}

        <footer className="github-CommitView-bar">
          {showAbortMergeButton &&
            <button
              ref={c => { this.refAbortMergeButton = c; }}
              className="btn github-CommitView-button github-CommitView-abortMerge is-secondary"
              onClick={this.abortMerge}>Abort Merge</button>
          }

          <button
            ref={c => { this.refCommitButton = c; }}
            className="github-CommitView-button github-CommitView-commit btn btn-primary"
            onClick={this.commit}
            disabled={!this.isCommitButtonEnabled()}>{this.commitButtonText()}</button>
          <div className={`github-CommitView-remaining-characters ${remainingCharsClassName}`}>
            {this.getRemainingCharacters()}
          </div>
        </footer>
      </div>
    );
  }

  renderCoAuthorToggleIcon() {
    /* eslint-disable max-len */
    const svgPath = 'M9.875 2.125H12v1.75H9.875V6h-1.75V3.875H6v-1.75h2.125V0h1.75v2.125zM6 6.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5V6c0-1.316 2-2 2-2s.114-.204 0-.5c-.42-.31-.472-.795-.5-2C1.587.293 2.434 0 3 0s1.413.293 1.5 1.5c-.028 1.205-.08 1.69-.5 2-.114.295 0 .5 0 .5s2 .684 2 2v.5z';
    return (
      <svg className="github-CommitView-coAuthorToggleIcon" viewBox="0 0 12 7" xmlns="http://www.w3.org/2000/svg">
        <title>Toggle co-authors</title>
        <path d={svgPath} />
      </svg>
    );
  }

  renderCoAuthorInput() {

    if (!this.state.showCoAuthorInput) {
      return null;
    }

    return (
      <Select
        ref={c => { this.refCoAuthorSelect = c; }}
        className="github-CommitView-coAuthorEditor input-textarea native-key-bindings"
        placeholder="Co-Authors"
        arrowRenderer={null}
        options={this.props.mentionableUsers}
        labelKey="name"
        valueKey="email"
        filterOptions={this.matchAuthors}
        optionRenderer={this.renderCoAuthorListItem}
        valueRenderer={this.renderCoAuthorValue}
        onChange={this.onSelectedCoAuthorsChanged}
        value={this.props.selectedCoAuthors}
        multi={true}
      />
    );
  }

  renderHardWrapIcon() {
    const singleLineMessage = this.editor && this.editor.getText().split(LINE_ENDING_REGEX).length === 1;
    const hardWrap = this.props.config.get('github.automaticCommitMessageWrapping');
    const notApplicable = this.props.deactivateCommitBox || singleLineMessage;

    /* eslint-disable max-len */
    const svgPaths = {
      hardWrapEnabled: {
        path1: 'M7.058 10.2h-.975v2.4L2 9l4.083-3.6v2.4h.97l1.202 1.203L7.058 10.2zm2.525-4.865V4.2h2.334v1.14l-1.164 1.165-1.17-1.17z', // eslint-disable-line max-len
        path2: 'M7.842 6.94l2.063 2.063-2.122 2.12.908.91 2.123-2.123 1.98 1.98.85-.848L11.58 8.98l2.12-2.123-.824-.825-2.122 2.12-2.062-2.06z', // eslint-disable-line max-len
      },
      hardWrapDisabled: {
        path1: 'M11.917 8.4c0 .99-.788 1.8-1.75 1.8H6.083v2.4L2 9l4.083-3.6v2.4h3.5V4.2h2.334v4.2z',
      },
    };
    /* eslint-enable max-line */

    if (notApplicable) {
      return null;
    }

    if (hardWrap) {
      return (
        <div className={cx('icon', 'hardwrap', 'icon-hardwrap-enabled', {hidden: notApplicable || !hardWrap})}>
          <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path d={svgPaths.hardWrapDisabled.path1} fillRule="evenodd" />
          </svg>
        </div>
      );
    } else {
      return (
        <div className={cx('icon', 'no-hardwrap', 'icon-hardwrap-disabled', {hidden: notApplicable || hardWrap})}>
          <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <g fillRule="evenodd">
              <path d={svgPaths.hardWrapEnabled.path1} />
              <path fillRule="nonzero" d={svgPaths.hardWrapEnabled.path2} />
            </g>
          </svg>
        </div>
      );
    }
  }

  // componentWillReceiveProps(nextProps) {
  //   this.scheduleShowWorking(nextProps);
  //   this.state.selectedCoAuthors = nextProps.selectedCoAuthors;
  // }

  componentWillUnmount() {
    this.subscriptions.dispose();
  }

  @autobind
  didChangeCommitMessage(editor) {
    this.props.onChangeMessage(editor.getText());
  }

  @autobind
  didMoveCursor() {
    this.forceUpdate();
  }

  @autobind
  toggleHardWrap() {
    const currentSetting = this.props.config.get('github.automaticCommitMessageWrapping');
    this.props.config.set('github.automaticCommitMessageWrapping', !currentSetting);
  }

  @autobind
  toggleCoAuthorInput() {
    this.setState({
      showCoAuthorInput: !this.state.showCoAuthorInput,
    });
  }

  @autobind
  abortMerge() {
    this.props.abortMerge();
  }

  @autobind
  async commit(event, amend) {
    if (await this.props.prepareToCommit() && this.isCommitButtonEnabled(amend)) {
      try {
        await this.props.commit(this.editor.getText(), this.props.selectedCoAuthors, amend);
      } catch (e) {
        // do nothing - error was taken care of in pipeline manager
      }
    } else {
      this.setFocus(CommitView.focus.EDITOR);
    }
  }

  @autobind
  amendLastCommit() {
    this.commit(null, true);
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

  // We don't want the user to see the UI flicker in the case
  // the commit takes a very small time to complete. Instead we
  // will only show the working message if we are working for longer
  // than 1 second as per https://www.nngroup.com/articles/response-times-3-important-limits/
  //
  // The closure is created to restrict variable access
  scheduleShowWorking(props) {
    if (props.isCommitting) {
      if (!this.state.showWorking && this.timeoutHandle === null) {
        this.timeoutHandle = setTimeout(() => {
          this.timeoutHandle = null;
          this.setState({showWorking: true});
        }, 1000);
      }
    } else {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
      this.setState({showWorking: false});
    }
  }

  isCommitButtonEnabled(amend) {
    const messageExists = this.editor && this.editor.getText().length !== 0;
    return !this.props.isCommitting &&
      this.props.stagedChangesExist &&
      !this.props.mergeConflictsExist &&
      this.props.lastCommit.isPresent() &&
      (this.props.deactivateCommitBox || (amend || messageExists));
  }

  commitButtonText() {
    if (this.state.showWorking) {
      return 'Working...';
    } else if (this.props.currentBranch.isDetached()) {
      return 'Create detached commit';
    } else if (this.props.currentBranch.isPresent()) {
      return `Commit to ${this.props.currentBranch.getName()}`;
    } else {
      return 'Commit';
    }
  }

  @autobind
  toggleExpandedCommitMessageEditor() {
    return this.props.toggleExpandedCommitMessageEditor(this.editor && this.editor.getText());
  }

  matchAuthors(authors, filterText, currentValues) {
    return authors
      .filter(x => !currentValues || currentValues.indexOf(x) === -1)
      .filter(x => `${x.name}${x.email}`.toLowerCase().indexOf(filterText.toLowerCase()) !== -1);
  }

  renderCoAuthorListItemField(fieldName, value) {
    if (!value || value.length === 0) {
      return null;
    }

    return (
      <span className={`github-CommitView-coAuthorEditor-${fieldName}`}>{value}</span>
    );
  }

  @autobind
  renderCoAuthorListItem(author) {
    return (
      <div className="github-CommitView-coAuthorEditor-selectListItem">
        {this.renderCoAuthorListItemField('name', author.name)}
        {this.renderCoAuthorListItemField('email', author.email)}
      </div>
    );
  }

  renderCoAuthorValue(author) {
    return (
      <span>{author.name}</span>
    );
  }

  @autobind
  onSelectedCoAuthorsChanged(selectedCoAuthors) {
    this.props.updateSelectedCoAuthors(selectedCoAuthors);
    // this.setState({selectedCoAuthors});
  }

  rememberFocus(event) {
    if (this.editorElement.contains(event.target)) {
      return CommitView.focus.EDITOR;
    }

    if (this.refAbortMergeButton && this.refAbortMergeButton.contains(event.target)) {
      return CommitView.focus.ABORT_MERGE_BUTTON;
    }

    if (this.refCommitButton && this.refCommitButton.contains(event.target)) {
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
      if (this.refAbortMergeButton) {
        this.refAbortMergeButton.focus();
        return true;
      } else {
        fallback = true;
      }
    }

    if (focus === CommitView.focus.COMMIT_BUTTON) {
      if (this.refCommitButton) {
        this.refCommitButton.focus();
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
