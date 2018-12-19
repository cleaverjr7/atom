/**
 * @flow
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteFragment } from 'relay-runtime';
type issueDetailView_issue$ref = any;
type issueDetailView_repository$ref = any;
type prDetailView_pullRequest$ref = any;
type prDetailView_repository$ref = any;
import type { FragmentReference } from "relay-runtime";
declare export opaque type issueishDetailController_repository$ref: FragmentReference;
export type issueishDetailController_repository = {|
  +name: string,
  +owner: {|
    +login: string
  |},
  +issue: ?({|
    +__typename: "Issue",
    +title: string,
    +number: number,
    +$fragmentRefs: issueDetailView_issue$ref,
  |} | {|
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    +__typename: "%other"
  |}),
  +pullRequest: ?({|
    +__typename: "PullRequest",
    +title: string,
    +number: number,
    +headRefName: string,
    +headRepository: ?{|
      +name: string,
      +owner: {|
        +login: string
      |},
      +url: any,
      +sshUrl: any,
    |},
    +$fragmentRefs: prDetailView_pullRequest$ref,
  |} | {|
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    +__typename: "%other"
  |}),
  +$fragmentRefs: issueDetailView_repository$ref & prDetailView_repository$ref,
  +$refType: issueishDetailController_repository$ref,
|};
*/


const node/*: ConcreteFragment*/ = (function(){
var v0 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "name",
  "args": null,
  "storageKey": null
},
v1 = {
  "kind": "LinkedField",
  "alias": null,
  "name": "owner",
  "storageKey": null,
  "args": null,
  "concreteType": null,
  "plural": false,
  "selections": [
    {
      "kind": "ScalarField",
      "alias": null,
      "name": "login",
      "args": null,
      "storageKey": null
    }
  ]
},
v2 = [
  {
    "kind": "Variable",
    "name": "number",
    "variableName": "issueishNumber",
    "type": "Int!"
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
  "name": "title",
  "args": null,
  "storageKey": null
},
v5 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "number",
  "args": null,
  "storageKey": null
},
v6 = {
  "kind": "Variable",
  "name": "commitCount",
  "variableName": "commitCount",
  "type": null
},
v7 = {
  "kind": "Variable",
  "name": "commitCursor",
  "variableName": "commitCursor",
  "type": null
},
v8 = {
  "kind": "Variable",
  "name": "timelineCount",
  "variableName": "timelineCount",
  "type": null
},
v9 = {
  "kind": "Variable",
  "name": "timelineCursor",
  "variableName": "timelineCursor",
  "type": null
};
return {
  "kind": "Fragment",
  "name": "issueishDetailController_repository",
  "type": "Repository",
  "metadata": null,
  "argumentDefinitions": [
    {
      "kind": "LocalArgument",
      "name": "issueishNumber",
      "type": "Int!",
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
    },
    {
      "kind": "LocalArgument",
      "name": "commitCount",
      "type": "Int!",
      "defaultValue": null
    },
    {
      "kind": "LocalArgument",
      "name": "commitCursor",
      "type": "String",
      "defaultValue": null
    },
    {
      "kind": "LocalArgument",
      "name": "commentCount",
      "type": "Int!",
      "defaultValue": null
    },
    {
      "kind": "LocalArgument",
      "name": "commentCursor",
      "type": "String",
      "defaultValue": null
    }
  ],
  "selections": [
    {
      "kind": "FragmentSpread",
      "name": "issueDetailView_repository",
      "args": null
    },
    {
      "kind": "FragmentSpread",
      "name": "prDetailView_repository",
      "args": null
    },
    v0,
    v1,
    {
      "kind": "LinkedField",
      "alias": "issue",
      "name": "issueOrPullRequest",
      "storageKey": null,
      "args": v2,
      "concreteType": null,
      "plural": false,
      "selections": [
        v3,
        {
          "kind": "InlineFragment",
          "type": "Issue",
          "selections": [
            v4,
            v5,
            {
              "kind": "FragmentSpread",
              "name": "issueDetailView_issue",
              "args": [
                v6,
                v7,
                v8,
                v9
              ]
            }
          ]
        }
      ]
    },
    {
      "kind": "LinkedField",
      "alias": "pullRequest",
      "name": "issueOrPullRequest",
      "storageKey": null,
      "args": v2,
      "concreteType": null,
      "plural": false,
      "selections": [
        v3,
        {
          "kind": "InlineFragment",
          "type": "PullRequest",
          "selections": [
            v4,
            v5,
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
              "name": "headRepository",
              "storageKey": null,
              "args": null,
              "concreteType": "Repository",
              "plural": false,
              "selections": [
                v0,
                v1,
                {
                  "kind": "ScalarField",
                  "alias": null,
                  "name": "url",
                  "args": null,
                  "storageKey": null
                },
                {
                  "kind": "ScalarField",
                  "alias": null,
                  "name": "sshUrl",
                  "args": null,
                  "storageKey": null
                }
              ]
            },
            {
              "kind": "FragmentSpread",
              "name": "prDetailView_pullRequest",
              "args": [
                {
                  "kind": "Variable",
                  "name": "commentCount",
                  "variableName": "commentCount",
                  "type": null
                },
                {
                  "kind": "Variable",
                  "name": "commentCursor",
                  "variableName": "commentCursor",
                  "type": null
                },
                v6,
                v7,
                v8,
                v9
              ]
            }
          ]
        }
      ]
    }
  ]
};
})();
// prettier-ignore
(node/*: any*/).hash = '0a288c1ab2398af40de27baf5db2aacb';
module.exports = node;
