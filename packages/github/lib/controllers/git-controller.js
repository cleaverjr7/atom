import path from 'path';

import {CompositeDisposable, Disposable, File, TextBuffer} from 'atom';

import React from 'react';
import {autobind} from 'core-decorators';

import EtchWrapper from '../views/etch-wrapper';
import StatusBar from '../views/status-bar';
import Panel from '../views/panel';
import PaneItem from '../views/pane-item';
import Resizer from '../views/resizer';
import Tabs from '../views/tabs';
import Commands, {Command} from '../views/commands';
import GithubController from './github-controller';
import FilePatchController from './file-patch-controller';
import GitPanelController from './git-panel-controller';
import StatusBarTileController from './status-bar-tile-controller';
import ModelObserver from '../models/model-observer';
import ModelStateRegistry from '../models/model-state-registry';
import discardChangesInBuffer from '../discard-changes-in-buffer';
import {CannotRestoreError} from '../models/file-discard-history';

const nullFilePatchState = {
  filePath: null,
  filePatch: null,
  stagingStatus: null,
  partiallyStaged: null,
};

export default class GitController extends React.Component {
  static propTypes = {
    workspace: React.PropTypes.object.isRequired,
    commandRegistry: React.PropTypes.object.isRequired,
    notificationManager: React.PropTypes.object.isRequired,
    repository: React.PropTypes.object,
    statusBar: React.PropTypes.object,
    savedState: React.PropTypes.object,
    githubEnabled: React.PropTypes.bool,
  }

  static defaultProps = {
    savedState: {},
    githubEnabled: false,
  }

  serialize() {
    return {
      gitPanelActive: this.state.gitPanelActive,
      panelSize: this.state.panelSize,
      activeTab: this.state.activeTab,
    };
  }

  constructor(props, context) {
    super(props, context);
    this.state = {
      ...nullFilePatchState,
      amending: false,
      gitPanelActive: !!props.savedState.gitPanelActive,
      panelSize: props.savedState.panelSize || 400,
      activeTab: props.savedState.activeTab || 0,
    };

    this.repositoryStateRegistry = new ModelStateRegistry(GitController, {
      save: () => {
        return {amending: this.state.amending};
      },
      restore: (state = {}) => {
        this.setState({amending: !!state.amending});
      },
    });

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      props.commandRegistry.add('atom-workspace', {
        'github:toggle-git-panel': this.toggleGitPanel,
        'github:toggle-git-panel-focus': this.toggleGitPanelFocus,
      }),
    );

