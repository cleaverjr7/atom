const DETACHED = Symbol('detached');
const REMOTE_TRACKING = Symbol('remote-tracking');

export default class Branch {
  constructor(name, upstream = nullBranch, push = upstream, head = false, attributes = {}) {
    this.name = name;
    this.upstream = upstream;
    this.push = push;
    this.head = head;
    this.attributes = attributes;
  }

  static createDetached(describe) {
    return new Branch(describe, nullBranch, nullBranch, false, {[DETACHED]: true});
  }

  static createRemoteTracking(refName, remoteName, remoteRef) {
    return new Branch(name, nullBranch, nullBranch, false, {[REMOTE_TRACKING]: {remoteName, remoteRef}});
  }

  getName() {
    return this.name;
  }

  getFullRef() {
    if (this.isDetached()) {
      return '';
    }

    if (this.isRemoteTracking()) {
      if (this.name.startsWith('refs/')) {
        return this.name;
      } else if (this.name.startsWith('remotes/')) {
        return `refs/${this.name}`;
      }
      return `refs/remotes/${this.name}`;
    }

    if (this.name.startsWith('refs/')) {
      return this.name;
    } else if (this.name.startsWith('heads/')) {
      return `refs/${this.name}`;
    } else {
      return `refs/heads/${this.name}`;
    }
  }

  getRemoteName() {
    if (!this.isRemoteTracking()) {
      return Symbol('not-remote-tracking');
    }
    return this.attributes[REMOTE_TRACKING].remoteName;
  }

  getRemoteRef() {
    if (!this.isRemoteTracking()) {
      return Symbol('not-remote-tracking');
    }
    return this.attributes[REMOTE_TRACKING].remoteRef;
  }

  getSha() {
    return this.attributes.sha || Symbol('no-sha');
  }

  getUpstream() {
    return this.upstream;
  }

  getPush() {
    return this.push;
  }

  isHead() {
    return this.head;
  }

  isDetached() {
    return this.attributes[DETACHED] !== undefined;
  }

  isRemoteTracking() {
    return this.attributes[REMOTE_TRACKING] !== undefined;
  }

  isPresent() {
    return true;
  }
}

export const nullBranch = {
  getName() {
    return '';
  },

  getFullRef() {
    return Symbol('null-branch-ref');
  },

  getUpstream() {
    return this;
  },

  getPush() {
    return this;
  },

  getRemoteName() {
    return Symbol('null-branch-remote-name');
  },

  getRemoteRef() {
    return Symbol('null-branch-remote-ref');
  },

  isDetached() {
    return false;
  },

  isRemoteTracking() {
    return false;
  },

  isPresent() {
    return false;
  },
};
