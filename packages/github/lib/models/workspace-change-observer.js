/** @babel */

import {CompositeDisposable, Disposable, Emitter} from 'atom'

export default class WorkspaceChangeObserver {
  constructor (window, workspace) {
    this.window = window
    this.workspace = workspace
    this.observedBuffers = new WeakSet()
    this.emitter = new Emitter()
  }

  start () {
    const handler = () => {
      if (this.activeRepository) {
        this.emitter.emit('did-change')
      }
    }
    this.window.addEventListener('focus', handler)
    this.disposables = new CompositeDisposable()
    this.disposables.add(
      this.workspace.observeTextEditors(this.observeTextEditor.bind(this)),
      new Disposable(() => this.window.removeEventListener('focus', handler))
    )
    return Promise.resolve()
  }

  stop () {
    this.disposables.dispose()
    this.observedBuffers = new WeakSet()
    return Promise.resolve()
  }

  onDidChange (callback) {
    return this.emitter.on('did-change', callback)
  }

  setActiveRepository (repository) {
    this.activeRepository = repository
  }

  activeRepositoryContainsPath (path) {
    if (this.activeRepository) {
      return path.indexOf(this.activeRepository.getWorkingDirectoryPath()) !== -1
    } else {
      return false
    }
  }

  observeTextEditor (editor) {
    const buffer = editor.getBuffer()
    if (!this.observedBuffers.has(buffer)) {
      this.observedBuffers.add(buffer)
      const disposables = new CompositeDisposable(
        buffer.onDidSave(() => {
          if (this.activeRepositoryContainsPath(buffer.getPath())) this.emitter.emit('did-change')
        }),
        buffer.onDidReload(() => {
          if (this.activeRepositoryContainsPath(buffer.getPath())) this.emitter.emit('did-change')
        }),
        buffer.onDidDestroy(() => {
          if (this.activeRepositoryContainsPath(buffer.getPath())) this.emitter.emit('did-change')
          disposables.dispose()
        })
      )
      this.disposables.add(disposables)
    }
  }
}
