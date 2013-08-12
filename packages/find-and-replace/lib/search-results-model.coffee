EventEmitter = require 'event-emitter'
AtomRange = require 'range'
_ = require 'underscore'

# Will be one of these per editor. We will swap the buffers in and out as the
# user opens/closes buffers.
#
# TODO/FIXME - This thing hooks the current buffer's contents-modified event.
# It will run the search and keep the markers in memory even when the find box
# is not open. This can be fixed by hooking the searchModel's 'show:results'
# and 'hide:results' events and unbinding from the buffer. But then the find-
# next (cmd+g) behavior becomes a different code path. To keep things simple
# for now, I'm going to leave it this way. If it's slow, we can implement the
# optimization.
module.exports =
class SearchResultsModel
  _.extend @prototype, EventEmitter

  # options - 
  #   regex: false
  #   caseSensitive: false
  #   inWord: false
  #   inSelection: false
  constructor: (@searchModel, @editor) ->
    @markers = []
    @currentResultIndex = null
    @searchModel.on 'change', @search
    @searchModel.setResultsForId(@editor.id, this)

    @editor.on 'editor:path-changed', @onPathChanged
    @editor.on 'editor:will-be-removed', @destroy
    @onPathChanged()

  search: =>
    @destroyMarkers()
    @markers = @findAndMarkRanges()
    @trigger 'change:markers', markers: @markers

  setBuffer: (buffer) ->
    @unbindBuffer(buffer)
    @bindBuffer(@buffer = buffer)
    @search()

  getCurrentResult: ->
    @generateCurrentResult()

  findNext: (initialBufferRange) ->
    if @markers and @markers.length
      for i in [0...@markers.length]
        marker = @markers[i]
        return @setCurrentResultIndex(i) if marker.getBufferRange().compare(initialBufferRange) > 0

    @findFirstValid()

  findPrevious: (initialBufferRange) ->
    initialBufferRange = AtomRange.fromObject(initialBufferRange)

    if @markers and @markers.length
      for i in [@markers.length-1..0]
        marker = @markers[i]
        range = marker.getBufferRange()
        return @setCurrentResultIndex(i) if range.compare(initialBufferRange) < 0 and not range.intersectsWith(initialBufferRange)

    @findLastValid()

  findFirstValid: ->
    @setCurrentResultIndex(if @markers.length then 0 else null)

  findLastValid: ->
    @setCurrentResultIndex(if @markers.length then @markers.length-1 else null)

  replaceCurrentResultAndFindNext: (replacement, currentBufferRange) ->
    if @currentResultIndex?
      bufferRange = @markers[@currentResultIndex].getBufferRange()
    else
      bufferRange = @findNext(currentBufferRange).range

    @buffer.change(bufferRange, replacement)
    @findNext(bufferRange)

  replaceAll: (replacement) ->

  destroy: =>
    @searchModel.off 'change', @search
    @searchModel.deleteResultsForId(@editor.id)
    @editor = null
    @searchModel = null

  ### Event Handlers ###

  onPathChanged: =>
    @setBuffer(@editor.activeEditSession.buffer)

  onBufferContentsModified: =>
    return unless @searchModel.regex

    isEqualToRange = (marker, range) ->
      # Using marker.getBufferRange().compare() was slow on large sets. This is faster.
      first = marker.bufferMarker.tailPosition or marker.bufferMarker.headPosition
      last = marker.bufferMarker.headPosition
      return false unless range.start.column == first.column and range.start.row == first.row
      return false unless range.end.column == last.column and range.end.row == last.row
      true

    rangesToAdd = []

    ranges = @findRanges()
    for range in ranges
      matchingMarker = null
      for marker in @markers
        matchingMarker = marker if isEqualToRange(marker, range)

      rangesToAdd.push(range) unless matchingMarker

    @addMarkers(rangesToAdd) if rangesToAdd.length

  onMarkerDestroyed: (marker) ->
    @markers = _.without(@markers, marker)
  onMarkerChanged: (marker, {valid}) ->
    @destroyMarker(marker) unless valid

  ### Internal ###

  setCurrentResultIndex: (index) ->
    return @generateCurrentResult() if @currentResultIndex == index
    @currentResultIndex = index
    @emitCurrentResult()

  emitCurrentResult: ->
    result = @generateCurrentResult()
    @trigger 'change:current-result', result
    result

  generateCurrentResult: ->
    if @currentResultIndex?
      marker = @markers[@currentResultIndex]
      {
        index: @currentResultIndex
        range: marker.getBufferRange()
        marker: marker
        total: @markers.length
      }
    else 
      { total: @markers.length }

  bindBuffer: (buffer) ->
    return unless buffer
    buffer.on 'contents-modified', @onBufferContentsModified
  unbindBuffer: (buffer) ->
    return unless buffer
    buffer.off 'contents-modified', @onBufferContentsModified

  addMarkers: (rangesToAdd) ->
    markerAttributes = @getMarkerAttributes()

    markers = (@createMarker(range, markerAttributes) for range in rangesToAdd)

    @markers = @markers.concat(markers)
    @markers.sort (left, right) -> left.getBufferRange().compare(right.getBufferRange())

    @trigger 'add:markers', markers: markers
    @emitCurrentResult()

  findAndMarkRanges: ->
    markerAttributes = @getMarkerAttributes()
    (@createMarker(range, markerAttributes) for range in @findRanges())

  findRanges: ->
    return [] unless @searchModel.regex

    options = @searchModel.options #TODO: handle inSelection option

    ranges = []
    @buffer.scanInRange @searchModel.regex, @buffer.getRange(), ({range}) ->
      ranges.push(range)
    ranges

  destroyMarkers: ->
    @destroyMarker(marker) for marker in @markers
    @setCurrentResultIndex(null)

  destroyMarker: (marker) ->
    marker.destroy()

  createMarker: (range, markerAttributes) ->
    marker = @editor.activeEditSession.markBufferRange(range, markerAttributes)
    marker.on 'changed', _.bind(@onMarkerChanged, this, marker)
    marker.on 'destroyed', _.bind(@onMarkerDestroyed, this, marker)
    marker

  getMarkerAttributes: (attributes={}) ->
    _.extend attributes, 
      class: 'search-result'
      displayBufferId: @editor.activeEditSession.displayBuffer.id
      invalidationStrategy: 'between'
