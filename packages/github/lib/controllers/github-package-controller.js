/** @babel */

import {CompositeDisposable} from 'atom'

import React from 'react'

import StatusBarTileController from './status-bar-tile-controller'


/**
 * `EtchWrapper` is a React component that renders Etch components
 * and correctly manages their lifecycles as the application progresses.
 *
 *    <EtchWrapper type="span" className="wrapper">
 *      <EtchComponent etchProp={stuff} />
 *    </EtchWrapper>
 *
 * The `type` property specifies the DOM node type to wrap around the
 * Etch component's element, and defaults to 'div'. Any other props you
 * pass to the wrapper component will be applied to the DOM node.
 *
 * The component takes a single JSX child, which describes the type and props
 * of the Etch component to render. Any time this changes, the wrapper will
 * update (or destroy and recreate) the Etch component as necessary.
 *
 * Note that the component cleans up its own DOM node, and calls
 * `component.destroy(false)` (if your component has a `destroy` method)
 * and you should pass the `false` as the second argument to
 * `etch.destroy(this)` (e.g. `etch.destroy(this, false)`) inside your
 * component instance.
 */
class EtchWrapper extends React.Component {
  static propTypes = {
    children: React.PropTypes.element.isRequired,
    type: React.PropTypes.string,
  }

  static defaultProps = {
    type: 'div',
  }

  componentDidMount () {
    this.createComponent(this.getWrappedComponentDetails(this.props.children))
  }

  componentWillReceiveProps (newProps) {
    const oldDetails = this.getWrappedComponentDetails(this.props.children)
    const newDetails = this.getWrappedComponentDetails(newProps.children)
    if (oldDetails.type !== newDetails.type) {
      // The wrapped component type changed, so we need to destroy the old
      // component and create a new one of the new type.
      this.destroyComponent()
      this.createComponent(newDetails)
    }
  }

  componentDidUpdate (prevProps) {
    const oldDetails = this.getWrappedComponentDetails(prevProps.children)
    const newDetails = this.getWrappedComponentDetails(this.props.children)

    if (oldDetails.type === newDetails.type) {
      // We didn't change the wrapped (Etch) component type,
      // so we need to update the instance with the new props.
      this.updateComponent(this.getWrappedComponentDetails(this.props.children))
    }

    // If we just recreated our DOM node by changing the node type, we
    // need to reattach the wrapped component's element.
    if (!this.container.contains(this.component.element)) {
      this.container.appendChild(this.component.element)
    }
  }

  render () {
    const Type = this.props.type
    const {type, thing, children, ...props} = this.props
    return <Type {...props} ref={c => this.container = c}><span>{thing}</span></Type>
  }

  componentWillUnmount () {
    this.destroyComponent()
  }

  getWrappedComponentDetails (ourChildren) {
    // e.g. <EtchWrapper><EtchChild prop={1} other={2}>Hi</EtchChild></EtchWrapper>
    const etchElement = React.Children.toArray(ourChildren)[0]
    // etchElement === {type: EtchChild, props: {prop: 1, other: 2, children: 'Hi'}}
    const {type, props} = etchElement
    // type === EtchChild, props === {prop: 1, other: 2, children: 'Hi'}
    const {children, ...remainingProps} = props
    // children === 'Hi', remainingProps === {prop: 1, other: 2}
    return {type, children, props: remainingProps}
  }

  // Etch component interactions

  createComponent ({type, props, children}) {
    this.component = new type(props, children)
    this.container.appendChild(this.component.element)
  }

  updateComponent ({props, children}) {
    this.component.update(props, children)
  }

  destroyComponent () {
    if (this.container.contains(this.component.element)) {
      this.container.removeChild(this.component.element)
    }
    this.component.destroy && this.component.destroy(false)
    delete this.component
  }
}


class StatusBar extends React.Component {
  static propTypes = {
    statusBar: React.PropTypes.object,
    legacy: React.PropTypes.bool
  }

  componentDidMount () {
    this.consumeStatusBar(this.props)
  }

  componentDidUpdate () {
    this.consumeStatusBar(this.props)
  }

  render () {
    return <div ref={c => this.container = c}>{this.props.children}</div>
  }

  consumeStatusBar (props) {
    if (this.tile) return
    if (!props.statusBar) return

    if (!props.legacy) {
      props.statusBar.disableGitInfoTile()
    }
    const componentElement = this.container.children[0]
    this.tile = props.statusBar.addRightTile({item: componentElement, priority: -50})
  }
}


export default class GithubPackageController extends React.Component {
  constructor (props, context) {
    super(props, context)

    this.subscriptions = new CompositeDisposable()

    // this.changeObserver = process.platform === 'linux'
    //   ? new WorkspaceChangeObserver(window, props.workspace)
    //   : new FileSystemChangeObserver()
  }

  render () {
    return (
      <div>
        <StatusBar statusBar={this.props.statusBar} legacy={this.props.legacyStatusBar}>
          <EtchWrapper type="span">
            <StatusBarTileController
              workspace={this.props.workspace}
              repository={this.props.repository}
              toggleGitPanel={this.toggleGitPanel}
            />
          </EtchWrapper>
        </StatusBar>
      </div>
    )
  }
}