    this.repositoryObserver = new ModelObserver({
      didUpdate: () => this.onRepoRefresh(),
    });
    this.repositoryObserver.setActiveModel(props.repository);
    this.subscriptions.add(
      new Disposable(() => this.repositoryObserver.destroy()),
    );
  }

  componentWillMount() {
    this.repositoryStateRegistry.setModel(this.props.repository);
  }

  componentWillReceiveProps(newProps) {
    this.repositoryObserver.setActiveModel(newProps.repository);
    this.repositoryStateRegistry.setModel(newProps.repository);
  }

  render() {
    return (
      <div>
        {this.renderStatusBarTile()}
        {this.renderGitPanel()}
        {(this.state.filePath && this.state.filePatch) ? this.renderFilePatchController() : null}
      </div>
    );
  }

  renderStatusBarTile() {
    return (
      <StatusBar statusBar={this.props.statusBar} onConsumeStatusBar={sb => this.onConsumeStatusBar(sb)}>
        <EtchWrapper type="span">
          <StatusBarTileController
            workspace={this.props.workspace}
            repository={this.props.repository}
            commandRegistry={this.props.commandRegistry}
            toggleGitPanel={this.toggleGitPanel}
          />
        </EtchWrapper>
      </StatusBar>
    );
  }

  renderGitPanel() {
    return (
      <Panel
        workspace={this.props.workspace}
        location="right"
        onDidClosePanel={() => this.setState({gitPanelActive: false})}
        visible={!!this.state.gitPanelActive}>
        <Resizer
          size={this.state.panelSize}
          onChange={this.handlePanelResize}
          className="github-PanelResizer">
          <Tabs activeIndex={this.state.activeTab} onChange={this.handleChangeTab} className="sidebar-tabs">
            <Tabs.Panel title="Git">
              <EtchWrapper
                ref={c => { this.gitPanelController = c; }}
                className="github-PanelEtchWrapper"
                reattachDomNode={false}>
                <GitPanelController
                  workspace={this.props.workspace}
                  commandRegistry={this.props.commandRegistry}
                  notificationManager={this.props.notificationManager}
                  repository={this.props.repository}
                  isAmending={this.state.amending}
                  didSelectFilePath={this.showFilePatchForPath}
                  didDiveIntoFilePath={this.diveIntoFilePatchForPath}
                  didSelectMergeConflictFile={this.showMergeConflictFileForPath}
                  didDiveIntoMergeConflictPath={this.diveIntoMergeConflictFileForPath}
                  didChangeAmending={this.didChangeAmending}
                  focusFilePatchView={this.focusFilePatchView}
                  ensureGitPanel={this.ensureGitPanel}
                  openFiles={this.openFiles}
                  discardWorkDirChangesForPaths={this.discardWorkDirChangesForPaths}
                />
              </EtchWrapper>
            </Tabs.Panel>
            {this.props.githubEnabled && (
              <Tabs.Panel title="Hub">
                <GithubController repository={this.props.repository} />
              </Tabs.Panel>
            )}
          </Tabs>
        </Resizer>
      </Panel>
    );
  }

  renderFilePatchController() {
    const hasUndoHistory = this.hasUndoHistory();
    return (
      <div>
        <Commands registry={this.props.commandRegistry} target="atom-workspace">
          <Command command="github:focus-diff-view" callback={this.focusFilePatchView} />
        </Commands>
        <PaneItem
          workspace={this.props.workspace}
          getItem={({subtree}) => subtree.getWrappedComponent()}
          ref={c => { this.filePatchControllerPane = c; }}
          onDidCloseItem={() => { this.setState({...nullFilePatchState}); }}>
          <EtchWrapper ref={c => { this.filePatchController = c; }} reattachDomNode={false}>
            <FilePatchController
              repository={this.props.repository}
              commandRegistry={this.props.commandRegistry}
              filePatch={this.state.filePatch}
              stagingStatus={this.state.stagingStatus}
              isAmending={this.state.amending}
              isPartiallyStaged={this.state.partiallyStaged}
              onRepoRefresh={this.onRepoRefresh}
              didSurfaceFile={this.surfaceFromFileAtPath}
              didDiveIntoFilePath={this.diveIntoFilePatchForPath}
              quietlySelectItem={this.quietlySelectItem}
              openFiles={this.openFiles}
              discardLines={this.discardLines}
              undoLastDiscard={this.undoLastDiscard}
              hasUndoHistory={hasUndoHistory}
            />
          </EtchWrapper>
        </PaneItem>
      </div>
    );
  }

  componentWillUnmount() {
    this.repositoryStateRegistry.save();
    this.subscriptions.dispose();
  }

  onConsumeStatusBar(statusBar) {
    if (statusBar.disableGitInfoTile) {
      statusBar.disableGitInfoTile();
    }
  }

  @autobind
  async showFilePatchForPath(filePath, stagingStatus, {activate, amending} = {}) {
    if (!filePath) { return null; }
    const repository = this.props.repository;
    if (!repository) { return null; }

    const staged = stagingStatus === 'staged';
    const filePatch = await repository.getFilePatchForPath(filePath, {staged, amending: staged && amending});
    const partiallyStaged = await repository.isPartiallyStaged(filePath);
    return new Promise(resolve => {
      if (filePatch) {
        this.setState({filePath, filePatch, stagingStatus, partiallyStaged}, () => {
          // TODO: can be better done w/ a prop?
          if (activate && this.filePatchControllerPane) {
            this.filePatchControllerPane.activate();
          }
          resolve();
        });
      } else {
        this.setState({...nullFilePatchState}, resolve);
      }
    });
  }

  @autobind
  async diveIntoFilePatchForPath(filePath, stagingStatus, {amending} = {}) {
    await this.showFilePatchForPath(filePath, stagingStatus, {activate: true, amending});
    this.focusFilePatchView();
  }

  @autobind
  surfaceFromFileAtPath(filePath, stagingStatus) {
    if (this.gitPanelController) {
      this.gitPanelController.getWrappedComponent().focusAndSelectStagingItem(filePath, stagingStatus);
    }
  }

  @autobind
  onRepoRefresh() {
    return this.showFilePatchForPath(this.state.filePath, this.state.stagingStatus, {amending: this.state.amending});
  }

  @autobind
  async showMergeConflictFileForPath(relativeFilePath, {focus} = {}) {
    const absolutePath = path.join(this.props.repository.getWorkingDirectoryPath(), relativeFilePath);
    if (await new File(absolutePath).exists()) {
      return this.props.workspace.open(absolutePath, {activatePane: Boolean(focus), pending: true});
    } else {
      this.props.notificationManager.addInfo('File has been deleted.');
      return null;
    }
  }

  @autobind
  diveIntoMergeConflictFileForPath(relativeFilePath) {
    return this.showMergeConflictFileForPath(relativeFilePath, {focus: true});
  }

  @autobind
  didChangeAmending(isAmending) {
    this.setState({amending: isAmending});
    return this.showFilePatchForPath(this.state.filePath, this.state.stagingStatus, {amending: isAmending});
  }

  @autobind
  toggleGitPanel() {
    this.setState(state => ({gitPanelActive: !state.gitPanelActive}));
  }

  @autobind
  toggleGitPanelFocus() {
    if (!this.state.gitPanelActive) {
      this.setState({gitPanelActive: true}, () => this.toggleGitPanelFocus());
      return;
    }

    if (this.gitPanelHasFocus()) {
      this.props.workspace.getActivePane().activate();
    } else {
      this.focusGitPanel();
    }
  }

  @autobind
  focusGitPanel() {
    this.gitPanelController.getWrappedComponent().focus();
  }

  gitPanelHasFocus() {
    return this.gitPanelController.getWrappedComponent().isFocused();
  }

  // Ensure that the Git panel is visible. Returns a Promise that resolves to `true` if the panel was initially
  // hidden or `false` if it was already shown.
  @autobind
  ensureGitPanel() {
    if (!this.state.gitPanelActive) {
      return new Promise((resolve, reject) => {
        this.setState({gitPanelActive: true}, () => resolve(true));
      });
    }

    return Promise.resolve(false);
  }

  @autobind
  handlePanelResize(size) {
    this.setState({
      panelSize: Math.max(size, 250),
    });
  }

  @autobind
  focusFilePatchView() {
    this.filePatchController.getWrappedComponent().focus();
  }

  @autobind
  openFiles(filePaths) {
    return Promise.all(filePaths.map(filePath => {
      const absolutePath = path.join(this.props.repository.getWorkingDirectoryPath(), filePath);
      return this.props.workspace.open(absolutePath, {pending: filePaths.length === 1});
    }));
  }

  @autobind
  discardWorkDirChangesForPaths(filePaths) {
    return this.props.repository.discardWorkDirChangesForPaths(filePaths);
  }

  @autobind
  handleChangeTab(activeTab) {
    this.setState({activeTab});
  }

  @autobind
  async discardLines(lines) {
    const relFilePath = this.state.filePatch.getPath();
    const absfilePath = path.join(this.props.repository.getWorkingDirectoryPath(), relFilePath);
    let buffer, disposable;
    const isSafe = async () => {
      const editor = this.props.workspace.getTextEditors().find(e => e.getPath() === absfilePath);
      if (editor) {
        buffer = editor.getBuffer();
        if (buffer.isModified()) {
          this.props.notificationManager.addError('Cannot discard lines.', {description: 'You have unsaved changes.'});
          return false;
        }
      } else {
        buffer = new TextBuffer({filePath: absfilePath, load: true});
        await new Promise(resolve => {
          disposable = buffer.onDidReload(() => {
            disposable.dispose();
            resolve();
          });
        });
      }
      return true;
    };
    const snapshots = await this.props.repository.storeBeforeAndAfterBlobs(relFilePath, isSafe, () => {
      this.discardChangesInBuffer(buffer, this.state.filePatch, lines);
    });
    if (disposable) { disposable.dispose(); }
    return snapshots;
  }

  discardChangesInBuffer(buffer, filePatch, lines) {
    discardChangesInBuffer(buffer, filePatch, lines);
  }

  @autobind
  async undoLastDiscard(filePath) {
    const relFilePath = this.state.filePatch.getPath();
    const absfilePath = path.join(this.props.repository.getWorkingDirectoryPath(), relFilePath);
    const isSafe = () => {
      const editor = this.props.workspace.getTextEditors().find(e => e.getPath() === absfilePath);
      if (editor && editor.getBuffer().isModified()) {
        this.notifyInabilityToUndo(relFilePath, 'You have unsaved changes.');
        return false;
      }
      return true;
    };
    try {
      await this.props.repository.attemptToRestoreBlob(filePath, isSafe);
    } catch (e) {
      if (e instanceof CannotRestoreError) {
        this.notifyInabilityToUndo(relFilePath, 'Contents have been modified since last discard.');
      } else if (e.stdErr.match(/fatal: Not a valid object name/)) {
        this.notifyInabilityToUndo(relFilePath, 'Discard history has expired.');
        this.props.repository.clearDiscardHistoryForPath(filePath);
      } else {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    }
  }

  notifyInabilityToUndo(filePath, description) {
    const openNewFile = () => this.openFileInNewBuffer(filePath);
    this.props.notificationManager.addError(
      'Cannot undo last discard.',
      {
        description: `${description} Would you like to open pre-discard version of "${filePath}" in new buffer?`,
        buttons: [{
          text: 'Open in new buffer',
          onDidClick: openNewFile,
        }],
      },
    );
  }

  async openFileInNewBuffer(filePath) {
    const {beforeSha} = await this.props.repository.getLastHistorySnapshotsForPath(filePath);
    const contents = await this.props.repository.getBlobContents(beforeSha);
    const editor = await this.props.workspace.open();
    editor.setText(contents);
  }


  @autobind
  hasUndoHistory() {
    return this.props.repository.hasUndoHistory(this.state.filePatch.getPath());
  }

  @autobind
  quietlySelectItem(filePath, stagingStatus) {
    if (this.gitPanelController) {
      return this.gitPanelController.getWrappedComponent().quietlySelectItem(filePath, stagingStatus);
    } else {
      return null;
    }
  }
}
