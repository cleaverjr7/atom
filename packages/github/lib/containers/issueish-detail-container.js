import React from 'react';
import PropTypes from 'prop-types';
import yubikiri from 'yubikiri';
import {QueryRenderer, graphql} from 'react-relay';

import RelayNetworkLayerManager from '../relay-network-layer-manager';
import {GithubLoginModelPropType} from '../prop-types';
import {UNAUTHENTICATED, INSUFFICIENT} from '../shared/keytar-strategy';
import GithubLoginView from '../views/github-login-view';
import LoadingView from '../views/loading-view';
import QueryErrorView from '../views/query-error-view';
import ObserveModel from '../views/observe-model';
import IssueishDetailController from '../controllers/issueish-detail-controller';
import RelayEnvironment from '../views/relay-environment';
import {autobind} from '../helpers';

export default class IssueishDetailContainer extends React.Component {
  static propTypes = {
    host: PropTypes.string,
    owner: PropTypes.string.isRequired,
    repo: PropTypes.string.isRequired,
    issueishNumber: PropTypes.number.isRequired,

    loginModel: GithubLoginModelPropType.isRequired,

    switchToIssueish: PropTypes.func.isRequired,
    onTitleChange: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);
    autobind(this, 'fetchData', 'renderWithToken', 'renderWithResult', 'handleLogin', 'handleLogout');
  }

  fetchData(loginModel) {
    return yubikiri({
      token: loginModel.getToken(this.props.host),
    });
  }

  render() {
    return (
      <ObserveModel model={this.props.loginModel} fetchData={this.fetchData}>
        {this.renderWithToken}
      </ObserveModel>
    );
  }

  renderWithToken(data) {
    if (!data) {
      return <LoadingView />;
    }

    if (data.token === UNAUTHENTICATED) {
      return <GithubLoginView onLogin={this.handleLogin} />;
    }

    if (data.token === INSUFFICIENT) {
      return (
        <GithubLoginView onLogin={this.handleLogin}>
          <p>
            Your token no longer has sufficient authorizations. Please re-authenticate and generate a new one.
          </p>
        </GithubLoginView>
      );
    }

    const environment = RelayNetworkLayerManager.getEnvironmentForHost(this.props.host, data.token);
    const query = graphql`
      query issueishDetailContainerQuery
      (
        $repoOwner: String!
        $repoName: String!
        $issueishNumber: Int!
        $timelineCount: Int!
        $timelineCursor: String
      ) {
        repository(owner: $repoOwner, name: $repoName) {
          ...issueishDetailController_repository @arguments(issueishNumber: $issueishNumber)
        }
      }
    `;
    const variables = {
      repoOwner: this.props.owner,
      repoName: this.props.repo,
      issueishNumber: this.props.issueishNumber,
      timelineCount: 100,
      timelineCursor: null,
    };

    return (
      <RelayEnvironment environment={environment}>
        <QueryRenderer
          environment={environment}
          query={query}
          variables={variables}
          render={this.renderWithResult}
        />
      </RelayEnvironment>
    );
  }

  renderWithResult({error, props, retry}) {
    if (error) {
      return (
        <QueryErrorView
          error={error}
          login={this.handleLogin}
          retry={retry}
          logout={this.handleLogout}
        />
      );
    }

    if (!props) {
      return <LoadingView />;
    }

    return (
      <IssueishDetailController
        {...props}
        issueishNumber={this.props.issueishNumber}
        onTitleChange={this.props.onTitleChange}
        switchToIssueish={this.props.switchToIssueish}
      />
    );
  }

  handleLogin(token) {
    return this.props.loginModel.setToken(this.props.host, token);
  }

  handleLogout() {
    return this.props.loginModel.removeToken(this.props.host);
  }
}
