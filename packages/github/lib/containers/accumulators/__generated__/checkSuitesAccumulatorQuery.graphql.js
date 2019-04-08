/**
 * @flow
 * @relayHash 32c6c3d4bcb394cddec576c20f929fa1
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest } from 'relay-runtime';
type checkSuitesAccumulator_commit$ref = any;
export type checkSuitesAccumulatorQueryVariables = {|
  id: string,
  checkSuiteCount: number,
  checkSuiteCursor?: ?string,
  checkRunCount: number,
|};
export type checkSuitesAccumulatorQueryResponse = {|
  +node: ?{|
    +$fragmentRefs: checkSuitesAccumulator_commit$ref
  |}
|};
export type checkSuitesAccumulatorQuery = {|
  variables: checkSuitesAccumulatorQueryVariables,
  response: checkSuitesAccumulatorQueryResponse,
|};
*/


/*
query checkSuitesAccumulatorQuery(
  $id: ID!
  $checkSuiteCount: Int!
  $checkSuiteCursor: String
  $checkRunCount: Int!
) {
  node(id: $id) {
    __typename
    ... on Commit {
      ...checkSuitesAccumulator_commit_4ncEVO
    }
    id
  }
}

fragment checkSuitesAccumulator_commit_4ncEVO on Commit {
  id
  checkSuites(first: $checkSuiteCount, after: $checkSuiteCursor) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        id
        ...checkRunsAccumulator_checkSuite_2YXw6r
        __typename
      }
    }
  }
}

fragment checkRunsAccumulator_checkSuite_2YXw6r on CheckSuite {
  id
  checkRuns(first: $checkRunCount) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        id
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
    "name": "id",
    "type": "ID!",
    "defaultValue": null
  },
  {
    "kind": "LocalArgument",
    "name": "checkSuiteCount",
    "type": "Int!",
    "defaultValue": null
  },
  {
    "kind": "LocalArgument",
    "name": "checkSuiteCursor",
    "type": "String",
    "defaultValue": null
  },
  {
    "kind": "LocalArgument",
    "name": "checkRunCount",
    "type": "Int!",
    "defaultValue": null
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id",
    "type": "ID!"
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
v4 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "checkSuiteCursor",
    "type": "String"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "checkSuiteCount",
    "type": "Int"
  }
],
v5 = {
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
v6 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "cursor",
  "args": null,
  "storageKey": null
},
v7 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "checkRunCount",
    "type": "Int"
  }
];
return {
  "kind": "Request",
  "fragment": {
    "kind": "Fragment",
    "name": "checkSuitesAccumulatorQuery",
    "type": "Query",
    "metadata": null,
    "argumentDefinitions": (v0/*: any*/),
    "selections": [
      {
        "kind": "LinkedField",
        "alias": null,
        "name": "node",
        "storageKey": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "type": "Commit",
            "selections": [
              {
                "kind": "FragmentSpread",
                "name": "checkSuitesAccumulator_commit",
                "args": [
                  {
                    "kind": "Variable",
                    "name": "checkRunCount",
                    "variableName": "checkRunCount",
                    "type": null
                  },
                  {
                    "kind": "Variable",
                    "name": "checkSuiteCount",
                    "variableName": "checkSuiteCount",
                    "type": null
                  },
                  {
                    "kind": "Variable",
                    "name": "checkSuiteCursor",
                    "variableName": "checkSuiteCursor",
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
    "name": "checkSuitesAccumulatorQuery",
    "argumentDefinitions": (v0/*: any*/),
    "selections": [
      {
        "kind": "LinkedField",
        "alias": null,
        "name": "node",
        "storageKey": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "type": "Commit",
            "selections": [
              {
                "kind": "LinkedField",
                "alias": null,
                "name": "checkSuites",
                "storageKey": null,
                "args": (v4/*: any*/),
                "concreteType": "CheckSuiteConnection",
                "plural": false,
                "selections": [
                  (v5/*: any*/),
                  {
                    "kind": "LinkedField",
                    "alias": null,
                    "name": "edges",
                    "storageKey": null,
                    "args": null,
                    "concreteType": "CheckSuiteEdge",
                    "plural": true,
                    "selections": [
                      (v6/*: any*/),
                      {
                        "kind": "LinkedField",
                        "alias": null,
                        "name": "node",
                        "storageKey": null,
                        "args": null,
                        "concreteType": "CheckSuite",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          {
                            "kind": "LinkedField",
                            "alias": null,
                            "name": "checkRuns",
                            "storageKey": null,
                            "args": (v7/*: any*/),
                            "concreteType": "CheckRunConnection",
                            "plural": false,
                            "selections": [
                              (v5/*: any*/),
                              {
                                "kind": "LinkedField",
                                "alias": null,
                                "name": "edges",
                                "storageKey": null,
                                "args": null,
                                "concreteType": "CheckRunEdge",
                                "plural": true,
                                "selections": [
                                  (v6/*: any*/),
                                  {
                                    "kind": "LinkedField",
                                    "alias": null,
                                    "name": "node",
                                    "storageKey": null,
                                    "args": null,
                                    "concreteType": "CheckRun",
                                    "plural": false,
                                    "selections": [
                                      (v3/*: any*/),
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
                            "name": "checkRuns",
                            "args": (v7/*: any*/),
                            "handle": "connection",
                            "key": "CheckRunsAccumulator_checkRuns",
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
                "name": "checkSuites",
                "args": (v4/*: any*/),
                "handle": "connection",
                "key": "CheckSuiteAccumulator_checkSuites",
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
    "name": "checkSuitesAccumulatorQuery",
    "id": null,
    "text": "query checkSuitesAccumulatorQuery(\n  $id: ID!\n  $checkSuiteCount: Int!\n  $checkSuiteCursor: String\n  $checkRunCount: Int!\n) {\n  node(id: $id) {\n    __typename\n    ... on Commit {\n      ...checkSuitesAccumulator_commit_4ncEVO\n    }\n    id\n  }\n}\n\nfragment checkSuitesAccumulator_commit_4ncEVO on Commit {\n  id\n  checkSuites(first: $checkSuiteCount, after: $checkSuiteCursor) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    edges {\n      cursor\n      node {\n        id\n        ...checkRunsAccumulator_checkSuite_2YXw6r\n        __typename\n      }\n    }\n  }\n}\n\nfragment checkRunsAccumulator_checkSuite_2YXw6r on CheckSuite {\n  id\n  checkRuns(first: $checkRunCount) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    edges {\n      cursor\n      node {\n        id\n        __typename\n      }\n    }\n  }\n}\n",
    "metadata": {}
  }
};
})();
// prettier-ignore
(node/*: any*/).hash = 'b27827b6adb558a64ae6da715a8e438e';
module.exports = node;
