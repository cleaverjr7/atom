import PropTypes from 'prop-types';

export const DOMNodePropType = (props, propName, componentName) => {
  if (props[propName] instanceof HTMLElement) {
    return null;
  } else {
    return new Error(
      `Invalid prop '${propName}' supplied to '${componentName}'. Value is not DOM element.`,
    );
  }
};

export const RemotePropType = PropTypes.shape({
  getName: PropTypes.func.isRequired,
  getUrl: PropTypes.func.isRequired,
  isGithubRepo: PropTypes.func.isRequired,
  getOwner: PropTypes.func.isRequired,
  getRepo: PropTypes.func.isRequired,
});

export const BranchPropType = PropTypes.shape({
  getName: PropTypes.func.isRequired,
  isDetached: PropTypes.func.isRequired,
  isPresent: PropTypes.func.isRequired,
});

export const BranchSetPropType = PropTypes.shape({
  getNames: PropTypes.func.isRequired,
  getPullTargets: PropTypes.func.isRequired,
  getPushSources: PropTypes.func.isRequired,
});

export const CommitPropType = PropTypes.shape({
  getSha: PropTypes.func.isRequired,
  getMessageSubject: PropTypes.func.isRequired,
  isUnbornRef: PropTypes.func.isRequired,
  isPresent: PropTypes.func.isRequired,
});

export const AuthorPropType = PropTypes.shape({
  email: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
});

export const RelayConnectionPropType = nodePropType => PropTypes.shape({
  edges: PropTypes.arrayOf(
    PropTypes.shape({
      cursor: PropTypes.string,
      node: nodePropType,
    }),
  ),
  pageInfo: PropTypes.shape({
    endCursor: PropTypes.string,
    hasNextPage: PropTypes.bool,
    hasPreviousPage: PropTypes.bool,
    startCursor: PropTypes.string,
  }),
  totalCount: PropTypes.number,
});

export const RefHolderPropType = PropTypes.shape({
  isEmpty: PropTypes.func.isRequired,
  get: PropTypes.func.isRequired,
  setter: PropTypes.func.isRequired,
  observe: PropTypes.func.isRequired,
});

export const FilePatchItemPropType = PropTypes.shape({
  filePath: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
});

export const MergeConflictItemPropType = PropTypes.shape({
  filePath: PropTypes.string.isRequired,
  status: PropTypes.shape({
    file: PropTypes.oneOf([]).isRequired,
    ours: PropTypes.oneOf([]).isRequired,
    theirs: PropTypes.oneOf([]).isRequired,
  }).isRequired,
});
