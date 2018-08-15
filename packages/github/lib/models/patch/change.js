class Change {
  constructor(range) {
    this.range = range;
  }

  getRange() {
    return this.range;
  }

  isAddition() {
    return false;
  }

  isDeletion() {
    return false;
  }

  isNoNewline() {
    return false;
  }

  when(callbacks) {
    const callback = callbacks[this.constructor.name.toLowerCase()] || callbacks.default || (() => undefined);
    return callback();
  }

  toStringIn(buffer) {
    return this.range.toStringIn(buffer, this.constructor.origin);
  }
}

export class Addition extends Change {
  static origin = '+';

  isAddition() {
    return true;
  }

  invert() {
    return new Deletion(this.getRange());
  }
}

export class Deletion extends Change {
  static origin = '-';

  isDeletion() {
    return true;
  }

  invert() {
    return new Addition(this.getRange());
  }
}

export class NoNewline extends Change {
  static origin = '\\';

  isNoNewline() {
    return true;
  }

  invert() {
    return this;
  }
}
