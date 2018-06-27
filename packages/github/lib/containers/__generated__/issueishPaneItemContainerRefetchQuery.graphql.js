/**
 * @flow
 * @relayHash b45b269409a7865246e37c4dc1a47432
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest } from 'relay-runtime';
type issueishPaneItemContainer_issueish$ref = any;
type issueishPaneItemContainer_repository$ref = any;
export type issueishPaneItemContainerRefetchQueryVariables = {|
  repoId: string,
  issueishId: string,
  timelineCount: number,
  timelineCursor?: ?string,
|};
export type issueishPaneItemContainerRefetchQueryResponse = {|
  +repository: ?{|
    +$fragmentRefs: issueishPaneItemContainer_repository$ref
  |},
  +issueish: ?{|
    +$fragmentRefs: issueishPaneItemContainer_issueish$ref
  |},
|};
*/


/*
query issueishPaneItemContainerRefetchQuery(
  $repoId: ID!
  $issueishId: ID!
  $timelineCount: Int!
  $timelineCursor: String
) {
  repository: node(id: $repoId) {
    __typename
    ...issueishPaneItemContainer_repository
    id
  }
  issueish: node(id: $issueishId) {
    __typename
    ...issueishPaneItemContainer_issueish_3D8CP9
    id
  }
}

fragment issueishPaneItemContainer_repository on Repository {
  id
  name
  owner {
    __typename
    login
    id
  }
}

fragment issueishPaneItemContainer_issueish_3D8CP9 on IssueOrPullRequest {
  __typename
  ... on Node {
    id
  }
  ... on Issue {
    state
    number
    title
    bodyHTML
    author {
      __typename
      login
      avatarUrl
      ... on User {
        url
      }
      ... on Bot {
        url
      }
      ... on Node {
        id
      }
    }
    ...issueTimelineContainer_issue_3D8CP9
  }
  ... on PullRequest {
    ...prStatusesContainer_pullRequest
    state
    number
    title
    bodyHTML
    author {
      __typename
      login
      avatarUrl
      ... on User {
        url
      }
      ... on Bot {
        url
      }
      ... on Node {
        id
      }
    }
    ...prTimelineContainer_pullRequest_3D8CP9
  }
  ... on UniformResourceLocatable {
    url
  }
  ... on Reactable {
    reactionGroups {
      content
      users {
        totalCount
      }
    }
  }
}

fragment issueTimelineContainer_issue_3D8CP9 on Issue {
  url
  timeline(first: $timelineCount, after: $timelineCursor) {
    pageInfo {
      endCursor
      hasNextPage
    }
    edges {
      cursor
      node {
        __typename
        ...commitsContainer_nodes
        ...issueCommentContainer_item
        ...crossReferencedEventsContainer_nodes
        ... on Node {
          id
        }
      }
    }
  }
}

fragment prStatusesContainer_pullRequest on PullRequest {
  id
  commits(last: 1) {
    edges {
      node {
        commit {
          status {
            state
            contexts {
              id
              state
              ...prStatusContextContainer_context
            }
            id
          }
          id
        }
        id
      }
    }
  }
}

fragment prTimelineContainer_pullRequest_3D8CP9 on PullRequest {
  url
  ...headRefForcePushedEventContainer_issueish
  timeline(first: $timelineCount, after: $timelineCursor) {
    pageInfo {
      endCursor
      hasNextPage
    }
    edges {
      cursor
      node {
        __typename
        ...commitsContainer_nodes
        ...issueCommentContainer_item
        ...mergedEventContainer_item
        ...headRefForcePushedEventContainer_item
        ...commitCommentThreadContainer_item
        ...crossReferencedEventsContainer_nodes
        ... on Node {
          id
        }
      }
    }
  }
}

fragment headRefForcePushedEventContainer_issueish on PullRequest {
  headRefName
  headRepositoryOwner {
    __typename
    login
    id
  }
  repository {
    owner {
      __typename
      login
      id
    }
    id
  }
}

fragment commitsContainer_nodes on Commit {
  id
  author {
    name
    user {
      login
      id
    }
  }
  ...commitContainer_item
}

fragment issueCommentContainer_item on IssueComment {
  author {
    __typename
    avatarUrl
    login
    ... on Node {
      id
    }
  }
  bodyHTML
  createdAt
}

fragment mergedEventContainer_item on MergedEvent {
  actor {
    __typename
    avatarUrl
    login
    ... on Node {
      id
    }
  }
  commit {
    oid
    id
  }
  mergeRefName
  createdAt
}

fragment headRefForcePushedEventContainer_item on HeadRefForcePushedEvent {
  actor {
    __typename
    avatarUrl
    login
    ... on Node {
      id
    }
  }
  beforeCommit {
    oid
    id
  }
  afterCommit {
    oid
    id
  }
  createdAt
}

fragment commitCommentThreadContainer_item on CommitCommentThread {
  commit {
    oid
    id
  }
  comments(first: 100) {
    edges {
      node {
        id
        ...commitCommentContainer_item
      }
    }
  }
}

fragment crossReferencedEventsContainer_nodes on CrossReferencedEvent {
  id
  referencedAt
  isCrossRepository
  actor {
    __typename
    login
    avatarUrl
    ... on Node {
      id
    }
  }
  source {
    __typename
    ... on RepositoryNode {
      repository {
        name
        owner {
          __typename
          login
          id
        }
        id
      }
    }
    ... on Node {
      id
    }
  }
  ...crossReferencedEventContainer_item
}

fragment crossReferencedEventContainer_item on CrossReferencedEvent {
  id
  isCrossRepository
  source {
    __typename
    ... on Issue {
      number
      title
      url
      issueState: state
    }
    ... on PullRequest {
      number
      title
      url
      prState: state
    }
    ... on RepositoryNode {
      repository {
        name
        isPrivate
        owner {
          __typename
          login
          id
        }
        id
      }
    }
    ... on Node {
      id
    }
  }
}

fragment commitCommentContainer_item on CommitComment {
  author {
    __typename
    login
    avatarUrl
    ... on Node {
      id
    }
  }
  commit {
    oid
    id
  }
  bodyHTML
  createdAt
  path
  position
}

fragment commitContainer_item on Commit {
  author {
    name
    avatarUrl
    user {
      login
      id
    }
  }
  committer {
    name
    avatarUrl
    user {
      login
      id
    }
  }
  authoredByCommitter
  oid
  message
  messageHeadlineHTML
}

fragment prStatusContextContainer_context on StatusContext {
  context
  description
  state
  targetUrl
}
*/

