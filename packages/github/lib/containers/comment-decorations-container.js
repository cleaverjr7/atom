import React from 'react';
import PropTypes from 'prop-types';
import yubikiri from 'yubikiri';
import {QueryRenderer, graphql} from 'react-relay';

import CommentDecorationsController from '../controllers/comment-decorations-controller';
import ObserveModel from '../views/observe-model';
import RelayEnvironment from '../views/relay-environment';
import {GithubLoginModelPropType} from '../prop-types';
import {UNAUTHENTICATED, INSUFFICIENT} from '../shared/keytar-strategy';
import RelayNetworkLayerManager from '../relay-network-layer-manager';
import {PAGE_SIZE} from '../helpers';
import AggregatedReviewsContainer from './aggregated-reviews-container';
import CommentPositioningContainer from './comment-positioning-container';
import PullRequestPatchContainer from './pr-patch-container';

export default class CommentDecorationsContainer extends React.Component {
  static propTypes = {
    workspace: PropTypes.object.isRequired,
    localRepository: PropTypes.object.isRequired,
    loginModel: GithubLoginModelPropType.isRequired,
  };

  render() {
    return (
      <ObserveModel model={this.props.localRepository} fetchData={this.fetchRepositoryData}>
        {this.renderWithLocalRepositoryData}
      </ObserveModel>
    );
  }

  renderWithLocalRepositoryData = repoData => {
    if (!repoData) {
      return null;
    }

    return (
      <ObserveModel
        model={this.props.loginModel}
        fetchParams={[repoData, this.props.loginModel]}
        fetchData={this.fetchToken}>
        {token => this.renderWithToken(token, {repoData})}
      </ObserveModel>
    );
  }

  renderWithToken(token, {repoData}) {
    if (!token || token === UNAUTHENTICATED || token === INSUFFICIENT) {
      // we're not going to prompt users to log in to render decorations for comments
      // just let it go and move on with our lives.
      return null;
    }

    const head = repoData.branches.getHeadBranch();
    if (!head.isPresent()) {
      return null;
    }

    const push = head.getPush();
    if (!push.isPresent() || !push.isRemoteTracking()) {
      return null;
    }

    const pushRemote = repoData.remotes.withName(push.getRemoteName());
    if (!pushRemote.isPresent() || !pushRemote.isGithubRepo()) {
      return null;
    }

    const endpoint = repoData.currentRemote.getEndpoint();
    const environment = RelayNetworkLayerManager.getEnvironmentForHost(endpoint, token);
    const query = graphql`
      query commentDecorationsContainerQuery(
        $headOwner: String!
        $headName: String!
        $headRef: String!
        $reviewCount: Int!
        $reviewCursor: String
        $threadCount: Int!
        $threadCursor: String
        $commentCount: Int!
        $commentCursor: String
        $first: Int!
      ) {
        repository(owner: $headOwner, name: $headName) {
          ref(qualifiedName: $headRef) {
            associatedPullRequests(first: $first, states: [OPEN]) {
              totalCount
              nodes {
                number
                headRefOid

                ...commentDecorationsController_pullRequests
                ...aggregatedReviewsContainer_pullRequest @arguments(
                  reviewCount: $reviewCount
                  reviewCursor: $reviewCursor
                  threadCount: $threadCount
                  threadCursor: $threadCursor
                  commentCount: $commentCount
                  commentCursor: $commentCursor
                )
              }
            }
          }
        }
      }
    `;
    const variables = {
      headOwner: pushRemote.getOwner(),
      headName: pushRemote.getRepo(),
      headRef: push.getRemoteRef(),
      first: 1,
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
          render={queryResult => this.renderWithGraphQLData({
            endpoint,
            owner: variables.headOwner,
            repo: variables.headName,
            ...queryResult,
          }, {repoData, token})}
        />
      </RelayEnvironment.Provider>
    );
  }

  renderWithGraphQLData({error, props, endpoint, owner, repo}, {repoData, token}) {
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(`error fetching CommentDecorationsContainer data: ${error}`);
      return null;
    }

    if (
      !props || !props.repository || !props.repository.ref ||
      props.repository.ref.associatedPullRequests.totalCount === 0
    ) {
      // no loading spinner for you
      // just fetch silently behind the scenes like a good little container
      return null;
    }

    const currentPullRequest = props.repository.ref.associatedPullRequests.nodes[0];
    const queryProps = {currentPullRequest, ...props};

    return (
      <PullRequestPatchContainer
        owner={owner}
        repo={repo}
        number={currentPullRequest.number}
        endpoint={endpoint}
        token={token}>
        {(patchError, patch) => this.renderWithPatch(
          {error: patchError, patch},
          {queryProps, endpoint, owner, repo, repoData},
        )}
      </PullRequestPatchContainer>
    );
  }

  renderWithPatch({error, patch}, {queryProps, endpoint, owner, repo, repoData}) {
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('Error fetching patch for current pull request', error);
      return null;
    }

    return (
      <AggregatedReviewsContainer pullRequest={queryProps.currentPullRequest}>
        {({errors, summaries, commentThreads}) => {
          if (errors && errors.length > 0) {
            // eslint-disable-next-line no-console
            console.warn('Errors aggregating reviews and comments for current pull request', ...errors);
            return null;
          }

          const aggregationResult = {summaries, commentThreads};
          return this.renderWithResult(aggregationResult, {
            queryProps, endpoint, owner, repo, repoData, patch,
          });
        }}
      </AggregatedReviewsContainer>
    );
  }

  renderWithResult(aggregationResult, {queryProps, endpoint, owner, repo, repoData, patch}) {
    if (!patch) {
      return null;
    }

    return (
      <CommentPositioningContainer
        multiFilePatch={patch}
        commentThreads={aggregationResult.commentThreads}
        prCommitSha={queryProps.currentPullRequest.headRefOid}
        localRepository={this.props.localRepository}
        workdir={repoData.workingDirectoryPath}>
        {(commentTranslations, updateForFile) => {
          if (!commentTranslations) {
            return null;
          }

          return (
            <CommentDecorationsController
              endpoint={endpoint}
              owner={owner}
              repo={repo}
              workspace={this.props.workspace}
              repoData={repoData}
              commentThreads={aggregationResult.commentThreads}
              commentTranslations={commentTranslations}
              pullRequests={queryProps.repository.ref.associatedPullRequests.nodes}
              updateCommentTranslations={updateForFile}
            />
          );
        }}
      </CommentPositioningContainer>
    );
  }

  fetchRepositoryData = repository => {
    return yubikiri({
      branches: repository.getBranches(),
      remotes: repository.getRemotes(),
      currentRemote: repository.getCurrentGitHubRemote(),
      workingDirectoryPath: repository.getWorkingDirectoryPath(),
    });
  }

  fetchToken = (loginModel, repoData) => {
    const endpoint = repoData.currentRemote.getEndpoint();
    if (!endpoint) {
      return null;
    }

    return loginModel.getToken(endpoint.getLoginAccount());
  }
}
