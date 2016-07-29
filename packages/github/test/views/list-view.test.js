/** @babel */
/** @jsx etch.dom */

import etch from 'etch'
import sinon from 'sinon'
import simulant from 'simulant'

import ListView from '../../lib/views/list-view'

describe('ListView', () => {
  it('renders a list of items', () => {
    const items = [ 'one', 'two', 'three' ]

    const renderItem = (item, selected) => {
      return <div className={selected ? 'selected' : ''}>{item}</div>
    }

    const didSelectItem = sinon.spy()

    const didConfirmItem = sinon.spy()

    const component = new ListView({
      didSelectItem: didSelectItem,
      didConfirmItem: didConfirmItem,
      items: items,
      renderItem: renderItem
    })

    assert.equal(component.element.children.length, 3)
    assert.equal(component.element.children[0].textContent, 'one')
    assert.isTrue(component.element.children[0].classList.contains('selected'))
    assert.equal(component.element.children[1].textContent, 'two')
    assert.equal(component.element.children[2].textContent, 'three')

    assert.isFalse(didSelectItem.called)
    simulant.fire(component.element.children[0], 'click', {detail: 1})
    assert.isTrue(didSelectItem.calledWith('one'))

    assert.isFalse(didConfirmItem.called)
    simulant.fire(component.element.children[2], 'click', {detail: 2})
    assert.isTrue(didConfirmItem.calledWith('three'))
  })
})
