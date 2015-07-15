{ScrollView} = require 'atom-space-pen-views'
SettingsPanel = require './settings-panel'

module.exports =
class GeneralPanel extends ScrollView
  @content: ->
    @div tabindex: 0, class: 'panels-item', =>
      @form class: 'general-panel section', =>
        @div outlet: "loadingElement", class: 'alert alert-info loading-area icon icon-hourglass', "Loading settings"

  initialize: ->
    super
    @loadingElement.remove()

    @append(new SettingsPanel('core'))
    @append(new SettingsPanel('editor'))
