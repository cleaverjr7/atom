import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {createPaginationContainer, graphql} from 'react-relay';
import Select from 'react-select';

import AtomTextEditor from '../atom/atom-text-editor';

const PAGE_DELAY = 500;

export const PAGE_SIZE = 50;

export class BareRepositoryHomeSelectionView extends React.Component {
  static propTypes = {
    // Relay
    relay: PropTypes.shape({
      hasMore: PropTypes.func.isRequired,
      isLoading: PropTypes.func.isRequired,
      loadMore: PropTypes.func.isRequired,
    }).isRequired,
    user: PropTypes.shape({
      id: PropTypes.string.isRequired,
      login: PropTypes.string.isRequired,
      avatarUrl: PropTypes.string.isRequired,
      organizations: PropTypes.shape({
        edges: PropTypes.arrayOf(PropTypes.shape({
          node: PropTypes.shape({
            id: PropTypes.string.isRequired,
            login: PropTypes.string.isRequired,
            avatarUrl: PropTypes.string.isRequired,
            viewerCanCreateRepositories: PropTypes.bool.isRequired,
          }),
        })),
      }).isRequired,
    }),

    // Model
    nameBuffer: PropTypes.object.isRequired,
    isLoading: PropTypes.bool.isRequired,
    selectedOwnerID: PropTypes.string.isRequired,
    autofocus: PropTypes.shape({
      target: PropTypes.func.isRequired,
    }).isRequired,
    tabGroup: PropTypes.shape({
      reset: PropTypes.func.isRequired,
      nextIndex: PropTypes.func.isRequired,
    }),

    // Selection callback
    didChangeOwnerID: PropTypes.func.isRequired,
  }

  render() {
    this.props.tabGroup.reset();

    const owners = this.getOwners();
    const currentOwner = owners.find(o => o.id === this.props.selectedOwnerID) || owners[0];

    return (
      <div className="github-RepositoryHome">
        <Select
          className="github-RepositoryHome-owner"
          clearable={false}
          disabled={this.props.isLoading}
          options={owners}
          optionRenderer={this.renderOwner}
          value={currentOwner}
          valueRenderer={this.renderOwner}
          onChange={this.didChangeOwner}
          tabIndex={this.props.tabGroup.nextIndex()}
        />
        <span className="github-RepositoryHome-separator">/</span>
        <AtomTextEditor
          ref={this.props.autofocus.target}
          mini={true}
          buffer={this.props.nameBuffer}
          tabIndex={this.props.tabGroup.nextIndex()}
        />
      </div>
    );
  }

  renderOwner = owner => (
    <Fragment>
      <div className="github-RepositoryHome-ownerOption">
        <img alt="" src={owner.avatarURL} className="github-RepositoryHome-ownerAvatar" />
        <span className="github-RepositoryHome-ownerName">{owner.login}</span>
      </div>
      {owner.disabled && !owner.placeholder && (
        <div className="github-RepositoryHome-ownerUnwritable">
          (insufficient permissions)
        </div>
      )}
    </Fragment>
  );

  componentDidMount() {
    this.schedulePageLoad();
  }

  componentDidUpdate() {
    this.schedulePageLoad();
  }

  getOwners() {
    if (!this.props.user) {
      return [{
        id: 'loading',
        login: 'loading...',
        avatarURL: '',
        disabled: true,
        placeholder: true,
      }];
    }

    const owners = [{
      id: this.props.user.id,
      login: this.props.user.login,
      avatarURL: this.props.user.avatarUrl,
      disabled: false,
    }];

    if (!this.props.user.organizations.edges) {
      return owners;
    }

    for (const {node} of this.props.user.organizations.edges) {
      if (!node) {
        continue;
      }

      owners.push({
        id: node.id,
        login: node.login,
        avatarURL: node.avatarUrl,
        disabled: !node.viewerCanCreateRepositories,
      });
    }

    if (this.props.relay && this.props.relay.hasMore()) {
      owners.push({
        id: 'loading',
        login: 'loading...',
        avatarURL: '',
        disabled: true,
        placeholder: true,
      });
    }

    return owners;
  }

  didChangeOwner = owner => this.props.didChangeOwnerID(owner.id);

  schedulePageLoad() {
    if (!this.props.relay.hasMore()) {
      return;
    }

    setTimeout(this.loadNextPage, PAGE_DELAY);
  }

  loadNextPage = () => {
    if (this.props.relay.isLoading()) {
      setTimeout(this.loadNextPage, PAGE_DELAY);
      return;
    }

    this.props.relay.loadMore(PAGE_SIZE);
  }
}

export default createPaginationContainer(BareRepositoryHomeSelectionView, {
  user: graphql`
    fragment repositoryHomeSelectionView_user on User
    @argumentDefinitions(
      organizationCount: {type: "Int!"}
      organizationCursor: {type: "String"}
    ) {
      id
      login
      avatarUrl(size: 24)
      organizations(
        first: $organizationCount
        after: $organizationCursor
      ) @connection(key: "RepositoryHomeSelectionView_organizations") {
        pageInfo {
          hasNextPage
          endCursor
        }

        edges {
          cursor
          node {
            id
            login
            avatarUrl(size: 24)
            viewerCanCreateRepositories
          }
        }
      }
    }
  `,
}, {
  direction: 'forward',
  /* istanbul ignore next */
  getConnectionFromProps(props) {
    return props.user && props.user.organizations;
  },
  /* istanbul ignore next */
  getFragmentVariables(prevVars, totalCount) {
    return {...prevVars, totalCount};
  },
  /* istanbul ignore next */
  getVariables(props, {count, cursor}) {
    return {
      id: props.user.id,
      organizationCount: count,
      organizationCursor: cursor,
    };
  },
  query: graphql`
    query repositoryHomeSelectionViewQuery(
      $id: ID!
      $organizationCount: Int!
      $organizationCursor: String
    ) {
      node(id: $id) {
        ... on User {
          ...repositoryHomeSelectionView_user @arguments(
            organizationCount: $organizationCount
            organizationCursor: $organizationCursor
          )
        }
      }
    }
  `,
});
