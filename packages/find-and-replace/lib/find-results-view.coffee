_ = require 'underscore'
{View} = require 'space-pen'
Selection = require 'selection'
MarkerView = require './marker-view'

module.exports =
class FindResultsView extends View

  @content: ->
    @div class: 'search-results'

  initialize: (@findModel) ->
    @markerViews = []
    @findModel.on 'markers-updated', @markersUpdated

  attach: ->
    @getEditor().underlayer.append(this)

  detach: ->
    super

  getEditor: ->
    rootView.getActiveView()

  markersUpdated: (@markers) =>
    @destroyMarkerViews()

    editor = @getEditor()
    for marker in @markers
      markerView = new MarkerView({editor, marker})
      @markerViews.push(markerView)
      @append(markerView)

  destroyMarkerViews: ->
    @empty()
    @markerViews = []
