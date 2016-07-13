/** @babel */
/** @jsx etch.dom */

import etch from 'etch'

export default class PushPullView {
  constructor (props) {
    this.props = props
    etch.initialize(this)
  }

  update (props) {
    this.props = props
    return etch.update(this)
  }

  render () {
    return (
      <div className='git-Panel-item'>
        <div className='git-PushPull '>
          <span className='git-PushPull-item icon icon-mark-github'/>
          <button className='git-PushPull-item btn' onclick={this.props.fetch}>Fetch</button>

          <div className='git-PushPull-item is-flexible btn-group'>
            <button className='btn' onclick={this.props.pull} disabled={this.props.pullDisabled}>
              <Tooltip active={this.props.pullDisabled} text='Commit changes before props.pulling' className='btn-wrapper'>
                <span className='icon icon-arrow-down'/>
                Pull {this.props.behindCount !== 0 ? `(${this.props.behindCount})` : ''}
              </Tooltip>
            </button>
            <button className='btn' onclick={this.props.push}>
              <span className='icon icon-arrow-up'/>
              Push {this.props.aheadCount !== 0 ? `(${this.props.aheadCount})` : ''}
            </button>
          </div>
        </div>
      </div>
    )
  }
}

class Tooltip {
  constructor ({active, text, ...otherProps}, children) {
    this.active = active
    this.text = text
    this.children = children
    this.otherProps = otherProps
    this.handleMouseOut = this.handleMouseOut.bind(this)
    this.handleMouseOver = this.handleMouseOver.bind(this)
    etch.initialize(this)
  }

  update ({active, text, ...otherProps}, children) {
    this.active = active
    this.text = text
    this.children = children
    this.otherProps = otherProps
    return etch.update(this)
  }

  handleMouseOut () {
    if (this.tooltipDisposable) {
      this.tooltipDisposable.dispose()
      this.tooltipDisposable = null
    }
  }

  handleMouseOver () {
    if (this.active && !this.tooltipDisposable) {
      const element = this.element
      this.tooltipDisposable = atom.tooltips.add(element, {title: this.text, trigger: 'manual'})
    }
  }

  render () {
    return <div {...this.otherProps} onmouseover={this.handleMouseOver} onmouseout={this.handleMouseOut}>{this.children}</div>
  }

  destroy () {
    this.tooltipDisposable && this.tooltipDisposable.dispose()
    etch.destroy(this)
  }
}
