/** @babel */

import {CompositeDisposable} from 'atom'

import React from 'react'

import StatusBarTileController from './status-bar-tile-controller'


const ReactStatusBarTileController = EtchReactAdapter(StatusBarTileController)

function EtchReactAdapter (EtchComponent) {
  return class EtchWrapper extends React.Component {
    componentDidMount () {
      this.component = new EtchComponent(this.props)
      this.container.appendChild(this.component.element)
    }

    componentWillReceiveProps (newProps) {
      this.component.update(newProps)
    }

    shouldComponentUpdate () {
      return false
    }

    render () {
      const {reactWrapperProps} = this.props
      const ReactWrapperType = this.props.reactWrapperType
      return <ReactWrapperType {...reactWrapperProps} ref={c => this.container = c} />
    }

    componentWillUnmount () {
      this.container.removeChild(this.component.element)
      this.component.destroy()
    }
  }
}

EtchReactAdapter.propTypes = {
  reactWrapperType: React.PropTypes.string,
  reactWrapperProps: React.PropTypes.object
}

EtchReactAdapter.defaultProps = {
  reactWrapperType: 'div'
}


class StatusBar extends React.Component {
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

StatusBar.proptTypes = {
  statusBar: React.PropTypes.object,
  legacy: React.PropTypes.bool
}


export default class GitPackageController extends React.Component {
  constructor (props, context) {
    super(props, context)

    this.subscriptions = new CompositeDisposable()

    // this.changeObserver = process.platform === 'linux'
    //   ? new WorkspaceChangeObserver(window, props.workspace)
    //   : new FileSystemChangeObserver()
  }

  render () {
    console.log('rendering')

    return (
      <div>
        <StatusBar statusBar={this.props.statusBar} legacy={this.props.legacyStatusBar}>
          <ReactStatusBarTileController
            workspace={this.props.workspace}
            repository={this.props.repository}
            toggleGitPanel={this.toggleGitPanel}
            reactWrapperType="span"
          />
        </StatusBar>
      </div>
    )
  }
}
