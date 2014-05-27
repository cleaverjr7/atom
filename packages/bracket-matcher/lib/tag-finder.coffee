{Range} = require 'atom'
{ScopeSelector} = require 'first-mate'

# Helper to find the closing tag for an opening tag in XML, HTML, etc.
# editors.
module.exports =
class TagFinder
  constructor: (@editorView) ->
    {@editor} = @editorView

    @tagSelector = new ScopeSelector('entity.name.tag')

  getTagName: ->
    wordRange = @editor.getCursor().getCurrentWordBufferRange()
    tagName = @editor.getTextInRange(wordRange)
    tagName.replace(/[<>/]/g, '').trim()

  getTagStartPosition: ->
    position = @editor.getCursorBufferPosition()
    tagStartPosition = null
    @editor.backwardsScanInBufferRange /<\/?/, [[0, 0], position], ({match, range, stop}) ->
      tagStartPosition = range.translate([0, match[0].length]).start
      stop()
    tagStartPosition

  findStartingTag: ->
    tagName = @getTagName()
    startingPattern = new RegExp("<#{tagName}[\s>]", 'gi')
    scanRange = new Range([0, 0], @editor.getCursorBufferPosition())
    startingTagRange = null
    @editor.backwardsScanInBufferRange startingPattern, scanRange, ({match, range, stop}) ->
      startingTagRange = range.translate([0, 1])
      stop()

    if startingTagRange?
      {startPosition: startingTagRange.start, endPosition: @getTagStartPosition()}

  findClosingTag: ->
    tagName = @getTagName()
    closingPattern = new RegExp("</#{tagName}>", 'gi')
    scanRange = new Range(@editor.getCursorBufferPosition(), @editor.buffer.getEndPosition())
    closingTagRange = null
    @editor.scanInBufferRange closingPattern, scanRange, ({match, range, stop}) ->
      closingTagRange = range.translate([0, 2])
      stop()

    if closingTagRange?
      {startPosition: @getTagStartPosition(), endPosition: closingTagRange.start}

  findPair: ->
    return unless @tagSelector.matches(@editor.getCursorScopes())

    positions = null
    @editor.backwardsScanInBufferRange /<\/?/, [[0, 0], @editor.getCursorBufferPosition()], ({match, range, stop}) =>
      stop()
      if match[0].length is 2
        positions = @findStartingTag()
      else
        positions = @findClosingTag()
    positions
