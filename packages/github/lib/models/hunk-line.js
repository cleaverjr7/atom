/** @babel */

export default class HunkLine {
  constructor (text, status, oldLineNumber, newLineNumber) {
    this.text = text
    this.status = status
    this.oldLineNumber = oldLineNumber
    this.newLineNumber = newLineNumber
  }

  copy ({text, status, oldLineNumber, newLineNumber}={}) {
    return new HunkLine(
      text || this.getText(),
      status || this.getStatus(),
      oldLineNumber || this.getOldLineNumber(),
      newLineNumber || this.getNewLineNumber()
    )
  }

  getText () {
    return this.text
  }

  getOldLineNumber () {
    return this.oldLineNumber
  }

  getNewLineNumber () {
    return this.newLineNumber
  }

  getStatus () {
    return this.status
  }

  getOrigin () {
    switch (this.getStatus()) {
      case 'added':
        return '+'
        break
      case 'removed':
        return '-'
        break
      case 'unchanged':
        return ' '
        break
      default:
        return ''
        break
    }
  }

  invert () {
    let invertedStatus
    switch (this.getStatus()) {
      case 'added':
        invertedStatus = 'removed'
        break
      case 'removed':
        invertedStatus = 'added'
        break
      case 'unchanged':
        invertedStatus = 'unchanged'
        break
    }

    return new HunkLine(
      this.text,
      invertedStatus,
      this.newLineNumber,
      this.oldLineNumber
    )
  }

  toString () {
    return this.getOrigin() + this.getText()
  }
}
