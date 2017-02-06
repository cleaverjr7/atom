/** @babel */
/** @jsx etch.dom */

import etch from 'etch'

export default class ErrorView {
  constructor (packageManager, {message, stderr, packageInstallError}) {
    etch.initialize(this)

    this.isOutputHidden = true
    this.refs.detailsArea.style.display = 'none'
    this.refs.details.textContent = stderr
    this.refs.message.textContent = message

    // Check for native build tools and show warning if missing.
    if (packageInstallError && process.platform === 'win32') {
      packageManager.checkNativeBuildTools().catch(() => {
        this.refs.alert.appendChild(new CompileToolsErrorView().element)
      })
    }
  }

  update () {}

  destroy () {
    return etch.destroy(this)
  }

  render () {
    return (
      <div class='error-message'>
        <div ref='alert' class='alert alert-danger alert-dismissable native-key-bindings' tabIndex='-1'>
          <button ref='close' class='close icon icon-x' onclick={() => this.destroy()}></button>
          <span ref='message' class='native-key-bindings'></span>
          <a ref='detailsLink' class='alert-link error-link' onclick={() => this.toggleOutput()}>{'Show output\u2026'}</a>
          <div ref='detailsArea' class='padded'>
            <pre ref='details' class='error-details text'></pre>
          </div>
        </div>
      </div>
    )
  }

  toggleOutput () {
    if (this.isOutputHidden) {
      this.isOutputHidden = false
      this.refs.detailsArea.style.display = ''
      this.refs.detailsLink.textContent = 'Hide output\u2026'
    } else {
      this.isOutputHidden = true
      this.refs.detailsArea.style.display = 'none'
      this.refs.detailsLink.textContent = 'Show output\u2026'
    }
  }
}

class CompileToolsErrorView {
  constructor () {
    etch.initialize(this)
  }

  update () {}

  render () {
    return (
      <div>
        <div className='icon icon-alert compile-tools-heading compile-tools-message'>Compiler tools not found</div>
        <div className='compile-tools-message'>Packages that depend on modules that contain C/C++ code will fail to install.</div>
        <div className='compile-tools-message'>
          <span>Read </span>
          <a className='link' href='https://atom.io/docs/latest/build-instructions/windows'>here</a>
          <span> for instructions on installing Python and Visual Studio.</span>
        </div>
        <div className='compile-tools-message'>
          <span>Run </span>
          <code className='alert-danger'>apm install --check</code>
          <span> after installing to test compiling a native module.</span>
        </div>
      </div>
    )
  }
}
