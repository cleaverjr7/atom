_ = require 'underscore'
{View} = require 'space-pen'
Selection = require 'selection'
MarkerView = require './marker-view'
SearchResultsModel = require './search-results-model'

# Will be one of these created per editor.
module.exports =
class SearchResultsView extends View

  @content: ->
    @div class: 'search-results'

  # options - 
  #   editor: an Atom Editor!
  initialize: (@searchModel, @editor) ->
    @model = new SearchResultsModel(@searchModel, @editor)
    @model.on 'change:markers', @onChangeMarkers

    @searchModel.on 'activate', => @show()
    @searchModel.on 'deactivate', => @hide()

    @hide()

  onChangeMarkers: ({markers}) =>
    @createMarkerViews(markers)

  createMarkerViews: (markers) ->
    searchResults = (new MarkerView({@editor, marker}) for marker in markers)
    @append(result) for result in searchResults
