{$} = require 'atom'

module.exports =
  configDefaults:
    enabled: false

  activate: ->
    atom.workspaceView.on 'focusout', ".editor:not(.mini)", (event) =>
      editor = event.targetView()?.getModel()
      @autosave(editor)

    atom.workspaceView.on 'pane:before-item-destroyed', (event, paneItem) =>
      @autosave(paneItem)

    $(window).preempt 'beforeunload', =>
      for pane in atom.workspaceView.getPanes()
        @autosave(paneItem) for paneItem in pane.getItems()

  autosave: (paneItem) ->
    if atom.config.get('autosave.enabled') and paneItem?.getUri?()?
      paneItem?.save?()
