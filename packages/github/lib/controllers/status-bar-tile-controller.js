import React from 'react';
import PropTypes from 'prop-types';

import ObserveModelDecorator from '../decorators/observe-model';
import {BranchPropType, RemotePropType} from '../prop-types';
import BranchView from '../views/branch-view';
import BranchMenuView from '../views/branch-menu-view';
import PushPullView from '../views/push-pull-view';
import PushPullMenuView from '../views/push-pull-menu-view';
import ChangedFilesCountView from '../views/changed-files-count-view';
import Tooltip from '../views/tooltip';
import Commands, {Command} from '../views/commands';
import {nullBranch} from '../models/branch';
import {nullRemote} from '../models/remote';
import yubikiri from 'yubikiri';
import {autobind} from 'core-decorators';

@ObserveModelDecorator({
  getModel: props => props.repository,
  fetchData: repository => {
    return yubikiri({
      currentBranch: repository.getCurrentBranch(),
      branches: repository.getBranches(),
      changedFilesCount: repository.getStatusesForChangedFiles().then(statuses => {
        const {stagedFiles, unstagedFiles, mergeConflictFiles} = statuses;
        const changedFiles = new Set();

        for (const filePath in unstagedFiles) {
          changedFiles.add(filePath);
        }
        for (const filePath in stagedFiles) {
          changedFiles.add(filePath);
        }
        for (const filePath in mergeConflictFiles) {
          changedFiles.add(filePath);
        }

        return changedFiles.size;
      }),
      currentRemote: async query => repository.getRemoteForBranch((await query.currentBranch).getName()),
      aheadCount: async query => repository.getAheadCount((await query.currentBranch).getName()),
      behindCount: async query => repository.getBehindCount((await query.currentBranch).getName()),
    });
  },
})
export default class StatusBarTileController extends React.Component {
  static propTypes = {
    workspace: PropTypes.object.isRequired,
    notificationManager: PropTypes.object.isRequired,
    commandRegistry: PropTypes.object.isRequired,
    tooltips: PropTypes.object.isRequired,
    repository: PropTypes.object.isRequired,
    currentBranch: BranchPropType.isRequired,
    branches: PropTypes.arrayOf(BranchPropType).isRequired,
    currentRemote: RemotePropType.isRequired,
    aheadCount: PropTypes.number,
    behindCount: PropTypes.number,
    changedFilesCount: PropTypes.number,
    toggleGitPanel: PropTypes.func,
  }

  static defaultProps = {
    currentBranch: nullBranch,
    branches: [],
    currentRemote: nullRemote,
    toggleGitPanel: () => {},
  }

  constructor(props, context) {
    super(props, context);

    this.state = {
      inProgress: false,
      pushInProgress: false,
      fetchInProgress: false,
    };
  }

  render() {
    const repoProps = {
      currentBranch: this.props.currentBranch,
      branches: this.props.branches,
      currentRemote: this.props.currentRemote,
      aheadCount: this.props.aheadCount,
      behindCount: this.props.behindCount,
      changedFilesCount: this.props.changedFilesCount,
    };

    return (
      <div className="github-StatusBarTileController">
        <Commands registry={this.props.commandRegistry} target="atom-workspace">
          <Command command="github:fetch" callback={this.fetch} />
          <Command command="github:pull" callback={this.pull} />
          <Command
            command="github:push"
            callback={() => this.push({force: false, setUpstream: !this.props.currentRemote.isPresent()})}
          />
          <Command
            command="github:force-push"
            callback={() => this.push({force: true, setUpstream: !this.props.currentRemote.isPresent()})}
          />
        </Commands>
        <BranchView
          ref={e => { this.branchView = e; }}
          workspace={this.props.workspace}
          checkout={this.checkout}
          {...repoProps}
        />
        <Tooltip
          manager={this.props.tooltips}
          target={() => this.branchView}
          trigger="click"
          className="github-StatusBarTileController-tooltipMenu">
          <BranchMenuView
            workspace={this.props.workspace}
            notificationManager={this.props.notificationManager}
            commandRegistry={this.props.commandRegistry}
            checkout={this.checkout}
            {...repoProps}
          />
        </Tooltip>
        <PushPullView
          ref={e => { this.pushPullView = e; }}
          pushInProgress={this.state.pushInProgress}
          fetchInProgress={this.state.fetchInProgress}
          {...repoProps}
        />
        <Tooltip
          manager={this.props.tooltips}
          target={() => this.pushPullView}
          trigger="click"
          className="github-StatusBarTileController-tooltipMenu">
          <PushPullMenuView
            onMarkSpecialClick={this.handleOpenGitTimingsView}
            workspace={this.props.workspace}
            notificationManager={this.props.notificationManager}
            inProgress={this.state.inProgress}
            push={this.push}
            pull={this.pull}
            fetch={this.fetch}
            {...repoProps}
          />
        </Tooltip>
        <ChangedFilesCountView
          didClick={this.props.toggleGitPanel}
          {...repoProps}
        />
      </div>
    );
  }

  @autobind
  handleOpenGitTimingsView(e) {
    e && e.preventDefault();
    this.props.workspace.open('atom-github://debug/timings');
  }

  setInProgressWhile(block, {push, pull, fetch} = {push: false, pull: false, fetch: false}) {
    return new Promise((resolve, reject) => {
      if (this.state.inProgress) {
        resolve();
        return;
      }

      this.setState({inProgress: true, pushInProgress: push, fetchInProgress: pull || fetch}, async () => {
        try {
          await block();
        } catch (e) {
          reject(e);
        } finally {
          this.setState({inProgress: false, pushInProgress: false, fetchInProgress: false}, resolve);
        }
      });
    });
  }

  @autobind
  checkout(branchName, options) {
    return this.setInProgressWhile(() => this.props.repository.checkout(branchName, options));
  }

  @autobind
  async push(options) {
    await this.setInProgressWhile(() => {
      return this.props.repository.push(this.props.currentBranch.getName(), options);
    }, {push: true});
  }

  @autobind
  async pull() {
    await this.setInProgressWhile(() => this.props.repository.pull(this.props.currentBranch.getName()), {pull: true});
  }

  @autobind
  async fetch() {
    await this.setInProgressWhile(() => this.props.repository.fetch(this.props.currentBranch.getName()), {fetch: true});
  }
}
