module.exports =
  configDefaults:
    enabled: false

  activate: (state) ->
    @migrateOldAutosaveConfig()

    rootView.on 'focusout', ".editor:not(.mini)", (event) =>
      editSession = event.targetView()?.getModel()
      @autosave(editSession)

    rootView.on 'pane:before-item-destroyed', (event, paneItem) =>
      @autosave(paneItem)

  autosave: (paneItem) ->
    paneItem?.save?() if config.get('autosave.enabled')

  migrateOldAutosaveConfig: ->
    enabled = config.get('core.autosave')
    return unless enabled?

    config.set('autosave.enabled', enabled)
    config.set('core.autosave', null)
