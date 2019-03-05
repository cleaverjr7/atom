export default class IDSequence {
  constructor() {
    this.current = 0;
  }

  nextID() {
    const id = this.current;
    this.current++;
    return id;
  }
}
