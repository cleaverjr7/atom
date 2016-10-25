/** @babel */

export default class ListSelection {
  constructor (options = {}) {
    if (options.isItemSelectable) this.isItemSelectable = options.isItemSelectable
    this.setItems(options.items || [])
  }

  isItemSelectable (item) {
    return true
  }

  setItems (items) {
    let newSelectionIndex
    if (this.selections && this.selections.length > 0) {
      const [{head, tail}] = this.selections
      newSelectionIndex = Math.min(head, tail, items.length - 1)
    } else {
      newSelectionIndex = 0
    }

    this.items = items
    if (items.length > 0) {
      this.selections = [{head: newSelectionIndex, tail: newSelectionIndex}]
    } else {
      this.selections = []
    }
  }

  getItems () {
    return this.items
  }

  getLastItem () {
    return this.items[this.items.length - 1]
  }

  selectFirstItem (preserveTail) {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i]
      if (this.isItemSelectable(item)) {
        this.selectItem(item, preserveTail)
        break
      }
    }
  }

  selectLastItem (preserveTail) {
    for (let i = this.items.length - 1; i > 0; i--) {
      const item = this.items[i]
      if (this.isItemSelectable(item)) {
        this.selectItem(item, preserveTail)
        break
      }
    }
  }

  selectAllItems () {
    this.selectFirstItem()
    this.selectLastItem(true)
  }

  selectNextItem (preserveTail) {
    if (this.selections.length === 0) {
      this.selectFirstItem()
      return
    }

    let itemIndex = this.selections[0].head
    let nextItemIndex = itemIndex
    while (itemIndex < this.items.length - 1) {
      itemIndex++
      if (this.isItemSelectable(this.items[itemIndex])) {
        nextItemIndex = itemIndex
        break
      }
    }

    this.selectItem(this.items[nextItemIndex], preserveTail)
  }

  selectPreviousItem (preserveTail) {
    if (this.selections.length === 0) {
      this.selectLastItem()
      return
    }

    let itemIndex = this.selections[0].head
    let previousItemIndex = itemIndex

    while (itemIndex > 0) {
      itemIndex--
      if (this.isItemSelectable(this.items[itemIndex])) {
        previousItemIndex = itemIndex
        break
      }
    }

    this.selectItem(this.items[previousItemIndex], preserveTail)
  }

  selectItem (item, preserveTail, addOrSubtract) {
    if (addOrSubtract && preserveTail) {
      throw new Error('addOrSubtract and preserveTail cannot both be true at the same time')
    }

    const itemIndex = this.items.indexOf(item)
    if (preserveTail) {
      this.selections[0].head = itemIndex
    } else {
      const selection = {head: itemIndex, tail: itemIndex}
      if (addOrSubtract) {
        if (this.getSelectedItems().has(item)) selection.negate = true
        this.selections.unshift(selection)
      } else {
        this.selections = [selection]
      }
    }
  }

  addOrSubtractSelection (item) {
    this.selectItem(item, false, true)
  }

  coalesce () {
    if (this.selections.length === 0) return

    const mostRecent = this.selections[0]
    let mostRecentStart = Math.min(mostRecent.head, mostRecent.tail)
    let mostRecentEnd = Math.max(mostRecent.head, mostRecent.tail)
    while (mostRecentStart > 0 && !this.isItemSelectable(this.items[mostRecentStart - 1])) {
      mostRecentStart--
    }
    while (mostRecentEnd < (this.items.length - 1) && !this.isItemSelectable(this.items[mostRecentEnd + 1])) {
      mostRecentEnd++
    }

    for (let i = 1; i < this.selections.length;) {
      const current = this.selections[i]
      const currentStart = Math.min(current.head, current.tail)
      const currentEnd = Math.max(current.head, current.tail)
      if (mostRecentStart <= currentEnd + 1 && currentStart - 1 <= mostRecentEnd) {
        if (mostRecent.negate) {
          const truncatedSelections = []
          if (current.head > current.tail) {
            if (currentEnd > mostRecentEnd) { // suffix
              truncatedSelections.push({tail: mostRecentEnd + 1, head: currentEnd})
            }
            if (currentStart < mostRecentStart) { // prefix
              truncatedSelections.push({tail: currentStart, head: mostRecentStart - 1})
            }
          } else {
            if (currentStart < mostRecentStart) { // prefix
              truncatedSelections.push({head: currentStart, tail: mostRecentStart - 1})
            }
            if (currentEnd > mostRecentEnd) { // suffix
              truncatedSelections.push({head: mostRecentEnd + 1, tail: currentEnd})
            }
          }
          this.selections.splice(i, 1, ...truncatedSelections)
          i += truncatedSelections.length
        } else {
          if (mostRecent.head > mostRecent.tail) {
            mostRecent.head = Math.max(mostRecentEnd, currentEnd)
            mostRecent.tail = Math.min(mostRecentStart, currentStart)
          } else {
            mostRecent.head = Math.min(mostRecentStart, currentStart)
            mostRecent.tail = Math.max(mostRecentEnd, currentEnd)
          }
          this.selections.splice(i, 1)
        }
      } else {
        i++
      }
    }

    if (mostRecent.negate) this.selections.shift()
  }

  getSelectedItems () {
    const selectedItems = new Set()
    for (let {head, tail, negate} of this.selections.slice().reverse()) {
      let start = Math.min(head, tail)
      let end = Math.max(head, tail)
      for (let i = start; i <= end; i++) {
        const item = this.items[i]
        if (this.isItemSelectable(item)) {
          if (negate) {
            selectedItems.delete(item)
          } else {
            selectedItems.add(item)
          }
        }
      }
    }
    return selectedItems
  }

  getHeadItem () {
    if (this.selections.length > 0) {
      return this.items[this.selections[0].head]
    }
  }

  getMostRecentSelectionStartIndex () {
    const selection = this.selections[0]
    return Math.min(selection.head, selection.tail)
  }
}
