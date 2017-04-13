import State from './state';

export default class Loading extends State {
  async start() {
    if (await this.git().isGitRepository()) {
      const history = await this.loadHistoryPayload();
      this.transitionTo('Present', history);
    } else {
      this.transitionTo('Empty');
    }
  }

  isLoading() {
    return true;
  }

  async init() {
    await this.getLoadPromise();
    await this.repository.init();
  }

  async clone(remoteUrl) {
    await this.getLoadPromise();
    await this.repository.clone(remoteUrl);
  }

  destroy() {
    this.transitionTo('Destroyed');
  }
}

State.register(Loading);
