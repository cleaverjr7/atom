/** @babel */
/** @jsx etch.dom */

import etch from 'etch'

export default class PushPullMenuView {
  constructor (props) {
    this.props = props
    this.push = this.push.bind(this)
    etch.initialize(this)
  }

  update (props) {
    this.props = Object.assign({}, this.props, props)
    this.errorMessage = ''
    return etch.update(this)
  }

  render () {
    return (
      <div className='git-Panel-item'>
        <div className='git-PushPullMenuView '>
          <span className='git-PushPullMenuView-item icon icon-mark-github'/>
          <button className='git-PushPullMenuView-item btn' onclick={this.props.fetch}>Fetch</button>

          <div className='git-PushPullMenuView-item is-flexible btn-group'>
            <button ref="pullButton" className='btn' onclick={this.props.pull} disabled={this.props.pullDisabled}>
              <Tooltip active={this.props.pullDisabled} text='Commit changes before pulling' className='btn-tooltip-wrapper'>
                <span className='icon icon-arrow-down'/>
                <span ref="behindCount">Pull {this.props.behindCount !== 0 ? `(${this.props.behindCount})` : ''}</span>
              </Tooltip>
            </button>
            <button ref="pushButton" className='btn' onclick={this.push}>
              <span className='icon icon-arrow-up'/>
              <span ref="aheadCount">Push {this.props.aheadCount !== 0 ? `(${this.props.aheadCount})` : ''}</span>
            </button>
          </div>
        </div>
        <div className='git-PushPullMenuView-message' ref='message' innerHTML={this.errorMessage}></div>
      </div>
    )
  }

  async push (event) {
    try {
      await this.props.push({force: event.metaKey})
    } catch (error) {
      if (error.stdErr.match(/rejected[\s\S]*failed to push/)) {
        this.errorMessage = 'Push rejected.\nTry pulling before pushing again. Or to force push hold `cmd` while clicking'
      } else {
        this.errorMessage = error.stdErr
      }
      return etch.update(this)
    }
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
