import Relay from 'react-relay';

export default class PrInfoByNumberRoute extends Relay.Route {
  static routeName = 'pr-info-by-number-route'

  static queries = {
    query: (Component, variables) => Relay.QL`
      query {
        relay {
          ${Component.getFragment('query', variables)}
        }
      }
    `,
  }

  static paramDefinitions = {
    repoOwner: {required: true},
    repoName: {required: true},
    prNumber: {required: true},
  }
}
