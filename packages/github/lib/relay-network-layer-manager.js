import {Environment, Network, RecordSource, Store} from 'relay-runtime';
import moment from 'moment';

const relayEnvironmentPerGithubHost = new Map();

function logRatelimitApi(headers) {
  const remaining = headers.get('x-ratelimit-remaining');
  const total = headers.get('x-ratelimit-limit');
  const resets = headers.get('x-ratelimit-reset');
  const resetsIn = moment.unix(parseInt(resets, 10)).from();

  // eslint-disable-next-line no-console
  console.debug(`GitHub API Rate Limit: ${remaining}/${total} — resets ${resetsIn}`);
}

const responsesByQuery = new Map();

export function expectRelayQuery(operationPattern, response) {
  let resolve, reject;
  const promise = new Promise((resolve0, reject0) => {
    resolve = () => resolve0({data: response});
    reject = reject0;
  });

  responsesByQuery.set(operationPattern.name, {promise, response, variables: operationPattern.variables || {}});

  return {promise, resolve, reject};
}

export function clearRelayExpectations() {
  responsesByQuery.clear();
}

const tokenPerURL = new Map();
const fetchPerURL = new Map();

function createFetchQuery(url) {
  if (atom.inSpecMode()) {
    return function specFetchQuery(operation, variables, cacheConfig, uploadables) {
      const expectation = responsesByQuery.get(operation.name);
      if (!expectation) {
        // eslint-disable-next-line no-console
        console.log(`GraphQL query ${operation.name} was:\n  ${operation.text.replace(/\n/g, '\n  ')}`);

        const e = new Error(`Unexpected GraphQL query: ${operation.name}`);
        e.rawStack = e.stack;
        throw e;
      }
      return expectation.promise;
    };
  }

  return function fetchQuery(operation, variables, cacheConfig, uploadables) {
    const currentToken = tokenPerURL.get(url);

    return fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Authorization': `bearer ${currentToken}`,
        'Accept': 'application/vnd.github.graphql-profiling+json',
      },
      body: JSON.stringify({
        query: operation.text,
        variables,
      }),
    }).then(response => {
      try {
        atom && atom.inDevMode() && logRatelimitApi(response.headers);
      } catch (_e) { /* do nothing */ }

      return response.json();
    });
  };
}

export default class RelayNetworkLayerManager {
  static getEnvironmentForHost(host, token) {
    host = host === 'github.com' ? 'https://api.github.com' : host;
    const url = host === 'https://api.github.com' ? `${host}/graphql` : `${host}/api/v3/graphql`;
    let {environment, network} = relayEnvironmentPerGithubHost.get(host) || {};
    tokenPerURL.set(url, token);
    if (!environment) {
      const source = new RecordSource();
      const store = new Store(source);
      network = Network.create(this.getExistingFetchQuery(url));
      environment = new Environment({network, store});

      relayEnvironmentPerGithubHost.set(host, {environment, network});
    }
    return environment;
  }

  static getExistingFetchQuery(url) {
    if (!tokenPerURL.has(url)) {
      return null;
    }

    let fetch = fetchPerURL.get(url);
    if (!fetch) {
      fetch = createFetchQuery(url);
      fetchPerURL.set(fetch);
    }
    return fetch;
  }
}
