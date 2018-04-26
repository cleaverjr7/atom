import React from 'react';
import PropTypes from 'prop-types';
import {autobind} from 'core-decorators';
import {inspect} from 'util';

import ObserveModel from '../views/observe-model';

const sortOrders = {
  'by key': (a, b) => a.key.localeCompare(b.key),
  'oldest first': (a, b) => b.age - a.age,
  'newest first': (a, b) => a.age - b.age,
  'most hits': (a, b) => b.hits - a.hits,
  'fewest hits': (a, b) => a.hits - b.hits,
};

export default class GitCacheView extends React.Component {
  static propTypes = {
    repository: PropTypes.object.isRequired,
  }

  constructor(props, context) {
    super(props, context);

    this.state = {
      order: 'by key',
    };
  }

  getURI() {
    return 'atom-github://debug/cache';
  }

  getTitle() {
    return 'GitHub Package Cache View';
  }

  serialize() {
    return null;
  }

  @autobind
  fetchRepositoryData(repository) {
    return repository.getCache();
  }

  @autobind
  fetchCacheData(cache) {
    const cached = {};
    const promises = [];
    const now = performance.now();

    for (const [key, value] of cache) {
      cached[key] = {
        hits: value.hits,
        age: now - value.createdAt,
      };

      promises.push(
        value.promise
          .then(
            payload => inspect(payload, {breakLength: 50}),
            err => `${err.message}\n${err.stack}`,
          )
          .then(resolved => { cached[key].value = resolved; }),
      );
    }

    return Promise.all(promises).then(() => cached);
  }

  render() {
    return (
      <ObserveModel model={this.props.repository} fetchData={this.fetchRepositoryData}>
        {cache => (
          <ObserveModel model={cache} fetchData={this.fetchCacheData}>
            {this.renderCache}
          </ObserveModel>
        )}
      </ObserveModel>
    );
  }

  @autobind
  renderCache(contents) {
    const rows = Object.keys(contents || {}).map(key => {
      return {
        key,
        age: contents[key].age,
        hits: contents[key].hits,
        content: contents[key].value,
      };
    });

    rows.sort(sortOrders[this.state.order]);

    const orders = Object.keys(sortOrders);

    return (
      <div className="github-CacheView">
        <header>
          <h1>Cache contents</h1>
          <p>
            <span className="badge">{rows.length}</span> cached items
          </p>
        </header>
        <main>
          <p>
            sort
            <select
              className="input-select"
              onChange={this.didSelectItem}
              value={this.state.order}>
              {orders.map(order => {
                return <option key={order} value={order}>{order}</option>;
              })}
            </select>
          </p>
          <table>
            <thead>
              <tr>
                <td className="github-CacheView-Key">key</td>
                <td className="github-CacheView-Age">age</td>
                <td className="github-CacheView-Hits">hits</td>
                <td className="github-CacheView-Content">content</td>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key} className="github-CacheView-Row">
                  <td className="github-CacheView-Key">
                    <code>{row.key}</code>
                  </td>
                  <td className="github-CacheView-Age">
                    {this.formatAge(row.age)}
                  </td>
                  <td className="github-CacheView-Hits">
                    {row.hits}
                  </td>
                  <td className="github-CacheView-Content">
                    {row.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      </div>
    );
  }

  formatAge(ageMs) {
    let remaining = ageMs;
    const parts = [];

    if (remaining > 3600000) {
      const hours = Math.floor(remaining / 3600000);
      parts.push(`${hours}h`);
      remaining -= (3600000 * hours);
    }

    if (remaining > 60000) {
      const minutes = Math.floor(remaining / 60000);
      parts.push(`${minutes}m`);
      remaining -= (60000 * minutes);
    }

    if (remaining > 1000) {
      const seconds = Math.floor(remaining / 1000);
      parts.push(`${seconds}s`);
      remaining -= (1000 * seconds);
    }

    parts.push(`${Math.floor(remaining)}ms`);

    return parts.slice(parts.length - 2).join(' ');
  }

  @autobind
  didSelectItem(event) {
    this.setState({order: event.target.value});
  }
}
