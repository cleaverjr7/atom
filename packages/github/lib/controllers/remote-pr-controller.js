import React from 'react';
import PropTypes from 'prop-types';
import {autobind} from 'core-decorators';
import yubikiri from 'yubikiri';
import {shell} from 'electron';

import {RemotePropType} from '../prop-types';
import ObserveModelDecorator from '../decorators/observe-model';
import GithubLoginView from '../views/github-login-view';
import {UNAUTHENTICATED} from '../shared/keytar-strategy';
import {nullRemote} from '../models/remote';
import PrInfoController from './pr-info-controller';

@ObserveModelDecorator({
  getModel: props => props.loginModel,
  fetchData: (loginModel, {host}) => {
    return yubikiri({
      token: loginModel.getToken(host),
    });
  },
})
export default class RemotePrController extends React.Component {
  static propTypes = {
    loginModel: PropTypes.object.isRequired,
    host: PropTypes.string, // fully qualified URI to the API endpoint, e.g. 'https://api.github.com'
    remote: RemotePropType.isRequired,
    token: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.symbol,
    ]),
    currentBranchName: PropTypes.string.isRequired,
    selectedPrUrl: PropTypes.string,
    aheadCount: PropTypes.number,
    isUnpublished: PropTypes.bool.isRequired,
    onSelectPr: PropTypes.func.isRequired,
    onUnpinPr: PropTypes.func.isRequired,
    onPushBranch: PropTypes.func.isRequired,
  }

  static defaultProps = {
    host: 'https://api.github.com',
    remote: nullRemote,
    token: null,
  }

  render() {
    const {
      host, remote, currentBranchName, token, loginModel, selectedPrUrl, aheadCount, isUnpublished,
      onSelectPr, onUnpinPr, onPushBranch,
    } = this.props;
    return (
      <div className="github-RemotePrController">
        {token && token !== UNAUTHENTICATED && <PrInfoController
          {...{
            host, remote, currentBranchName, token, loginModel, selectedPrUrl, aheadCount, isUnpublished,
            onSelectPr, onUnpinPr, onPushBranch,
          }}
          onLogin={this.handleLogin}
          onLogout={this.handleLogout}
          onCreatePr={this.handleCreatePr}
                                               />
          }
        {(!token || token === UNAUTHENTICATED) && <GithubLoginView onLogin={this.handleLogin} />}
      </div>
    );
  }

  @autobind
  handleLogin(token) {
    this.props.loginModel.setToken(this.props.host, token);
  }

  @autobind
  handleLogout() {
    this.props.loginModel.removeToken(this.props.host);
  }

  @autobind
  handleCreatePr() {
    let createPrUrl = 'https://github.com/';
    createPrUrl += this.props.remote.getOwner() + '/' + this.props.remote.getRepo();
    createPrUrl += '/compare/' + encodeURIComponent(this.props.currentBranchName);
    createPrUrl += '?expand=1';

    return new Promise((resolve, reject) => {
      shell.openExternal(createPrUrl, {}, err => {
        if (err) { reject(err); } else { resolve(); }
      });
    });
  }
}
