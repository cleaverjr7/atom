import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {Emitter} from 'event-kit';

import {autobind} from '../helpers';
import {GithubLoginModelPropType, WorkdirContextPoolPropType} from '../prop-types';
import {addEvent} from '../reporter-proxy';
import Repository from '../models/repository';
import {getEndpoint} from '../models/endpoint';
import IssueishDetailContainer from '../containers/issueish-detail-container';
import RefHolder from '../models/ref-holder';

export default class IssueishDetailItem extends Component {
  static propTypes = {
    // Issueish selection criteria
    // Parsed from item URI
    host: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    repo: PropTypes.string.isRequired,
    issueishNumber: PropTypes.number.isRequired,
    workingDirectory: PropTypes.string.isRequired,

    // For opening files changed tab
    changedFilePath: PropTypes.string,
    changedFilePosition: PropTypes.number,

    // Package models
    workdirContextPool: WorkdirContextPoolPropType.isRequired,
    loginModel: GithubLoginModelPropType.isRequired,

    // Atom environment
    workspace: PropTypes.object.isRequired,
    commands: PropTypes.object.isRequired,
    keymaps: PropTypes.object.isRequired,
    tooltips: PropTypes.object.isRequired,
    config: PropTypes.object.isRequired,
  }

  static uriPattern = 'atom-github://issueish/{host}/{owner}/{repo}/{issueishNumber}?workdir={workingDirectory}&changedFilePath={changedFilePath}&changedFilePosition={changedFilePosition}'

  static buildURI(host, owner, repo, number, workdir = null, changedFilePath = null, changedFilePosition = null) {
    const encodeOptionalParam = param => (param ? encodeURIComponent(param) : '');

    return 'atom-github://issueish/' +
      encodeURIComponent(host) + '/' +
      encodeURIComponent(owner) + '/' +
      encodeURIComponent(repo) + '/' +
      encodeURIComponent(number) +
      '?workdir=' + encodeOptionalParam(workdir) +
      '&changedFilePath=' + encodeOptionalParam(changedFilePath) +
      '&changedFilePosition=' + encodeOptionalParam(changedFilePosition);
  }

  constructor(props) {
    super(props);
    autobind(this, 'switchToIssueish', 'handleTitleChanged');

    this.emitter = new Emitter();
    this.title = `${this.props.owner}/${this.props.repo}#${this.props.issueishNumber}`;
    this.hasTerminatedPendingState = false;

    const repository = this.props.workingDirectory === ''
      ? Repository.absent()
      : this.props.workdirContextPool.add(this.props.workingDirectory).getRepository();

    this.state = {
      host: this.props.host,
      owner: this.props.owner,
      repo: this.props.repo,
      issueishNumber: this.props.issueishNumber,
      repository,
      changedFilePath: this.props.changedFilePath,
      changedFilePosition: this.props.changedFilePosition,
    };

    if (repository.isAbsent()) {
      this.switchToIssueish(this.props.owner, this.props.repo, this.props.issueishNumber);
    }

    this.refEditor = new RefHolder();
    this.refEditor.observe(editor => {
      this.emitter.emit('did-change-embedded-text-editor', editor);
    });
  }

  render() {
    return (
      <IssueishDetailContainer
        endpoint={getEndpoint(this.state.host)}
        owner={this.state.owner}
        repo={this.state.repo}
        issueishNumber={this.state.issueishNumber}
        changedFilePath={this.state.changedFilePath}
        changedFilePosition={this.state.changedFilePosition}

        repository={this.state.repository}
        workspace={this.props.workspace}
        loginModel={this.props.loginModel}

        onTitleChange={this.handleTitleChanged}
        switchToIssueish={this.switchToIssueish}
        commands={this.props.commands}
        keymaps={this.props.keymaps}
        tooltips={this.props.tooltips}
        config={this.props.config}

        destroy={this.destroy}
        itemType={this.constructor}
        refEditor={this.refEditor}
      />
    );
  }

  async switchToIssueish(owner, repo, issueishNumber) {
    const pool = this.props.workdirContextPool;
    const prev = {
      owner: this.state.owner,
      repo: this.state.repo,
      issueishNumber: this.state.issueishNumber,
    };

    const matchingRepositories = (await Promise.all(
      pool.withResidentContexts((workdir, context) => {
        const repository = context.getRepository();
        return repository.hasGitHubRemote(this.state.host, owner, repo)
          .then(hasRemote => (hasRemote ? repository : null));
      }),
    )).filter(Boolean);
    const nextRepository = matchingRepositories.length === 1 ? matchingRepositories[0] : Repository.absent();

    await new Promise(resolve => {
      this.setState((prevState, props) => {
        if (
          pool === props.workdirContextPool &&
          prevState.owner === prev.owner &&
          prevState.repo === prev.repo &&
          prevState.issueishNumber === prev.issueishNumber
        ) {
          addEvent('open-issueish-in-pane', {package: 'github', from: 'issueish-link', target: 'current-tab'});
          return {
            owner,
            repo,
            issueishNumber,
            repository: nextRepository,
          };
        }

        return {};
      }, resolve);
    });
  }

  handleTitleChanged(title) {
    if (this.title !== title) {
      this.title = title;
      this.emitter.emit('did-change-title', title);
    }
  }

  onDidChangeTitle(cb) {
    return this.emitter.on('did-change-title', cb);
  }

  terminatePendingState() {
    if (!this.hasTerminatedPendingState) {
      this.emitter.emit('did-terminate-pending-state');
      this.hasTerminatedPendingState = true;
    }
  }

  onDidTerminatePendingState(callback) {
    return this.emitter.on('did-terminate-pending-state', callback);
  }

  destroy = () => {
    /* istanbul ignore else */
    if (!this.isDestroyed) {
      this.emitter.emit('did-destroy');
      this.isDestroyed = true;
    }
  }

  onDidDestroy(callback) {
    return this.emitter.on('did-destroy', callback);
  }

  serialize() {
    return {
      uri: this.getURI(),
      deserializer: 'IssueishDetailItem',
    };
  }

  getTitle() {
    return this.title;
  }

  observeEmbeddedTextEditor(cb) {
    this.refEditor.map(editor => cb(editor));
    return this.emitter.on('did-change-embedded-text-editor', cb);
  }
}
