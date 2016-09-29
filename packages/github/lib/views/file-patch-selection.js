/** @babel */

export default class FilePatchSelection {
  constructor (hunks) {
    this.mode = 'hunk'
    this.selections = [{head: 0, tail: 0}]
    this.updateHunks(hunks)
  }

  toggleMode () {
    if (this.mode === 'hunk') {
      this.mode = 'line'
      const firstLineOfSelectedHunk = this.hunks[this.selections[0].head].lines[0]
      this.selectLine(firstLineOfSelectedHunk)
      if (!firstLineOfSelectedHunk.isChanged()) this.selectNextLine()
    } else {
      this.mode = 'hunk'
      const selectedLine = this.lines[this.selections[0].head]
      const hunkContainingSelectedLine = this.hunksByLine.get(selectedLine)
      this.selectHunk(hunkContainingSelectedLine)
    }
  }

  getMode () {
    return this.mode
  }

  selectNext (preserveTail = false) {
    if (this.mode === 'hunk') {
      this.selectNextHunk(preserveTail)
    } else {
      this.selectNextLine(preserveTail)
    }
  }

  selectPrevious (preserveTail = false) {
    if (this.mode === 'hunk') {
      this.selectPreviousHunk(preserveTail)
    } else {
      this.selectPreviousLine(preserveTail)
    }
  }

  selectNextHunk (preserveTail) {
    let nextHunkIndex = this.selections[0].head
    if (nextHunkIndex < this.hunks.length - 1) nextHunkIndex++
    this.selectHunk(this.hunks[nextHunkIndex], preserveTail)
  }

  selectPreviousHunk (preserveTail) {
    let previousHunkIndex = this.selections[0].head
    if (previousHunkIndex > 0) previousHunkIndex--
    this.selectHunk(this.hunks[previousHunkIndex], preserveTail)
  }

  selectNextLine (preserveTail = false) {
    let lineIndex = this.selections[0].head

    while (lineIndex < this.lines.length - 1) {
      lineIndex++
      if (this.lines[lineIndex].isChanged()) break
    }

    this.selectLine(this.lines[lineIndex], preserveTail)
  }

  selectPreviousLine (preserveTail = false) {
    let lineIndex = this.selections[0].head

    while (lineIndex > 0) {
      lineIndex--
      if (this.lines[lineIndex].isChanged()) break
    }

    this.selectLine(this.lines[lineIndex], preserveTail)
  }


  selectHunk (hunk, preserveTail = false) {
    this.mode = 'hunk'
    this.selectItem(this.hunks, hunk, preserveTail, false)
  }

  selectLine (line, preserveTail = false) {
    this.mode = 'line'
    this.selectItem(this.lines, line, preserveTail, false)
  }

  addHunkSelection (hunk) {
    this.mode = 'hunk'
    this.selectItem(this.hunks, hunk, false, true)
  }

  addLineSelection (line) {
    this.mode = 'line'
    this.selectItem(this.lines, line, false, true)
  }

  selectItem (items, item, preserveTail, addSelection) {
    if (addSelection && preserveTail) {
      throw new Error('addSelection and preserveTail cannot both be true at the same time')
    }

    const itemIndex = items.indexOf(item)
    if (preserveTail) {
      this.selections[0].head = itemIndex
    } else {
      const selection = {head: itemIndex, tail: itemIndex}
      if (addSelection) {
        this.selections.unshift(selection)
      } else {
        this.selections = [selection]
      }
    }
  }

  getSelectedHunks (hunk) {
    if (this.mode === 'line') {
      const selectedHunks = new Set()
      const selectedLines = this.getSelectedLines()
      selectedLines.forEach(line => selectedHunks.add(this.hunksByLine.get(line)))
      return selectedHunks
    } else {
      return this.getSelectedItems()
    }
  }

  getSelectedLines () {
    if (this.mode === 'hunk') {
      const selectedLines = new Set()
      this.getSelectedHunks().forEach(hunk => {
        for (let line of hunk.lines) {
          if (line.isChanged()) selectedLines.add(line)
        }
      })
      return selectedLines
    } else {
      return this.getSelectedItems()
    }
  }

  getSelectedItems () {
    const selectedItems = new Set()
    const items = (this.mode === 'hunk') ? this.hunks : this.lines
    for (let {head, tail} of this.selections) {
      let start = Math.min(head, tail)
      let end = Math.max(head, tail)
      for (let i = start; i <= end; i++) {
        const item = items[i]
        if (this.mode === 'hunk' || item.isChanged()) selectedItems.add(item)
      }
    }
    return selectedItems
  }

  updateHunks (hunks) {
    const oldLines = this.lines
    this.hunks = hunks
    this.lines = []
    this.hunksByLine = new Map()
    for (let hunk of hunks) {
      for (let line of hunk.lines) {
        this.lines.push(line)
        this.hunksByLine.set(line, hunk)
      }
    }

    if (this.lines.length > 0) {
      let newSelectionHeadAndTail
      if (this.mode === 'hunk') {
        newSelectionHeadAndTail = Math.min(this.hunks.length - 1, this.selections[0].head)
      } else {
        const oldSelectionHead = this.selections[0].head
        let changedLineCount = 0
        for (let i = 0; i < oldSelectionHead; i++) {
          if (oldLines[i].isChanged()) changedLineCount++
        }

        for (let i = 0; i < this.lines.length; i++) {
          if (this.lines[i].isChanged()) {
            newSelectionHeadAndTail = i
            if (changedLineCount === 0) break
            changedLineCount--
          }
        }
      }

      this.selections = [{head: newSelectionHeadAndTail, tail: newSelectionHeadAndTail}]
    } else {
      this.selections = []
    }
  }
}
