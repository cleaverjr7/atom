StatusBarView = require './status-bar-view'
FileInfoView = require './file-info-view'
CursorPositionView = require './cursor-position-view'
SelectionCountView = require './selection-count-view'
GitView = require './git-view'

module.exports =
  activate: (state = {}) ->
    state.attached ?= true
    @statusBar = new StatusBarView(state)

    atom.workspaceView.command 'status-bar:toggle', => @statusBar.toggle()

    if atom.getLoadSettings().devMode
      DevModeView = require './dev-mode-view'
      @statusBar.appendLeft(new DevModeView())

    @fileInfo = new FileInfoView(@statusBar)
    @statusBar.appendLeft(@fileInfo)

    @cursorPosition = new CursorPositionView(@statusBar)
    @statusBar.appendLeft(@cursorPosition)

    @selectionCount = new SelectionCountView()
    console.log @selectionCount
    @selectionCount.initialize(@statusBar)
    @statusBar.appendLeft(@selectionCount)

    @git = new GitView(@statusBar)
    @statusBar.appendRight(@git)

  deactivate: ->
    @git?.destroy()
    @git = null

    @fileInfo?.destroy()
    @fileInfo = null

    @cursorPosition?.destroy()
    @cursorPosition = null

    @selectionCount?.destroy()
    @selectionCount = null

    @statusBar?.destroy()
    @statusBar = null
