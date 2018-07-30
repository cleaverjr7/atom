/**
 * @flow
 * @relayHash ec7add21f4125e294e4679a0fed3dfc9
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest } from 'relay-runtime';
type issueishTooltipContainer_resource$ref = any;
export type issueishTooltipItemQueryVariables = {|
  issueishUrl: any
|};
export type issueishTooltipItemQueryResponse = {|
  +resource: ?{|
    +$fragmentRefs: issueishTooltipContainer_resource$ref
  |}
|};
export type issueishTooltipItemQuery = {|
  variables: issueishTooltipItemQueryVariables,
  response: issueishTooltipItemQueryResponse,
|};
*/


/*
query issueishTooltipItemQuery(
  $issueishUrl: URI!
) {
  resource(url: $issueishUrl) {
    __typename
    ...issueishTooltipContainer_resource
    ... on Node {
      id
    }
  }
}

fragment issueishTooltipContainer_resource on UniformResourceLocatable {
  __typename
  ... on Issue {
    state
    number
    title
    repository {
      name
      owner {
        __typename
        login
        id
      }
      id
    }
    author {
      __typename
      login
      avatarUrl
      ... on Node {
        id
      }
    }
  }
  ... on PullRequest {
    state
    number
    title
    repository {
      name
      owner {
        __typename
        login
        id
      }
      id
    }
    author {
      __typename
      login
      avatarUrl
      ... on Node {
        id
      }
    }
  }
}
*/

const node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "kind": "LocalArgument",
    "name": "issueishUrl",
    "type": "URI!",
    "defaultValue": null
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "url",
    "variableName": "issueishUrl",
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
  "name": "login",
  "args": null,
  "storageKey": null
},
v5 = [
  {
    "kind": "ScalarField",
    "alias": null,
    "name": "state",
    "args": null,
    "storageKey": null
  },
  {
    "kind": "ScalarField",
    "alias": null,
    "name": "number",
    "args": null,
    "storageKey": null
  },
  {
    "kind": "ScalarField",
    "alias": null,
    "name": "title",
    "args": null,
    "storageKey": null
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
      {
        "kind": "ScalarField",
        "alias": null,
        "name": "name",
        "args": null,
        "storageKey": null
      },
      {
        "kind": "LinkedField",
        "alias": null,
        "name": "owner",
        "storageKey": null,
        "args": null,
        "concreteType": null,
        "plural": false,
        "selections": [
          v2,
          v4,
          v3
        ]
      },
      v3
    ]
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
      v2,
      v4,
      {
        "kind": "ScalarField",
        "alias": null,
        "name": "avatarUrl",
        "args": null,
        "storageKey": null
      },
      v3
    ]
  }
];
return {
  "kind": "Request",
  "operationKind": "query",
  "name": "issueishTooltipItemQuery",
  "id": null,
  "text": "query issueishTooltipItemQuery(\n  $issueishUrl: URI!\n) {\n  resource(url: $issueishUrl) {\n    __typename\n    ...issueishTooltipContainer_resource\n    ... on Node {\n      id\n    }\n  }\n}\n\nfragment issueishTooltipContainer_resource on UniformResourceLocatable {\n  __typename\n  ... on Issue {\n    state\n    number\n    title\n    repository {\n      name\n      owner {\n        __typename\n        login\n        id\n      }\n      id\n    }\n    author {\n      __typename\n      login\n      avatarUrl\n      ... on Node {\n        id\n      }\n    }\n  }\n  ... on PullRequest {\n    state\n    number\n    title\n    repository {\n      name\n      owner {\n        __typename\n        login\n        id\n      }\n      id\n    }\n    author {\n      __typename\n      login\n      avatarUrl\n      ... on Node {\n        id\n      }\n    }\n  }\n}\n",
  "metadata": {},
  "fragment": {
    "kind": "Fragment",
    "name": "issueishTooltipItemQuery",
    "type": "Query",
    "metadata": null,
    "argumentDefinitions": v0,
    "selections": [
      {
        "kind": "LinkedField",
        "alias": null,
        "name": "resource",
        "storageKey": null,
        "args": v1,
        "concreteType": null,
        "plural": false,
        "selections": [
          {
            "kind": "FragmentSpread",
            "name": "issueishTooltipContainer_resource",
            "args": null
          }
        ]
      }
    ]
  },
  "operation": {
    "kind": "Operation",
    "name": "issueishTooltipItemQuery",
    "argumentDefinitions": v0,
    "selections": [
      {
        "kind": "LinkedField",
        "alias": null,
        "name": "resource",
        "storageKey": null,
        "args": v1,
        "concreteType": null,
        "plural": false,
        "selections": [
          v2,
          v3,
          {
            "kind": "InlineFragment",
            "type": "PullRequest",
            "selections": v5
          },
          {
            "kind": "InlineFragment",
            "type": "Issue",
            "selections": v5
          }
        ]
      }
    ]
  }
};
})();
// prettier-ignore
(node/*: any*/).hash = '8e6b32b5cdcdd3debccc7adaa2b4e82c';
module.exports = node;
