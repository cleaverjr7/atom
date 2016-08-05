/** @babel */
/** @jsx etch.dom */

import {CompositeDisposable} from 'atom'
import etch from 'etch'

export default class CommitView {
  constructor (props) {
    this.props = props
    this.abortMerge = this.abortMerge.bind(this)
    const TextEditor = props.workspace.buildTextEditor
    this.textEditorWidget =
      <TextEditor
        ref='editor'
        softWrapped={true}
        placeholderText='Commit message'
        lineNumberGutterVisible={false}
        showInvisibles={false}
        autoHeight={false}
        scrollPastEnd={false}
      />
    etch.initialize(this)
    this.editor = this.refs.editor
    if (this.props.message) {
      this.editor.setText(this.props.message)
    }
    this.subscriptions = new CompositeDisposable(
      this.editor.onDidChangeCursorPosition(() => { etch.update(this) }),
      this.editor.getBuffer().onDidChangeText(() => { etch.update(this) }),
      props.commandRegistry.add(this.element, {'git:commit': () => this.commit()})
    )
  }

  destroy () {
    this.subscriptions.dispose()
    etch.destroy(this)
  }

  update (props) {
    this.props = Object.assign({}, this.props, props)
    if (this.props.message && this.editor.getText().length === 0) {
      this.editor.setText(this.props.message)
    }
    return etch.update(this)
  }

  render () {
    let remainingCharactersClassName = ''
    if (this.getRemainingCharacters() < 0) {
      remainingCharactersClassName = 'is-error'
    } else if (this.getRemainingCharacters() < this.props.maximumCharacterLimit / 4) {
      remainingCharactersClassName = 'is-warning'
    }
    return (
      <div className='git-CommitView' ref='CommitView'>
        <div className='git-CommitView-editor'>
          {this.textEditorWidget}
        </div>
        <footer className='git-CommitView-bar'>
          <button ref='abortMergeButton' className='btn git-CommitView-button is-secondary'
                  onclick={this.abortMerge}
                  style={{display: this.props.isMerging ? '' : 'none'}}>Abort Merge</button>
          <button ref='commitButton' className='btn git-CommitView-button'
                  onclick={this.commit.bind(this)}
                  disabled={!this.isCommitButtonEnabled()}>Commit {this.props.branchName ? `to ${this.props.branchName}` : ''}</button>
          <div ref='remainingCharacters' className={`git-CommitView-remaining-characters ${remainingCharactersClassName}`}>
            {this.getRemainingCharacters()}
          </div>
        </footer>
      </div>
    )
  }

  async abortMerge () {
    const choice = atom.confirm({
      message: 'Abort merge',
      detailedMessage: 'Are you sure?',
      buttons: ['Abort', 'Cancel']
    })
    if (choice !== 0) return

    try {
      await this.props.abortMerge()
      this.editor.setText('')
    } catch (e) {
      if (e.code === 'EDIRTYSTAGED') {
        this.props.notificationManager.addError(`Cannot abort because ${e.path} is both dirty and staged.`)
      }
    }
    return etch.update(this)
  }

  async commit () {
    if (this.isCommitButtonEnabled()) {
      try {
        await this.props.commit(this.editor.getText())
        this.editor.setText('')
      } catch (e) {
        if (e.code === 'ECONFLICT') {
          this.props.notificationManager.addError('Cannot commit without resolving all the merge conflicts first.')
        }
      }
    }

    return etch.update(this)
  }

  getRemainingCharacters () {
    if (this.editor != null) {
      if (this.editor.getCursorBufferPosition().row === 0) {
        return (this.props.maximumCharacterLimit - this.editor.lineTextForBufferRow(0).length).toString()
      } else {
        return '∞'
      }
    } else {
      return this.props.maximumCharacterLimit
    }
  }

  isCommitButtonEnabled () {
    return this.props.stagedChangesExist && !this.props.mergeConflictsExist && this.editor && this.editor.getText().length !== 0
  }
}
