/** @babel */

import etch from 'etch'

import FilePatchView from '../../lib/views/file-patch-view'
import Hunk from '../../lib/models/hunk'
import HunkLine from '../../lib/models/hunk-line'

describe('FilePatchView', () => {
  it('allows lines of a hunk to be selected, clearing the selection on the other hunks', async () => {
    const hunk1 = new Hunk(5, 5, 2, 1, [
      new HunkLine('line-1', 'unchanged', 5, 5),
      new HunkLine('line-2', 'removed', 6, -1),
      new HunkLine('line-3', 'removed', 7, -1),
      new HunkLine('line-4', 'added', -1, 6)
    ])
    const hunk2 = new Hunk(8, 8, 1, 1, [
      new HunkLine('line-5', 'removed', 8, -1),
      new HunkLine('line-6', 'added', -1, 8)
    ])
    const hunkViewsByHunk = new Map()
    const view = new FilePatchView({hunks: [hunk1, hunk2], registerHunkView: (hunk, view) => hunkViewsByHunk.set(hunk, view)})

    let linesToSelect = hunk1.getLines().slice(1, 3)
    hunkViewsByHunk.get(hunk1).props.selectLines(new Set(linesToSelect))
    await etch.getScheduler().getNextUpdatePromise()
    assert.deepEqual(Array.from(hunkViewsByHunk.get(hunk1).props.selectedLines), hunk1.getLines().filter(l => l.isChanged()))
    assert.deepEqual(Array.from(hunkViewsByHunk.get(hunk2).props.selectedLines), [])
    assert(hunkViewsByHunk.get(hunk1).props.isSelected)
    assert(!hunkViewsByHunk.get(hunk2).props.isSelected)

    await view.togglePatchSelectionMode()
    linesToSelect = hunk1.getLines().slice(1, 3)
    hunkViewsByHunk.get(hunk1).props.selectLines(new Set(linesToSelect))
    await etch.getScheduler().getNextUpdatePromise()
    assert.deepEqual(Array.from(hunkViewsByHunk.get(hunk1).props.selectedLines), linesToSelect)
    assert.deepEqual(Array.from(hunkViewsByHunk.get(hunk2).props.selectedLines), [])
    assert(hunkViewsByHunk.get(hunk1).props.isSelected)
    assert(!hunkViewsByHunk.get(hunk2).props.isSelected)

    linesToSelect = hunk2.getLines().slice(0, 1)
    hunkViewsByHunk.get(hunk2).props.selectLines(new Set(linesToSelect))
    await etch.getScheduler().getNextUpdatePromise()
    assert.deepEqual(Array.from(hunkViewsByHunk.get(hunk1).props.selectedLines), [])
    assert.deepEqual(Array.from(hunkViewsByHunk.get(hunk2).props.selectedLines), linesToSelect)
    assert(!hunkViewsByHunk.get(hunk1).props.isSelected)
    assert(hunkViewsByHunk.get(hunk2).props.isSelected)
  })

  it('assigns the appropriate stage button label prefix on hunks based on the stagingStatus', () => {
    const hunk = new Hunk(1, 1, 1, 2, [new HunkLine('line-1', 'added', -1, 1)])
    let hunkView
    function registerHunkView (hunk, view) { hunkView = view }
    const view = new FilePatchView({hunks: [hunk], stagingStatus: 'unstaged', registerHunkView})
    assert(hunkView.props.stageButtonLabelPrefix, 'Stage')
    view.update({hunks: [hunk], stagingStatus: 'staged'})
    assert(hunkView.props.stageButtonLabelPrefix, 'Unstage')
  })

  describe('hunk focus when hunk disappears', () => {
    describe('when there is another hunk at it\'s index', () => {
      it('selects the new hunk in it\'s place', async () => {
        const hunk1 = new Hunk(5, 5, 2, 1, [new HunkLine('line-1', 'added', -1, 5)])
        const hunk2 = new Hunk(8, 8, 1, 1, [new HunkLine('line-5', 'removed', 8, -1)])

        const hunkViewsByHunk = new Map()
        const view = new FilePatchView({hunks: [hunk1, hunk2], registerHunkView: (hunk, view) => hunkViewsByHunk.set(hunk, view)})

        assert(hunkViewsByHunk.get(hunk1).props.isSelected)
        hunkViewsByHunk.clear()
        await view.update({hunks: [hunk2], registerHunkView: (hunk, view) => hunkViewsByHunk.set(hunk, view)})
        assert(!hunkViewsByHunk.get(hunk1))
        assert(hunkViewsByHunk.get(hunk2).props.isSelected)
      })
    })

    describe('when there is no hunk at it\'s index', () => {
      it('selects the last hunk', async () => {
        const hunk1 = new Hunk(5, 5, 2, 1, [new HunkLine('line-1', 'added', -1, 5)])
        const hunk2 = new Hunk(8, 8, 1, 1, [new HunkLine('line-5', 'removed', 8, -1)])

        const hunkViewsByHunk = new Map()
        const view = new FilePatchView({hunks: [hunk1, hunk2], registerHunkView: (hunk, view) => hunkViewsByHunk.set(hunk, view)})

        await view.focusNextHunk()
        assert(hunkViewsByHunk.get(hunk2).props.isSelected)

        hunkViewsByHunk.clear()
        await view.update({hunks: [hunk1], registerHunkView: (hunk, view) => hunkViewsByHunk.set(hunk, view)})
        assert(!hunkViewsByHunk.get(hunk2))
        assert(hunkViewsByHunk.get(hunk1).props.isSelected)
      })
    })
  })

  describe('togglePatchSelectionMode()', () => {
    it('toggles between hunk and hunk-line selection modes', async () => {
      const hunk = new Hunk(5, 5, 2, 1, [
        new HunkLine('line-1', 'unchanged', 5, 5),
        new HunkLine('line-2', 'removed', 6, -1),
        new HunkLine('line-3', 'removed', 7, -1),
        new HunkLine('line-4', 'added', -1, 6)
      ])
      const hunkViewsByHunk = new Map()
      const view = new FilePatchView({hunks: [hunk], registerHunkView: (hunk, view) => hunkViewsByHunk.set(hunk, view)})
      const element = view.element

      assert.equal(view.getPatchSelectionMode(), 'hunk')

      await view.togglePatchSelectionMode()
      assert.equal(view.getPatchSelectionMode(), 'hunkLine')
      assert.equal(element.querySelectorAll('.git-HunkView-line.is-selected').length, 1)

      await view.togglePatchSelectionMode()
      assert.equal(view.getPatchSelectionMode(), 'hunk')
      assert.equal(element.querySelectorAll('.git-HunkView-line.is-selected').length, hunk.getLines().filter(l => l.isChanged()).length)
    })
  })

  describe('focusNextHunk({wrap}) and focusPreviousHunk({wrap})', () => {
    it('focuses next/previous hunk, and wraps at the end/beginning if wrap is true', async () => {
      const hunk1 = new Hunk(5, 5, 2, 1, [new HunkLine('line-1', 'added', -1, 5)])
      const hunk2 = new Hunk(8, 8, 1, 1, [new HunkLine('line-5', 'removed', 8, -1)])
      const hunk3 = new Hunk(8, 8, 1, 1, [new HunkLine('line-10', 'added', -1, 10)])
      const hunkViewsByHunk = new Map()
      const view = new FilePatchView({hunks: [hunk1, hunk2, hunk3], registerHunkView: (hunk, view) => hunkViewsByHunk.set(hunk, view)})

      assert.isTrue(hunkViewsByHunk.get(hunk1).props.isSelected)

      await view.focusNextHunk()
      assert.isTrue(hunkViewsByHunk.get(hunk2).props.isSelected)

      await view.focusNextHunk()
      assert.isTrue(hunkViewsByHunk.get(hunk3).props.isSelected)

      await view.focusNextHunk()
      assert.isTrue(hunkViewsByHunk.get(hunk3).props.isSelected)

      await view.focusNextHunk({wrap: true})
      assert.isTrue(hunkViewsByHunk.get(hunk1).props.isSelected)

      await view.focusPreviousHunk()
      assert.isTrue(hunkViewsByHunk.get(hunk1).props.isSelected)

      await view.focusPreviousHunk({wrap: true})
      assert.isTrue(hunkViewsByHunk.get(hunk3).props.isSelected)

      await view.focusPreviousHunk()
      assert.isTrue(hunkViewsByHunk.get(hunk2).props.isSelected)

      await view.focusPreviousHunk()
      assert.isTrue(hunkViewsByHunk.get(hunk1).props.isSelected)
    })
  })

  describe('focusNextHunkLine() and focusPreviousHunkLine()', () => {
    it('focuses next/previous non-context hunk line, crossing hunk boundaries but not wrapping', async () => {
      const line1 = new HunkLine('line-1', 'unchanged', 5, 5) // context lines won't be selected
      const line2 = new HunkLine('line-2', 'removed', 6, -1)
      const line3 = new HunkLine('line-3', 'removed', 7, -1)

      const line4 = new HunkLine('line-4', 'unchanged', 8, 8) // context lines won't be selected
      const line5 = new HunkLine('line-5', 'added', -1, 9)
      const line6 = new HunkLine('line-6', 'unchanged', 9, 10) // context lines won't be selected

      const hunk1 = new Hunk(5, 5, 2, 0, [line1, line2, line3])
      const hunk2 = new Hunk(8, 8, 1, 2, [line4, line5, line6])
      const hunkViewsByHunk = new Map()
      const view = new FilePatchView({hunks: [hunk1, hunk2], registerHunkView: (hunk, view) => hunkViewsByHunk.set(hunk, view)})

      view.togglePatchSelectionMode()

      assert.isTrue(hunkViewsByHunk.get(hunk1).props.isSelected)
      assertSelectedLines(view, [line2])

      await view.focusNextHunkLine()
      assertSelectedLines(view, [line3])

      await view.focusNextHunkLine()
      assertSelectedLines(view, [line5])

      await view.focusNextHunkLine()
      assertSelectedLines(view, [line5])

      await view.focusPreviousHunkLine()
      assertSelectedLines(view, [line3])

      await view.focusPreviousHunkLine()
      assertSelectedLines(view, [line2])

      await view.focusPreviousHunkLine()
      assertSelectedLines(view, [line2])
    })
  })
})

function assertSelectedLines (view, lines) {
  assert.deepEqual([...view.getSelectedLines()], lines)
}
