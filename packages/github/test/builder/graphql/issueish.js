import {PullRequestBuilder} from './pr';
import {IssueBuilder} from './issue';

export class IssueishBuilder {
  constructor(...args) {
    this.args = args;
    this._value = null;
  }

  issue(block = () => {}) {
    const b = new IssueBuilder(...this.args);
    block(b);
    this._value = b.build();
    return this;
  }

  pullRequest(block = () => {}) {
    const b = new PullRequestBuilder(...this.args);
    block(b);
    this._value = b.build();
    return this;
  }

  build() {
    if (this._value === null) {
      this._value = new IssueBuilder(...this.args).build();
    }

    return this._value;
  }
}
