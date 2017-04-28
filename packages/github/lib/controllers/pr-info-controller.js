import React from 'react';
import PropTypes from 'prop-types';
import {autobind} from 'core-decorators';

import {RemotePropType} from '../prop-types';
import RelayRootContainer from '../containers/relay-root-container';
import PrSelectionByUrlContainer from '../containers/pr-selection-by-url-container';
import PrSelectionByBranchContainer from '../containers/pr-selection-by-branch-container';
import GithubLoginView from '../views/github-login-view';
import PrInfoByBranchRoute from '../routes/pr-info-by-branch-route';
import PrInfoByUrlRoute from '../routes/pr-info-by-url-route';
import RelayNetworkLayerManager from '../relay-network-layer-manager';
import {UNAUTHENTICATED} from '../models/github-login-model';

export default class PrInfoController extends React.Component {
  static propTypes = {
    token: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.symbol,
    ]).isRequired,
    host: PropTypes.string.isRequired,
    currentBranchName: PropTypes.string.isRequired,
    onLogin: PropTypes.func.isRequired,
    remote: RemotePropType.isRequired,
    onSelectPr: PropTypes.func.isRequired,
    selectedPrUrl: PropTypes.string,
    onUnpinPr: PropTypes.func.isRequired,
  }

  shouldComponentUpdate(nextProps) {
    return (
      nextProps.token !== this.props.token ||
      nextProps.host !== this.props.host ||
      nextProps.currentBranchName !== this.props.currentBranchName ||
      nextProps.onLogin !== this.props.onLogin ||
      nextProps.remote !== this.props.remote
    );
  }

  render() {
    if (this.props.token === UNAUTHENTICATED) {
      return null;
    }

    if (this.props.selectedPrUrl) {
      return this.renderSpecificPr();
    } else {
      return this.renderPrByBranchName();
    }
  }

  renderSpecificPr() {

    const {token, host} = this.props;

    const route = new PrInfoByUrlRoute({
      prUrl: this.props.selectedPrUrl,
    });

    const environment = RelayNetworkLayerManager.getEnvironmentForHost(host, token);
    const Component = PrSelectionByUrlContainer;

    return (
      <RelayRootContainer
        Component={Component}
        route={route}
        environment={environment}
        renderFetched={props => {
          return <Component {...props} onSelectPr={this.props.onSelectPr} onUnpinPr={this.props.onUnpinPr} />;
        }}
        renderLoading={this.renderLoading}
        renderFailure={this.renderFailure}
      />
    );
  }

  renderPrByBranchName() {
    const {token, host} = this.props;

    const route = new PrInfoByBranchRoute({
      repoOwner: this.props.remote.getOwner(),
      repoName: this.props.remote.getRepo(),
      branchName: this.props.currentBranchName,
    });

    const environment = RelayNetworkLayerManager.getEnvironmentForHost(host, token);
    const Component = PrSelectionByBranchContainer;

    return (
      <RelayRootContainer
        Component={Component}
        route={route}
        environment={environment}
        renderFetched={props => {
          return <Component {...props} onSelectPr={this.props.onSelectPr} />;
        }}
        renderLoading={this.renderLoading}
        renderFailure={this.renderFailure}
      />
    );
  }

  @autobind
  renderLoading() {
    return (
      <div className="github-Loader">
        <span className="github-Spinner" />
      </div>
    );
  }

  @autobind
  renderFailure(err, retry) {
    if (err.response && err.response.status === 401) {
      return (
        <div className="github-GithubLoginView-Container">
          <GithubLoginView onLogin={this.props.onLogin}>
            <p>
              The API endpoint returned a unauthorized error. Please try to re-authenticate with the endpoint.
            </p>
          </GithubLoginView>
        </div>
      );
    } else {
      return <div>An unknown error occurred.</div>;
    }
  }
}
