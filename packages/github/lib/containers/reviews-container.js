import React from 'react';
import PropTypes from 'prop-types';
import yubikiri from 'yubikiri';
import {QueryRenderer, graphql} from 'react-relay';

import {PAGE_SIZE} from '../helpers';
import {GithubLoginModelPropType, EndpointPropType} from '../prop-types';
import {UNAUTHENTICATED, INSUFFICIENT} from '../shared/keytar-strategy';
import PullRequestPatchContainer from './pr-patch-container';
import ObserveModel from '../views/observe-model';
import LoadingView from '../views/loading-view';
import GithubLoginView from '../views/github-login-view';
import ErrorView from '../views/error-view';
import QueryErrorView from '../views/query-error-view';
import RelayNetworkLayerManager from '../relay-network-layer-manager';
import RelayEnvironment from '../views/relay-environment';
import PullRequestCheckoutController from '../controllers/pr-checkout-controller';
import ReviewsController from '../controllers/reviews-controller';

export default class ReviewsContainer extends React.Component {
  static propTypes = {
    // Connection
    endpoint: EndpointPropType.isRequired,

    // Pull request selection criteria
    owner: PropTypes.string.isRequired,
    repo: PropTypes.string.isRequired,
    number: PropTypes.number.isRequired,

    // Package models
    repository: PropTypes.object.isRequired,
    loginModel: GithubLoginModelPropType.isRequired,

    // Atom environment
    workspace: PropTypes.object.isRequired,
    config: PropTypes.object.isRequired,
    commands: PropTypes.object.isRequired,
  }

  render() {
    return (
      <ObserveModel model={this.props.loginModel} fetchData={this.fetchToken}>
        {this.renderWithToken}
      </ObserveModel>
    );
  }

  renderWithToken = token => {
    if (!token) {
      return <LoadingView />;
    }

    if (token === UNAUTHENTICATED) {
      return <GithubLoginView onLogin={this.handleLogin} />;
    }

    if (token === INSUFFICIENT) {
      return (
        <GithubLoginView onLogin={this.handleLogin}>
          <p>
            Your token no longer has sufficient authorizations. Please re-authenticate and generate a new one.
          </p>
        </GithubLoginView>
      );
    }

    return (
      <PullRequestPatchContainer
        owner={this.props.owner}
        repo={this.props.repo}
        number={this.props.number}
        endpoint={this.props.endpoint}
        token={token}>
        {(error, patch) => this.renderWithPatch(error, {token, patch})}
      </PullRequestPatchContainer>
    );
  }

  renderWithPatch(error, {token, patch}) {
    if (error) {
      return <ErrorView descriptions={[error]} />;
    }

    return (
      <ObserveModel model={this.props.repository} fetchData={this.fetchRepositoryData}>
        {repoData => this.renderWithRepositoryData(repoData, {token, patch})}
      </ObserveModel>
    );
  }

  renderWithRepositoryData(repoData, {token, patch}) {
    const environment = RelayNetworkLayerManager.getEnvironmentForHost(this.props.endpoint, token);
    const query = graphql`
      query reviewsContainerQuery
      (
        $repoOwner: String!
        $repoName: String!
        $prNumber: Int!
        $reviewCount: Int!
        $reviewCursor: String
        $threadCount: Int!
        $threadCursor: String
        $commentCount: Int!
        $commentCursor: String
      ) {
        repository(owner: $repoOwner, name: $repoName) {
          pullRequest(number: $prNumber) {
            ...aggregatedReviewsContainer_pullRequest @arguments(
              reviewCount: $reviewCount
              reviewCursor: $reviewCursor
              threadCount: $threadCount
              threadCursor: $threadCursor
              commentCount: $commentCount
              commentCursor: $commentCursor
            )
          }
          id
        }
      }
    `;
    const variables = {
      repoOwner: this.props.owner,
      repoName: this.props.repo,
      prNumber: this.props.number,
      reviewCount: PAGE_SIZE,
      reviewCursor: null,
      threadCount: PAGE_SIZE,
      threadCursor: null,
      commentCount: PAGE_SIZE,
      commentCursor: null,
    };

    return (
      <RelayEnvironment.Provider value={environment}>
        <QueryRenderer
          environment={environment}
          query={query}
          variables={variables}
          render={queryResult => this.renderWithResult(queryResult, {repoData, patch})}
        />
      </RelayEnvironment.Provider>
    );
  }

  renderWithResult({error, props, retry}, {repoData, patch}) {
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

    if (!props || !repoData || !patch) {
      return <LoadingView />;
    }

    return (
      <PullRequestCheckoutController
        {...this.props}
        multiFilePatch={patch}
        {...props}
        {...repoData}
        childComponent={ReviewsController}
      />
    );
  }

  fetchToken = loginModel => loginModel.getToken(this.props.endpoint.getLoginAccount());

  fetchRepositoryData = repository => {
    return yubikiri({
      branches: repository.getBranches(),
      isLoading: repository.isLoading(),
      isPresent: repository.isPresent(),
    });
  }

  handleLogin = token => this.props.loginModel.setToken(this.props.endpoint.getLoginAccount(), token);

  handleLogout = () => this.props.loginModel.removeToken(this.props.endpoint.getLoginAccount());
}
