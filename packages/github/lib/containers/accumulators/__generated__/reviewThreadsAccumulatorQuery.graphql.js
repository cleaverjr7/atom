/**
 * @flow
 * @relayHash 3b6e1774688a07504efa4aec9861ffe9
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest } from 'relay-runtime';
type reviewThreadsAccumulator_pullRequest$ref = any;
export type reviewThreadsAccumulatorQueryVariables = {|
  url: any,
  threadCount: number,
  threadCursor?: ?string,
  commentCount: number,
|};
export type reviewThreadsAccumulatorQueryResponse = {|
  +resource: ?{|
    +$fragmentRefs: reviewThreadsAccumulator_pullRequest$ref
  |}
|};
export type reviewThreadsAccumulatorQuery = {|
  variables: reviewThreadsAccumulatorQueryVariables,
  response: reviewThreadsAccumulatorQueryResponse,
|};
*/


/*
query reviewThreadsAccumulatorQuery(
  $url: URI!
  $threadCount: Int!
  $threadCursor: String
  $commentCount: Int!
) {
  resource(url: $url) {
    __typename
    ... on PullRequest {
      ...reviewThreadsAccumulator_pullRequest_3dVVow
    }
    ... on Node {
      id
    }
  }
}

fragment reviewThreadsAccumulator_pullRequest_3dVVow on PullRequest {
  url
  reviewThreads(first: $threadCount, after: $threadCursor) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        id
        isResolved
        viewerCanResolve
        viewerCanUnresolve
        ...reviewCommentsAccumulator_reviewThread_1UlnwR
        __typename
      }
    }
  }
}

fragment reviewCommentsAccumulator_reviewThread_1UlnwR on PullRequestReviewThread {
  id
  comments(first: $commentCount) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        id
        author {
          __typename
          avatarUrl
          login
          ... on Node {
            id
          }
        }
        bodyHTML
        isMinimized
        minimizedReason
        viewerCanMinimize
        viewerCanReact
        path
        position
        createdAt
        url
        ... on Reactable {
          reactionGroups {
            content
            users {
              totalCount
            }
          }
        }
        __typename
      }
    }
  }
}
*/

