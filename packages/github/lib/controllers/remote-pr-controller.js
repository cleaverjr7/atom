import React from 'react';
import PropTypes from 'prop-types';
import yubikiri from 'yubikiri';
import {shell} from 'electron';

import {RemotePropType, BranchSetPropType} from '../prop-types';
import LoadingView from '../views/loading-view';
import GithubLoginView from '../views/github-login-view';
import ObserveModel from '../views/observe-model';
import {UNAUTHENTICATED, INSUFFICIENT} from '../shared/keytar-strategy';
import {nullRemote} from '../models/remote';
import PrInfoController from './pr-info-controller';
import {autobind} from '../helpers';

export default class RemotePrController extends React.Component {
  static propTypes = {
    loginModel: PropTypes.object.isRequired,
    host: PropTypes.string, // fully qualified URI to the API endpoint, e.g. 'https://api.github.com'
    remote: RemotePropType.isRequired,
    branches: BranchSetPropType.isRequired,
    selectedPrUrl: PropTypes.string,
    aheadCount: PropTypes.number,
    pushInProgress: PropTypes.bool.isRequired,
    onSelectPr: PropTypes.func.isRequired,
    onUnpinPr: PropTypes.func.isRequired,
    onPushBranch: PropTypes.func.isRequired,
  }

  static defaultProps = {
    host: 'https://api.github.com',
    remote: nullRemote,
  }

  constructor(props) {
    super(props);
    autobind(this, 'fetchData', 'handleLogin', 'handleLogout', 'handleCreatePr');
  }

  fetchData(loginModel) {
    return yubikiri({
      token: loginModel.getToken(this.props.host),
    });
  }

  render() {
    return (
      <ObserveModel model={this.props.loginModel} fetchData={this.fetchData}>
        {data => this.renderWithData(data || {token: null})}
      </ObserveModel>
    );
  }

  renderWithData({token}) {
    let inner;
    if (token === null) {
      inner = <LoadingView />;
    } else if (token === UNAUTHENTICATED) {
      inner = <GithubLoginView onLogin={this.handleLogin} scopeExpansion={false} />;
    } else if (token === INSUFFICIENT) {
      inner = <GithubLoginView onLogin={this.handleLogin} scopeExpansion={true} />;
    } else {
      const {
        host, remote, branches, loginModel, selectedPrUrl,
        aheadCount, pushInProgress, onSelectPr, onUnpinPr,
      } = this.props;

      inner = (
        <PrInfoController
          {...{
            host, remote, branches, token, loginModel, selectedPrUrl,
            aheadCount, pushInProgress, onSelectPr, onUnpinPr,
          }}
          onLogin={this.handleLogin}
          onLogout={this.handleLogout}
          onCreatePr={this.handleCreatePr}
        />
      );
    }

    return <div className="github-RemotePrController">{inner}</div>;
  }

  handleLogin(token) {
    this.props.loginModel.setToken(this.props.host, token);
  }

  handleLogout() {
    this.props.loginModel.removeToken(this.props.host);
  }

  async handleCreatePr() {
    const currentBranch = this.props.branches.getHeadBranch();
    const upstream = currentBranch.getUpstream();
    if (!upstream.isPresent() || this.props.aheadCount > 0) {
      await this.props.onPushBranch();
    }

    let createPrUrl = 'https://github.com/';
    createPrUrl += this.props.remote.getOwner() + '/' + this.props.remote.getRepo();
    createPrUrl += '/compare/' + encodeURIComponent(currentBranch.getName());
    createPrUrl += '?expand=1';

    return new Promise((resolve, reject) => {
      shell.openExternal(createPrUrl, {}, err => {
        if (err) { reject(err); } else { resolve(); }
      });
    });
  }
}
