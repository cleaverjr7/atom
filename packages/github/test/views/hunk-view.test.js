/** @babel */

import sinon from 'sinon'
import etch from 'etch'

import Hunk from '../../lib/models/hunk'
import HunkLine from '../../lib/models/hunk-line'
import HunkView from '../../lib/views/hunk-view'

describe('HunkView', () => {
  it('renders the hunk header and its lines', async () => {
    const hunk1 = new Hunk(5, 5, 2, 1, [
      new HunkLine('line-1', 'unchanged', 5, 5),
      new HunkLine('line-2', 'removed', 6, -1),
      new HunkLine('line-3', 'removed', 7, -1),
      new HunkLine('line-4', 'added', -1, 6)
    ])
    const view = new HunkView({hunk: hunk1, selectedLines: new Set})
    const element = view.element
    var [line1, line2, line3, line4] = Array.from(element.querySelectorAll('.git-HunkView-line'))

    assert.equal(view.refs.header.textContent, hunk1.getHeader())
    assertHunkLineElementEqual(
      line1,
      {oldLineNumber: '5', newLineNumber: '5', origin: ' ', content: 'line-1', isSelected: false}
    )
    assertHunkLineElementEqual(
      line2,
      {oldLineNumber: '6', newLineNumber: ' ', origin: '-', content: 'line-2', isSelected: false}
    )
    assertHunkLineElementEqual(
      line3,
      {oldLineNumber: '7', newLineNumber: ' ', origin: '-', content: 'line-3', isSelected: false}
    )
    assertHunkLineElementEqual(
      line4,
      {oldLineNumber: ' ', newLineNumber: '6', origin: '+', content: 'line-4', isSelected: false}
    )

    const hunk2 = new Hunk(8, 8, 1, 1, [
      new HunkLine('line-1', 'removed', 8, -1),
      new HunkLine('line-2', 'added', -1, 8)
    ])
    var [line1, line2] = Array.from(element.querySelectorAll('.git-HunkView-line'))

    await view.update({hunk: hunk2, selectedLines: new Set})

    assert.equal(view.refs.header.textContent, hunk2.getHeader())
    assertHunkLineElementEqual(
      line1,
      {oldLineNumber: '8', newLineNumber: ' ', origin: '-', content: 'line-1', isSelected: false}
    )
    assertHunkLineElementEqual(
      line2,
      {oldLineNumber: ' ', newLineNumber: '8', origin: '+', content: 'line-2', isSelected: false}
    )

    await view.update({hunk: hunk2, selectedLines: new Set([hunk2.getLines()[1]])})
    assertHunkLineElementEqual(
      line1,
      {oldLineNumber: '8', newLineNumber: ' ', origin: '-', content: 'line-1', isSelected: false}
    )
    assertHunkLineElementEqual(
      line2,
      {oldLineNumber: ' ', newLineNumber: '8', origin: '+', content: 'line-2', isSelected: true}
    )
  })

  it('adds the is-selected class based on the isSelected property', async () => {
    const hunk = new Hunk(5, 5, 2, 1, [])
    const view = new HunkView({hunk, selectedLines: new Set, isSelected: true})
    assert(view.element.classList.contains('is-selected'))

    await view.update({hunk: hunk, selectedLines: new Set, isSelected: false})
    assert(!view.element.classList.contains('is-selected'))
  })

  it('updates the button label based on the number of selected lines', async () => {
    const hunk = new Hunk(5, 5, 2, 1, [
      new HunkLine('line-1', 'unchanged', 5, 5),
      new HunkLine('line-2', 'removed', 6, -1)
    ])
    const view = new HunkView({hunk, selectedLines: new Set, stageButtonLabelPrefix: 'Stage'})
    assert.equal(view.refs.stageButton.textContent, 'Stage Hunk')

    await view.update({hunk, stageButtonLabelPrefix: 'Stage', selectedLines: new Set([hunk.getLines()[0]])})
    assert.equal(view.refs.stageButton.textContent, 'Stage Line')

    await view.update({hunk, stageButtonLabelPrefix: 'Stage', selectedLines: new Set(hunk.getLines())})
    assert.equal(view.refs.stageButton.textContent, 'Stage Lines')
  })

  it('calls the didClickStageButton handler when the staging button is clicked', async () => {
    const hunk = new Hunk(5, 5, 2, 1, [new HunkLine('line-1', 'unchanged', 5, 5)])
    const didClickStageButton1 = sinon.spy()
    const view = new HunkView({hunk, selectedLines: new Set, didClickStageButton: didClickStageButton1})
    view.refs.stageButton.dispatchEvent(new MouseEvent('click'))
    assert(didClickStageButton1.calledOnce)

    const didClickStageButton2 = sinon.spy()
    await view.update({didClickStageButton: didClickStageButton2, hunk, selectedLines: new Set})
    view.refs.stageButton.dispatchEvent(new MouseEvent('click'))
    assert(didClickStageButton2.calledOnce)
  })

  it('calls the didSelectLines handler when lines are selected with the mouse', async () => {
    const hunk = new Hunk(1234, 1234, 1234, 1234, [
      new HunkLine('line-1', 'added', 1234, 1234),
      new HunkLine('line-2', 'added', 1234, 1234),
      new HunkLine('line-3', 'added', 1234, 1234),
      new HunkLine('line-4', 'unchanged', 1234, 1234),
      new HunkLine('line-5', 'removed', 1234, 1234),
      new HunkLine('line-6', 'removed', 1234, 1234)
    ])

    const didSelectLines1 = sinon.spy()
    const view = new HunkView({hunk, selectedLines: new Set, didSelectLines: didSelectLines1})
    const element = view.element
    const [line1, line2, line3, line4, line5, line6] = Array.from(element.querySelectorAll('.git-HunkView-line'))

    // clicking lines
    line5.dispatchEvent(new MouseEvent('mousedown'))
    line5.dispatchEvent(new MouseEvent('mouseup'))
    assert.deepEqual(Array.from(didSelectLines1.args[0][0]), hunk.getLines().slice(4, 5))

    didSelectLines1.reset()
    line1.dispatchEvent(new MouseEvent('mousedown'))
    line1.dispatchEvent(new MouseEvent('mouseup'))
    assert.deepEqual(Array.from(didSelectLines1.args[0][0]), hunk.getLines().slice(0, 1))

    // ensure updating the view with a different didSelectLines handler works
    const didSelectLines2 = sinon.spy()
    await view.update({hunk, selectedLines: new Set, didSelectLines: didSelectLines2})

    // start dragging
    line2.dispatchEvent(new MouseEvent('mousedown'))
    assert.deepEqual(Array.from(didSelectLines2.args[0][0]), hunk.getLines().slice(1, 2))
    // dragging the mouse within the same line is idempotent
    didSelectLines2.reset()
    line2.dispatchEvent(new MouseEvent('mousemove'))
    assert.deepEqual(Array.from(didSelectLines2.args[0][0]), hunk.getLines().slice(1, 2))
    // dragging the mouse to the next adjacent lines selects them
    didSelectLines2.reset()
    line3.dispatchEvent(new MouseEvent('mousemove'))
    assert.deepEqual(Array.from(didSelectLines2.args[0][0]), hunk.getLines().slice(1, 3))
    didSelectLines2.reset()
    line6.dispatchEvent(new MouseEvent('mousemove'))
    assert.deepEqual(Array.from(didSelectLines2.args[0][0]), hunk.getLines().slice(1, 6))
    // dragging the mouse to a line before the first selected one selects the adjacent lines in the middle
    didSelectLines2.reset()
    line1.dispatchEvent(new MouseEvent('mousemove'))
    assert.deepEqual(Array.from(didSelectLines2.args[0][0]), hunk.getLines().slice(0, 2))
    // stop dragging (outside the view)
    didSelectLines2.reset()
    window.dispatchEvent(new MouseEvent('mouseup'))
    line2.dispatchEvent(new MouseEvent('mousemove'))
    assert(!didSelectLines2.called)
  })

  function assertHunkLineElementEqual (lineElement, {oldLineNumber, newLineNumber, origin, content, isSelected}) {
    assert.equal(lineElement.querySelector('.git-HunkView-lineNumber.is-old').textContent, oldLineNumber)
    assert.equal(lineElement.querySelector('.git-HunkView-lineNumber.is-new').textContent, newLineNumber)
    assert.equal(lineElement.querySelector('.git-HunkView-lineContent').textContent, origin + content)
    assert.equal(lineElement.classList.contains('is-selected'), isSelected)
  }
})
