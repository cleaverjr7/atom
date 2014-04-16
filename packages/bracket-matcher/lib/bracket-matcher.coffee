_ = require 'underscore-plus'

module.exports =
class BracketMatcher
  pairedCharacters:
    '(': ')'
    '[': ']'
    '{': '}'
    '"': '"'
    "'": "'"

  constructor: (@editor) ->
    @bracketMarkers = []
    _.adviseBefore(@editor, 'insertText', @insertText)
    _.adviseBefore(@editor, 'insertNewline', @insertNewline)
    _.adviseBefore(@editor, 'backspace', @backspace)

  insertText: (text, options) =>
    return true if options?.select or options?.undo is 'skip'
    return false if @isOpeningBracket(text) and @wrapSelectionInBrackets(text)
    return true if @editor.hasMultipleCursors()

    cursorBufferPosition = @editor.getCursorBufferPosition()
    previousCharacter = @editor.getTextInBufferRange([cursorBufferPosition.add([0, -1]), cursorBufferPosition])
    nextCharacter = @editor.getTextInBufferRange([cursorBufferPosition, cursorBufferPosition.add([0,1])])

    hasWordAfterCursor = /\w/.test(nextCharacter)
    hasWordBeforeCursor = /\w/.test(previousCharacter)
    hasQuoteBeforeCursor = previousCharacter is text[0]

    autoCompleteOpeningBracket = @isOpeningBracket(text) and not hasWordAfterCursor and not (@isQuote(text) and (hasWordBeforeCursor or hasQuoteBeforeCursor))
    skipOverExistingClosingBracket = false
    if @isClosingBracket(text) and nextCharacter == text
      if bracketMarker = _.find(@bracketMarkers, (marker) => marker.isValid() and marker.getBufferRange().end.isEqual(cursorBufferPosition))
        skipOverExistingClosingBracket = true

    if skipOverExistingClosingBracket
      bracketMarker.destroy()
      _.remove(@bracketMarkers, bracketMarker)
      @editor.moveCursorRight()
      false
    else if autoCompleteOpeningBracket
      @editor.insertText(text + @pairedCharacters[text])
      @editor.moveCursorLeft()
      range = [cursorBufferPosition, cursorBufferPosition.add([0, text.length])]
      @bracketMarkers.push @editor.markBufferRange(range)
      false

  insertNewline: =>
    return if @editor.hasMultipleCursors()
    return unless @editor.getSelection().isEmpty()

    cursorBufferPosition = @editor.getCursorBufferPosition()
    previousCharacter = @editor.getTextInBufferRange([cursorBufferPosition.add([0, -1]), cursorBufferPosition])
    nextCharacter = @editor.getTextInBufferRange([cursorBufferPosition, cursorBufferPosition.add([0,1])])
    if @pairedCharacters[previousCharacter] is nextCharacter
      @editor.transact =>
        @editor.insertText "\n\n"
        @editor.moveCursorUp()
        cursorRow = @editor.getCursorBufferPosition().row
        @editor.autoIndentBufferRows(cursorRow, cursorRow + 1)
      false

  backspace: =>
    return if @editor.hasMultipleCursors()
    return unless @editor.getSelection().isEmpty()

    cursorBufferPosition = @editor.getCursorBufferPosition()
    previousCharacter = @editor.getTextInBufferRange([cursorBufferPosition.add([0, -1]), cursorBufferPosition])
    nextCharacter = @editor.getTextInBufferRange([cursorBufferPosition, cursorBufferPosition.add([0,1])])
    if @pairedCharacters[previousCharacter] is nextCharacter
      @editor.transact =>
        @editor.moveCursorLeft()
        @editor.delete()
        @editor.delete()
      false

  wrapSelectionInBrackets: (bracket) ->
    pair = @pairedCharacters[bracket]
    selectionWrapped = false
    @editor.mutateSelectedText (selection) ->
      return if selection.isEmpty()

      selectionWrapped = true
      range = selection.getBufferRange()
      options = isReversed: selection.isReversed()
      selection.insertText("#{bracket}#{selection.getText()}#{pair}")
      selectionStart = range.start.add([0, 1])
      if range.start.row is range.end.row
        selectionEnd = range.end.add([0, 1])
      else
        selectionEnd = range.end
      selection.setBufferRange([selectionStart, selectionEnd], options)

    selectionWrapped

  isQuote: (string) ->
    /'|"/.test(string)

  getInvertedPairedCharacters: ->
    return @invertedPairedCharacters if @invertedPairedCharacters

    @invertedPairedCharacters = {}
    for open, close of @pairedCharacters
      @invertedPairedCharacters[close] = open
    @invertedPairedCharacters

  isOpeningBracket: (string) ->
    @pairedCharacters.hasOwnProperty(string)

  isClosingBracket: (string) ->
    @getInvertedPairedCharacters().hasOwnProperty(string)