const node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "kind": "LocalArgument",
    "name": "url",
    "type": "URI!",
    "defaultValue": null
  },
  {
    "kind": "LocalArgument",
    "name": "threadCount",
    "type": "Int!",
    "defaultValue": null
  },
  {
    "kind": "LocalArgument",
    "name": "threadCursor",
    "type": "String",
    "defaultValue": null
  },
  {
    "kind": "LocalArgument",
    "name": "commentCount",
    "type": "Int!",
    "defaultValue": null
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "url",
    "variableName": "url",
    "type": "URI!"
  }
],
v2 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "__typename",
  "args": null,
  "storageKey": null
},
v3 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "id",
  "args": null,
  "storageKey": null
},
v4 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "url",
  "args": null,
  "storageKey": null
},
v5 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "threadCursor",
    "type": "String"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "threadCount",
    "type": "Int"
  }
],
v6 = {
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
      "name": "hasNextPage",
      "args": null,
      "storageKey": null
    },
    {
      "kind": "ScalarField",
      "alias": null,
      "name": "endCursor",
      "args": null,
      "storageKey": null
    }
  ]
},
v7 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "cursor",
  "args": null,
  "storageKey": null
},
v8 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "commentCount",
    "type": "Int"
  }
];
return {
  "kind": "Request",
  "fragment": {
    "kind": "Fragment",
    "name": "reviewThreadsAccumulatorQuery",
    "type": "Query",
    "metadata": null,
    "argumentDefinitions": (v0/*: any*/),
    "selections": [
      {
        "kind": "LinkedField",
        "alias": null,
        "name": "resource",
        "storageKey": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "type": "PullRequest",
            "selections": [
              {
                "kind": "FragmentSpread",
                "name": "reviewThreadsAccumulator_pullRequest",
                "args": [
                  {
                    "kind": "Variable",
                    "name": "commentCount",
                    "variableName": "commentCount",
                    "type": null
                  },
                  {
                    "kind": "Variable",
                    "name": "threadCount",
                    "variableName": "threadCount",
                    "type": null
                  },
                  {
                    "kind": "Variable",
                    "name": "threadCursor",
                    "variableName": "threadCursor",
                    "type": null
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "operation": {
    "kind": "Operation",
    "name": "reviewThreadsAccumulatorQuery",
    "argumentDefinitions": (v0/*: any*/),
    "selections": [
      {
        "kind": "LinkedField",
        "alias": null,
        "name": "resource",
        "storageKey": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "type": "PullRequest",
            "selections": [
              (v4/*: any*/),
              {
                "kind": "LinkedField",
                "alias": null,
                "name": "reviewThreads",
                "storageKey": null,
                "args": (v5/*: any*/),
                "concreteType": "PullRequestReviewThreadConnection",
                "plural": false,
                "selections": [
                  (v6/*: any*/),
                  {
                    "kind": "LinkedField",
                    "alias": null,
                    "name": "edges",
                    "storageKey": null,
                    "args": null,
                    "concreteType": "PullRequestReviewThreadEdge",
                    "plural": true,
                    "selections": [
                      (v7/*: any*/),
                      {
                        "kind": "LinkedField",
                        "alias": null,
                        "name": "node",
                        "storageKey": null,
                        "args": null,
                        "concreteType": "PullRequestReviewThread",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          {
                            "kind": "ScalarField",
                            "alias": null,
                            "name": "isResolved",
                            "args": null,
                            "storageKey": null
                          },
                          {
                            "kind": "ScalarField",
                            "alias": null,
                            "name": "viewerCanResolve",
                            "args": null,
                            "storageKey": null
                          },
                          {
                            "kind": "ScalarField",
                            "alias": null,
                            "name": "viewerCanUnresolve",
                            "args": null,
                            "storageKey": null
                          },
                          {
                            "kind": "LinkedField",
                            "alias": null,
                            "name": "comments",
                            "storageKey": null,
                            "args": (v8/*: any*/),
                            "concreteType": "PullRequestReviewCommentConnection",
                            "plural": false,
                            "selections": [
                              (v6/*: any*/),
                              {
                                "kind": "LinkedField",
                                "alias": null,
                                "name": "edges",
                                "storageKey": null,
                                "args": null,
                                "concreteType": "PullRequestReviewCommentEdge",
                                "plural": true,
                                "selections": [
                                  (v7/*: any*/),
                                  {
                                    "kind": "LinkedField",
                                    "alias": null,
                                    "name": "node",
                                    "storageKey": null,
                                    "args": null,
                                    "concreteType": "PullRequestReviewComment",
                                    "plural": false,
                                    "selections": [
                                      {
                                        "kind": "ScalarField",
                                        "alias": null,
                                        "name": "viewerCanReact",
                                        "args": null,
                                        "storageKey": null
                                      },
                                      (v3/*: any*/),
                                      {
                                        "kind": "ScalarField",
                                        "alias": null,
                                        "name": "bodyHTML",
                                        "args": null,
                                        "storageKey": null
                                      },
                                      {
                                        "kind": "ScalarField",
                                        "alias": null,
                                        "name": "isMinimized",
                                        "args": null,
                                        "storageKey": null
                                      },
                                      {
                                        "kind": "ScalarField",
                                        "alias": null,
                                        "name": "minimizedReason",
                                        "args": null,
                                        "storageKey": null
                                      },
                                      {
                                        "kind": "ScalarField",
                                        "alias": null,
                                        "name": "viewerCanMinimize",
                                        "args": null,
                                        "storageKey": null
                                      },
                                      {
                                        "kind": "LinkedField",
                                        "alias": null,
                                        "name": "author",
                                        "storageKey": null,
                                        "args": null,
                                        "concreteType": null,
                                        "plural": false,
                                        "selections": [
                                          (v2/*: any*/),
                                          {
                                            "kind": "ScalarField",
                                            "alias": null,
                                            "name": "avatarUrl",
                                            "args": null,
                                            "storageKey": null
                                          },
                                          {
                                            "kind": "ScalarField",
                                            "alias": null,
                                            "name": "login",
                                            "args": null,
                                            "storageKey": null
                                          },
                                          (v3/*: any*/)
                                        ]
                                      },
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
                                      },
                                      {
                                        "kind": "ScalarField",
                                        "alias": null,
                                        "name": "createdAt",
                                        "args": null,
                                        "storageKey": null
                                      },
                                      (v4/*: any*/),
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
                                      (v2/*: any*/)
                                    ]
                                  }
                                ]
                              }
                            ]
                          },
                          {
                            "kind": "LinkedHandle",
                            "alias": null,
                            "name": "comments",
                            "args": (v8/*: any*/),
                            "handle": "connection",
                            "key": "ReviewCommentsAccumulator_comments",
                            "filters": null
                          },
                          (v2/*: any*/)
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "kind": "LinkedHandle",
                "alias": null,
                "name": "reviewThreads",
                "args": (v5/*: any*/),
                "handle": "connection",
                "key": "ReviewThreadsAccumulator_reviewThreads",
                "filters": null
              }
            ]
          }
        ]
      }
    ]
  },
  "params": {
    "operationKind": "query",
    "name": "reviewThreadsAccumulatorQuery",
    "id": null,
    "text": "query reviewThreadsAccumulatorQuery(\n  $url: URI!\n  $threadCount: Int!\n  $threadCursor: String\n  $commentCount: Int!\n) {\n  resource(url: $url) {\n    __typename\n    ... on PullRequest {\n      ...reviewThreadsAccumulator_pullRequest_3dVVow\n    }\n    ... on Node {\n      id\n    }\n  }\n}\n\nfragment reviewThreadsAccumulator_pullRequest_3dVVow on PullRequest {\n  url\n  reviewThreads(first: $threadCount, after: $threadCursor) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    edges {\n      cursor\n      node {\n        id\n        isResolved\n        viewerCanResolve\n        viewerCanUnresolve\n        ...reviewCommentsAccumulator_reviewThread_1UlnwR\n        __typename\n      }\n    }\n  }\n}\n\nfragment reviewCommentsAccumulator_reviewThread_1UlnwR on PullRequestReviewThread {\n  id\n  comments(first: $commentCount) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    edges {\n      cursor\n      node {\n        id\n        author {\n          __typename\n          avatarUrl\n          login\n          ... on Node {\n            id\n          }\n        }\n        bodyHTML\n        isMinimized\n        minimizedReason\n        viewerCanMinimize\n        viewerCanReact\n        path\n        position\n        createdAt\n        url\n        ... on Reactable {\n          reactionGroups {\n            content\n            users {\n              totalCount\n            }\n          }\n        }\n        __typename\n      }\n    }\n  }\n}\n",
    "metadata": {}
  }
};
})();
// prettier-ignore
(node/*: any*/).hash = 'e79afa42892ad508af3b22ca911cd7c5';
module.exports = node;
