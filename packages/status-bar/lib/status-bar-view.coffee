{_, $, $$, View} = require 'atom'

module.exports =
class StatusBarView extends View
  @content: ->
    @div class: 'status-bar tool-panel panel-bottom', =>
      @div outlet: 'rightPanel', class: 'status-bar-right pull-right'
      @div outlet: 'leftPanel', class: 'status-bar-left'

  initialize: ->
    @bufferSubscriptions = []
    @subscribe rootView, 'pane-container:active-pane-item-changed', =>
      @unsubscribeAllFromBuffer()
      @buffer = @getActiveItem()?.getBuffer?()
      @subscribeAllToBuffer()

      @trigger('active-buffer-changed')

  attach: ->
    rootView.vertical.append(this) unless @hasParent()

  appendLeft: (item) ->
    @leftPanel.append(item)

  appendRight: (item) ->
    @rightPanel.append(item)

  getActiveBuffer: ->
    @buffer

  getActiveItem: ->
    atom.rootView.getActivePaneItem()

  subscribeToBuffer: (event, callback) ->
    @bufferSubscriptions.push([event, callback])
    @buffer.on(event, callback) if @buffer

  subscribeAllToBuffer: ->
    return unless @buffer
    for [event, callback] in @bufferSubscriptions
      @buffer.on(event, callback)

  unsubscribeAllFromBuffer: ->
    return unless @buffer
    for [event, callback] in @bufferSubscriptions
      @buffer.off(event, callback)