const node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "kind": "LocalArgument",
    "name": "repoId",
    "type": "ID!",
    "defaultValue": null
  },
  {
    "kind": "LocalArgument",
    "name": "issueishId",
    "type": "ID!",
    "defaultValue": null
  },
  {
    "kind": "LocalArgument",
    "name": "timelineCount",
    "type": "Int!",
    "defaultValue": null
  },
  {
    "kind": "LocalArgument",
    "name": "timelineCursor",
    "type": "String",
    "defaultValue": null
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "repoId",
    "type": "ID!"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "issueishId",
    "type": "ID!"
  }
],
v3 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "__typename",
  "args": null,
  "storageKey": null
},
v4 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "id",
  "args": null,
  "storageKey": null
},
v5 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "name",
  "args": null,
  "storageKey": null
},
v6 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "login",
  "args": null,
  "storageKey": null
},
v7 = [
  v3,
  v6,
  v4
],
v8 = {
  "kind": "LinkedField",
  "alias": null,
  "name": "owner",
  "storageKey": null,
  "args": null,
  "concreteType": null,
  "plural": false,
  "selections": v7
},
v9 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "url",
  "args": null,
  "storageKey": null
},
v10 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "avatarUrl",
  "args": null,
  "storageKey": null
},
v11 = [
  v9
],
v12 = {
  "kind": "LinkedField",
  "alias": null,
  "name": "author",
  "storageKey": null,
  "args": null,
  "concreteType": null,
  "plural": false,
  "selections": [
    v3,
    v6,
    v10,
    v4,
    {
      "kind": "InlineFragment",
      "type": "Bot",
      "selections": v11
    },
    {
      "kind": "InlineFragment",
      "type": "User",
      "selections": v11
    }
  ]
},
v13 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "state",
  "args": null,
  "storageKey": null
},
v14 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "number",
  "args": null,
  "storageKey": null
},
v15 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "title",
  "args": null,
  "storageKey": null
},
v16 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "bodyHTML",
  "args": null,
  "storageKey": null
},
v17 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "timelineCursor",
    "type": "String"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "timelineCount",
    "type": "Int"
  }
],
v18 = {
  "kind": "LinkedField",
  "alias": null,
  "name": "pageInfo",
  "storageKey": null,
  "args": null,
  "concreteType": "PageInfo",
  "plural": false,
  "selections": [
    {
      "kind": "ScalarField",
      "alias": null,
      "name": "endCursor",
      "args": null,
      "storageKey": null
    },
    {
      "kind": "ScalarField",
      "alias": null,
      "name": "hasNextPage",
      "args": null,
      "storageKey": null
    }
  ]
},
v19 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "cursor",
  "args": null,
  "storageKey": null
},
v20 = [
  v3,
  v6,
  v10,
  v4
],
v21 = {
  "kind": "InlineFragment",
  "type": "CrossReferencedEvent",
  "selections": [
    {
      "kind": "ScalarField",
      "alias": null,
      "name": "referencedAt",
      "args": null,
      "storageKey": null
    },
    {
      "kind": "ScalarField",
      "alias": null,
      "name": "isCrossRepository",
      "args": null,
      "storageKey": null
    },
    {
      "kind": "LinkedField",
      "alias": null,
      "name": "actor",
      "storageKey": null,
      "args": null,
      "concreteType": null,
      "plural": false,
      "selections": v20
    },
    {
      "kind": "LinkedField",
      "alias": null,
      "name": "source",
      "storageKey": null,
      "args": null,
      "concreteType": null,
      "plural": false,
      "selections": [
        v3,
        {
          "kind": "LinkedField",
          "alias": null,
          "name": "repository",
          "storageKey": null,
          "args": null,
          "concreteType": "Repository",
          "plural": false,
          "selections": [
            v5,
            v8,
            v4,
            {
              "kind": "ScalarField",
              "alias": null,
              "name": "isPrivate",
              "args": null,
              "storageKey": null
            }
          ]
        },
        v4,
        {
          "kind": "InlineFragment",
          "type": "PullRequest",
          "selections": [
            v14,
            v15,
            v9,
            {
              "kind": "ScalarField",
              "alias": "prState",
              "name": "state",
              "args": null,
              "storageKey": null
            }
          ]
        },
        {
          "kind": "InlineFragment",
          "type": "Issue",
          "selections": [
            v14,
            v15,
            v9,
            {
              "kind": "ScalarField",
              "alias": "issueState",
              "name": "state",
              "args": null,
              "storageKey": null
            }
          ]
        }
      ]
    }
  ]
},
v22 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "oid",
  "args": null,
  "storageKey": null
},
v23 = [
  v22,
  v4
],
v24 = {
  "kind": "LinkedField",
  "alias": null,
  "name": "commit",
  "storageKey": null,
  "args": null,
  "concreteType": "Commit",
  "plural": false,
  "selections": v23
},
v25 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "createdAt",
  "args": null,
  "storageKey": null
},
v26 = [
  v3,
  v10,
  v6,
  v4
],
v27 = {
  "kind": "LinkedField",
  "alias": null,
  "name": "actor",
  "storageKey": null,
  "args": null,
  "concreteType": null,
  "plural": false,
  "selections": v26
},
v28 = {
  "kind": "InlineFragment",
  "type": "IssueComment",
  "selections": [
    {
      "kind": "LinkedField",
      "alias": null,
      "name": "author",
      "storageKey": null,
      "args": null,
      "concreteType": null,
      "plural": false,
      "selections": v26
    },
    v16,
    v25
  ]
},
v29 = {
  "kind": "LinkedField",
  "alias": null,
  "name": "user",
  "storageKey": null,
  "args": null,
  "concreteType": "User",
  "plural": false,
  "selections": [
    v6,
    v4
  ]
},
v30 = {
  "kind": "InlineFragment",
  "type": "Commit",
  "selections": [
    {
      "kind": "LinkedField",
      "alias": null,
      "name": "author",
      "storageKey": null,
      "args": null,
      "concreteType": "GitActor",
      "plural": false,
      "selections": [
        v5,
        v29,
        v10
      ]
    },
    {
      "kind": "LinkedField",
      "alias": null,
      "name": "committer",
      "storageKey": null,
      "args": null,
      "concreteType": "GitActor",
      "plural": false,
      "selections": [
        v5,
        v10,
        v29
      ]
    },
    {
      "kind": "ScalarField",
      "alias": null,
      "name": "authoredByCommitter",
      "args": null,
      "storageKey": null
    },
    v22,
    {
      "kind": "ScalarField",
      "alias": null,
      "name": "message",
      "args": null,
      "storageKey": null
    },
    {
      "kind": "ScalarField",
      "alias": null,
      "name": "messageHeadlineHTML",
      "args": null,
      "storageKey": null
    }
  ]
};
return {
  "kind": "Request",
  "operationKind": "query",
  "name": "issueishPaneItemContainerRefetchQuery",
  "id": null,
  "text": "query issueishPaneItemContainerRefetchQuery(\n  $repoId: ID!\n  $issueishId: ID!\n  $timelineCount: Int!\n  $timelineCursor: String\n) {\n  repository: node(id: $repoId) {\n    __typename\n    ...issueishPaneItemContainer_repository\n    id\n  }\n  issueish: node(id: $issueishId) {\n    __typename\n    ...issueishPaneItemContainer_issueish_3D8CP9\n    id\n  }\n}\n\nfragment issueishPaneItemContainer_repository on Repository {\n  id\n  name\n  owner {\n    __typename\n    login\n    id\n  }\n}\n\nfragment issueishPaneItemContainer_issueish_3D8CP9 on IssueOrPullRequest {\n  __typename\n  ... on Node {\n    id\n  }\n  ... on Issue {\n    state\n    number\n    title\n    bodyHTML\n    author {\n      __typename\n      login\n      avatarUrl\n      ... on User {\n        url\n      }\n      ... on Bot {\n        url\n      }\n      ... on Node {\n        id\n      }\n    }\n    ...issueTimelineContainer_issue_3D8CP9\n  }\n  ... on PullRequest {\n    ...prStatusesContainer_pullRequest\n    state\n    number\n    title\n    bodyHTML\n    author {\n      __typename\n      login\n      avatarUrl\n      ... on User {\n        url\n      }\n      ... on Bot {\n        url\n      }\n      ... on Node {\n        id\n      }\n    }\n    ...prTimelineContainer_pullRequest_3D8CP9\n  }\n  ... on UniformResourceLocatable {\n    url\n  }\n  ... on Reactable {\n    reactionGroups {\n      content\n      users {\n        totalCount\n      }\n    }\n  }\n}\n\nfragment issueTimelineContainer_issue_3D8CP9 on Issue {\n  url\n  timeline(first: $timelineCount, after: $timelineCursor) {\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n    edges {\n      cursor\n      node {\n        __typename\n        ...commitsContainer_nodes\n        ...issueCommentContainer_item\n        ...crossReferencedEventsContainer_nodes\n        ... on Node {\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment prStatusesContainer_pullRequest on PullRequest {\n  id\n  commits(last: 1) {\n    edges {\n      node {\n        commit {\n          status {\n            state\n            contexts {\n              id\n              state\n              ...prStatusContextContainer_context\n            }\n            id\n          }\n          id\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment prTimelineContainer_pullRequest_3D8CP9 on PullRequest {\n  url\n  ...headRefForcePushedEventContainer_issueish\n  timeline(first: $timelineCount, after: $timelineCursor) {\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n    edges {\n      cursor\n      node {\n        __typename\n        ...commitsContainer_nodes\n        ...issueCommentContainer_item\n        ...mergedEventContainer_item\n        ...headRefForcePushedEventContainer_item\n        ...commitCommentThreadContainer_item\n        ...crossReferencedEventsContainer_nodes\n        ... on Node {\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment headRefForcePushedEventContainer_issueish on PullRequest {\n  headRefName\n  headRepositoryOwner {\n    __typename\n    login\n    id\n  }\n  repository {\n    owner {\n      __typename\n      login\n      id\n    }\n    id\n  }\n}\n\nfragment commitsContainer_nodes on Commit {\n  id\n  author {\n    name\n    user {\n      login\n      id\n    }\n  }\n  ...commitContainer_item\n}\n\nfragment issueCommentContainer_item on IssueComment {\n  author {\n    __typename\n    avatarUrl\n    login\n    ... on Node {\n      id\n    }\n  }\n  bodyHTML\n  createdAt\n}\n\nfragment mergedEventContainer_item on MergedEvent {\n  actor {\n    __typename\n    avatarUrl\n    login\n    ... on Node {\n      id\n    }\n  }\n  commit {\n    oid\n    id\n  }\n  mergeRefName\n  createdAt\n}\n\nfragment headRefForcePushedEventContainer_item on HeadRefForcePushedEvent {\n  actor {\n    __typename\n    avatarUrl\n    login\n    ... on Node {\n      id\n    }\n  }\n  beforeCommit {\n    oid\n    id\n  }\n  afterCommit {\n    oid\n    id\n  }\n  createdAt\n}\n\nfragment commitCommentThreadContainer_item on CommitCommentThread {\n  commit {\n    oid\n    id\n  }\n  comments(first: 100) {\n    edges {\n      node {\n        id\n        ...commitCommentContainer_item\n      }\n    }\n  }\n}\n\nfragment crossReferencedEventsContainer_nodes on CrossReferencedEvent {\n  id\n  referencedAt\n  isCrossRepository\n  actor {\n    __typename\n    login\n    avatarUrl\n    ... on Node {\n      id\n    }\n  }\n  source {\n    __typename\n    ... on RepositoryNode {\n      repository {\n        name\n        owner {\n          __typename\n          login\n          id\n        }\n        id\n      }\n    }\n    ... on Node {\n      id\n    }\n  }\n  ...crossReferencedEventContainer_item\n}\n\nfragment crossReferencedEventContainer_item on CrossReferencedEvent {\n  id\n  isCrossRepository\n  source {\n    __typename\n    ... on Issue {\n      number\n      title\n      url\n      issueState: state\n    }\n    ... on PullRequest {\n      number\n      title\n      url\n      prState: state\n    }\n    ... on RepositoryNode {\n      repository {\n        name\n        isPrivate\n        owner {\n          __typename\n          login\n          id\n        }\n        id\n      }\n    }\n    ... on Node {\n      id\n    }\n  }\n}\n\nfragment commitCommentContainer_item on CommitComment {\n  author {\n    __typename\n    login\n    avatarUrl\n    ... on Node {\n      id\n    }\n  }\n  commit {\n    oid\n    id\n  }\n  bodyHTML\n  createdAt\n  path\n  position\n}\n\nfragment commitContainer_item on Commit {\n  author {\n    name\n    avatarUrl\n    user {\n      login\n      id\n    }\n  }\n  committer {\n    name\n    avatarUrl\n    user {\n      login\n      id\n    }\n  }\n  authoredByCommitter\n  oid\n  message\n  messageHeadlineHTML\n}\n\nfragment prStatusContextContainer_context on StatusContext {\n  context\n  description\n  state\n  targetUrl\n}\n",
  "metadata": {},
  "fragment": {
    "kind": "Fragment",
    "name": "issueishPaneItemContainerRefetchQuery",
    "type": "Query",
    "metadata": null,
    "argumentDefinitions": v0,
    "selections": [
      {
        "kind": "LinkedField",
        "alias": "repository",
        "name": "node",
        "storageKey": null,
        "args": v1,
        "concreteType": null,
        "plural": false,
        "selections": [
          {
            "kind": "FragmentSpread",
            "name": "issueishPaneItemContainer_repository",
            "args": null
          }
        ]
      },
      {
        "kind": "LinkedField",
        "alias": "issueish",
        "name": "node",
        "storageKey": null,
        "args": v2,
        "concreteType": null,
        "plural": false,
        "selections": [
          {
            "kind": "FragmentSpread",
            "name": "issueishPaneItemContainer_issueish",
            "args": [
              {
                "kind": "Variable",
                "name": "timelineCount",
                "variableName": "timelineCount",
                "type": null
              },
              {
                "kind": "Variable",
                "name": "timelineCursor",
                "variableName": "timelineCursor",
                "type": null
              }
            ]
          }
        ]
      }
    ]
  },
  "operation": {
    "kind": "Operation",
    "name": "issueishPaneItemContainerRefetchQuery",
    "argumentDefinitions": v0,
    "selections": [
      {
        "kind": "LinkedField",
        "alias": "repository",
        "name": "node",
        "storageKey": null,
        "args": v1,
        "concreteType": null,
        "plural": false,
        "selections": [
          v3,
          v4,
          {
            "kind": "InlineFragment",
            "type": "Repository",
            "selections": [
              v5,
              v8
            ]
          }
        ]
      },
      {
        "kind": "LinkedField",
        "alias": "issueish",
        "name": "node",
        "storageKey": null,
        "args": v2,
        "concreteType": null,
        "plural": false,
        "selections": [
          v3,
          v4,
          v9,
          {
            "kind": "LinkedField",
            "alias": null,
            "name": "reactionGroups",
            "storageKey": null,
            "args": null,
            "concreteType": "ReactionGroup",
            "plural": true,
            "selections": [
              {
                "kind": "ScalarField",
                "alias": null,
                "name": "content",
                "args": null,
                "storageKey": null
              },
              {
                "kind": "LinkedField",
                "alias": null,
                "name": "users",
                "storageKey": null,
                "args": null,
                "concreteType": "ReactingUserConnection",
                "plural": false,
                "selections": [
                  {
                    "kind": "ScalarField",
                    "alias": null,
                    "name": "totalCount",
                    "args": null,
                    "storageKey": null
                  }
                ]
              }
            ]
          },
          {
            "kind": "InlineFragment",
            "type": "PullRequest",
            "selections": [
              v12,
              v13,
              v14,
              v15,
              v16,
              {
                "kind": "LinkedField",
                "alias": null,
                "name": "commits",
                "storageKey": "commits(last:1)",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "last",
                    "value": 1,
                    "type": "Int"
                  }
                ],
                "concreteType": "PullRequestCommitConnection",
                "plural": false,
                "selections": [
                  {
                    "kind": "LinkedField",
                    "alias": null,
                    "name": "edges",
                    "storageKey": null,
                    "args": null,
                    "concreteType": "PullRequestCommitEdge",
                    "plural": true,
                    "selections": [
                      {
                        "kind": "LinkedField",
                        "alias": null,
                        "name": "node",
                        "storageKey": null,
                        "args": null,
                        "concreteType": "PullRequestCommit",
                        "plural": false,
                        "selections": [
                          {
                            "kind": "LinkedField",
                            "alias": null,
                            "name": "commit",
                            "storageKey": null,
                            "args": null,
                            "concreteType": "Commit",
                            "plural": false,
                            "selections": [
                              {
                                "kind": "LinkedField",
                                "alias": null,
                                "name": "status",
                                "storageKey": null,
                                "args": null,
                                "concreteType": "Status",
                                "plural": false,
                                "selections": [
                                  v13,
                                  {
                                    "kind": "LinkedField",
                                    "alias": null,
                                    "name": "contexts",
                                    "storageKey": null,
                                    "args": null,
                                    "concreteType": "StatusContext",
                                    "plural": true,
                                    "selections": [
                                      v4,
                                      v13,
                                      {
                                        "kind": "ScalarField",
                                        "alias": null,
                                        "name": "context",
                                        "args": null,
                                        "storageKey": null
                                      },
                                      {
                                        "kind": "ScalarField",
                                        "alias": null,
                                        "name": "description",
                                        "args": null,
                                        "storageKey": null
                                      },
                                      {
                                        "kind": "ScalarField",
                                        "alias": null,
                                        "name": "targetUrl",
                                        "args": null,
                                        "storageKey": null
                                      }
                                    ]
                                  },
                                  v4
                                ]
                              },
                              v4
                            ]
                          },
                          v4
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "kind": "ScalarField",
                "alias": null,
                "name": "headRefName",
                "args": null,
                "storageKey": null
              },
              {
                "kind": "LinkedField",
                "alias": null,
                "name": "headRepositoryOwner",
                "storageKey": null,
                "args": null,
                "concreteType": null,
                "plural": false,
                "selections": v7
              },
              {
                "kind": "LinkedField",
                "alias": null,
                "name": "repository",
                "storageKey": null,
                "args": null,
                "concreteType": "Repository",
                "plural": false,
                "selections": [
                  v8,
                  v4
                ]
              },
              {
                "kind": "LinkedField",
                "alias": null,
                "name": "timeline",
                "storageKey": null,
                "args": v17,
                "concreteType": "PullRequestTimelineConnection",
                "plural": false,
                "selections": [
                  v18,
                  {
                    "kind": "LinkedField",
                    "alias": null,
                    "name": "edges",
                    "storageKey": null,
                    "args": null,
                    "concreteType": "PullRequestTimelineItemEdge",
                    "plural": true,
                    "selections": [
                      v19,
                      {
                        "kind": "LinkedField",
                        "alias": null,
                        "name": "node",
                        "storageKey": null,
                        "args": null,
                        "concreteType": null,
                        "plural": false,
                        "selections": [
                          v3,
                          v4,
                          v21,
                          {
                            "kind": "InlineFragment",
                            "type": "CommitCommentThread",
                            "selections": [
                              v24,
                              {
                                "kind": "LinkedField",
                                "alias": null,
                                "name": "comments",
                                "storageKey": "comments(first:100)",
                                "args": [
                                  {
                                    "kind": "Literal",
                                    "name": "first",
                                    "value": 100,
                                    "type": "Int"
                                  }
                                ],
                                "concreteType": "CommitCommentConnection",
                                "plural": false,
                                "selections": [
                                  {
                                    "kind": "LinkedField",
                                    "alias": null,
                                    "name": "edges",
                                    "storageKey": null,
                                    "args": null,
                                    "concreteType": "CommitCommentEdge",
                                    "plural": true,
                                    "selections": [
                                      {
                                        "kind": "LinkedField",
                                        "alias": null,
                                        "name": "node",
                                        "storageKey": null,
                                        "args": null,
                                        "concreteType": "CommitComment",
                                        "plural": false,
                                        "selections": [
                                          v4,
                                          {
                                            "kind": "LinkedField",
                                            "alias": null,
                                            "name": "author",
                                            "storageKey": null,
                                            "args": null,
                                            "concreteType": null,
                                            "plural": false,
                                            "selections": v20
                                          },
                                          v24,
                                          v16,
                                          v25,
                                          {
                                            "kind": "ScalarField",
                                            "alias": null,
                                            "name": "path",
                                            "args": null,
                                            "storageKey": null
                                          },
                                          {
                                            "kind": "ScalarField",
                                            "alias": null,
                                            "name": "position",
                                            "args": null,
                                            "storageKey": null
                                          }
                                        ]
                                      }
                                    ]
                                  }
                                ]
                              }
                            ]
                          },
                          {
                            "kind": "InlineFragment",
                            "type": "HeadRefForcePushedEvent",
                            "selections": [
                              v27,
                              {
                                "kind": "LinkedField",
                                "alias": null,
                                "name": "beforeCommit",
                                "storageKey": null,
                                "args": null,
                                "concreteType": "Commit",
                                "plural": false,
                                "selections": v23
                              },
                              {
                                "kind": "LinkedField",
                                "alias": null,
                                "name": "afterCommit",
                                "storageKey": null,
                                "args": null,
                                "concreteType": "Commit",
                                "plural": false,
                                "selections": v23
                              },
                              v25
                            ]
                          },
                          {
                            "kind": "InlineFragment",
                            "type": "MergedEvent",
                            "selections": [
                              v27,
                              v24,
                              {
                                "kind": "ScalarField",
                                "alias": null,
                                "name": "mergeRefName",
                                "args": null,
                                "storageKey": null
                              },
                              v25
                            ]
                          },
                          v28,
                          v30
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "kind": "LinkedHandle",
                "alias": null,
                "name": "timeline",
                "args": v17,
                "handle": "connection",
                "key": "prTimelineContainer_timeline",
                "filters": null
              }
            ]
          },
          {
            "kind": "InlineFragment",
            "type": "Issue",
            "selections": [
              v13,
              v14,
              v15,
              v16,
              v12,
              {
                "kind": "LinkedField",
                "alias": null,
                "name": "timeline",
                "storageKey": null,
                "args": v17,
                "concreteType": "IssueTimelineConnection",
                "plural": false,
                "selections": [
                  v18,
                  {
                    "kind": "LinkedField",
                    "alias": null,
                    "name": "edges",
                    "storageKey": null,
                    "args": null,
                    "concreteType": "IssueTimelineItemEdge",
                    "plural": true,
                    "selections": [
                      v19,
                      {
                        "kind": "LinkedField",
                        "alias": null,
                        "name": "node",
                        "storageKey": null,
                        "args": null,
                        "concreteType": null,
                        "plural": false,
                        "selections": [
                          v3,
                          v4,
                          v21,
                          v28,
                          v30
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "kind": "LinkedHandle",
                "alias": null,
                "name": "timeline",
                "args": v17,
                "handle": "connection",
                "key": "IssueTimelineContainer_timeline",
                "filters": null
              }
            ]
          }
        ]
      }
    ]
  }
};
})();
// prettier-ignore
(node/*: any*/).hash = '51442b1c4d9a853580138f01efbc45fa';
module.exports = node;
