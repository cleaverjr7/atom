/**
 * @flow
 */

/* eslint-disable */

'use strict';

/*::
import type { ReaderFragment } from 'relay-runtime';
type prCheckoutController_pullRequest$ref = any;
import type { FragmentReference } from "relay-runtime";
declare export opaque type reviewsController_pullRequest$ref: FragmentReference;
export type reviewsController_pullRequest = {|
  +id: string,
  +headRefOid: any,
  +$fragmentRefs: prCheckoutController_pullRequest$ref,
  +$refType: reviewsController_pullRequest$ref,
|};
*/


const node/*: ReaderFragment*/ = {
  "kind": "Fragment",
  "name": "reviewsController_pullRequest",
  "type": "PullRequest",
  "metadata": null,
  "argumentDefinitions": [],
  "selections": [
    {
      "kind": "ScalarField",
      "alias": null,
      "name": "id",
      "args": null,
      "storageKey": null
    },
    {
      "kind": "ScalarField",
      "alias": null,
      "name": "headRefOid",
      "args": null,
      "storageKey": null
    },
    {
      "kind": "FragmentSpread",
      "name": "prCheckoutController_pullRequest",
      "args": null
    }
  ]
};
// prettier-ignore
(node/*: any*/).hash = '55ef9e65dcef6dbf901b123d852c0ea1';
module.exports = node;
