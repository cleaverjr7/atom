_ = require 'underscore-plus'
{Subscriber} = require 'emissary'
SelectorCache = require './selector-cache'

module.exports =
class BracketMatcher
  Subscriber.includeInto(this)

  defaultPairs:
    '(': ')'
    '[': ']'
    '{': '}'
    '"': '"'
    "'": "'"
    '`': '`'

  smartQuotePairs:
    "“": "”"
    '‘': '’'
    "«": "»"
    "‹": "›"

  toggleQuotes: (includeSmartQuotes) ->
    if includeSmartQuotes
      @pairedCharacters = _.extend(@defaultPairs, @smartQuotePairs)
    else
      @pairedCharacters = @defaultPairs

  constructor: (editorView) ->
    {@editor} = editorView
    @bracketMarkers = []

    _.adviseBefore(@editor, 'insertText', @insertText)
    _.adviseBefore(@editor, 'insertNewline', @insertNewline)
    _.adviseBefore(@editor, 'backspace', @backspace)

    @subscribe editorView.command 'bracket-matcher:remove-brackets-from-selection', (event) =>
      event.abortKeyBinding() unless @removeBrackets()

    @subscribe atom.config.observe 'bracket-matcher.autocompleteSmartQuotes', (newValue) =>
      @toggleQuotes(newValue)

    @subscribe @editor, 'destroyed', => @unsubscribe()

  insertText: (text, options) =>
    return true if options?.select or options?.undo is 'skip'
    return false if @isOpeningBracket(text) and @wrapSelectionInBrackets(text)
    return true if @editor.hasMultipleCursors()

    cursorBufferPosition = @editor.getCursorBufferPosition()
    previousCharacters = @editor.getTextInBufferRange([cursorBufferPosition.add([0, -2]), cursorBufferPosition])
    nextCharacter = @editor.getTextInBufferRange([cursorBufferPosition, cursorBufferPosition.add([0,1])])

    previousCharacter = previousCharacters.slice(-1)

    hasWordAfterCursor = /\w/.test(nextCharacter)
    hasWordBeforeCursor = /\w/.test(previousCharacter)
    hasQuoteBeforeCursor = previousCharacter is text[0]
    hasEscapeSequenceBeforeCursor = previousCharacters.match(/\\/g)?.length >= 1 # To guard against the "\\" sequence

    if text is '#' and @isCursorOnInterpolatedString()
      autoCompleteOpeningBracket = atom.config.get('bracket-matcher.autocompleteBrackets') and not hasEscapeSequenceBeforeCursor
      text += '{'
      pair = '}'
    else
      autoCompleteOpeningBracket = atom.config.get('bracket-matcher.autocompleteBrackets') and @isOpeningBracket(text) and not hasWordAfterCursor and not (@isQuote(text) and (hasWordBeforeCursor or hasQuoteBeforeCursor)) and not hasEscapeSequenceBeforeCursor
      pair = @pairedCharacters[text]

    skipOverExistingClosingBracket = false
    if @isClosingBracket(text) and nextCharacter == text and not hasEscapeSequenceBeforeCursor
      if bracketMarker = _.find(@bracketMarkers, (marker) => marker.isValid() and marker.getBufferRange().end.isEqual(cursorBufferPosition))
        skipOverExistingClosingBracket = true

    if skipOverExistingClosingBracket
      bracketMarker.destroy()
      _.remove(@bracketMarkers, bracketMarker)
      @editor.moveRight()
      false
    else if autoCompleteOpeningBracket
      @editor.insertText(text + pair)
      @editor.moveLeft()
      range = [cursorBufferPosition, cursorBufferPosition.add([0, text.length])]
      @bracketMarkers.push @editor.markBufferRange(range)
      false

  insertNewline: =>
    return if @editor.hasMultipleCursors()
    return unless @editor.getLastSelection().isEmpty()

    cursorBufferPosition = @editor.getCursorBufferPosition()
    previousCharacters = @editor.getTextInBufferRange([cursorBufferPosition.add([0, -2]), cursorBufferPosition])
    nextCharacter = @editor.getTextInBufferRange([cursorBufferPosition, cursorBufferPosition.add([0,1])])

    previousCharacter = previousCharacters.slice(-1)

    hasEscapeSequenceBeforeCursor = previousCharacters.match(/\\/g)?.length >= 1 # To guard against the "\\" sequence
    if @pairedCharacters[previousCharacter] is nextCharacter and not hasEscapeSequenceBeforeCursor
      @editor.transact =>
        @editor.insertText "\n\n"
        @editor.moveUp()
        if atom.config.get('editor.autoIndent')
          cursorRow = @editor.getCursorBufferPosition().row
          @editor.autoIndentBufferRows(cursorRow, cursorRow + 1)
      false

  backspace: =>
    return if @editor.hasMultipleCursors()
    return unless @editor.getLastSelection().isEmpty()

    cursorBufferPosition = @editor.getCursorBufferPosition()
    previousCharacters = @editor.getTextInBufferRange([cursorBufferPosition.add([0, -2]), cursorBufferPosition])
    nextCharacter = @editor.getTextInBufferRange([cursorBufferPosition, cursorBufferPosition.add([0,1])])

    previousCharacter = previousCharacters.slice(-1)

    hasEscapeSequenceBeforeCursor = previousCharacters.match(/\\/g)?.length >= 1 # To guard against the "\\" sequence
    if (@pairedCharacters[previousCharacter] is nextCharacter) and not hasEscapeSequenceBeforeCursor and atom.config.get('bracket-matcher.autocompleteBrackets')
      @editor.transact =>
        @editor.moveLeft()
        @editor.delete()
        @editor.delete()
      false

  removeBrackets: ->
    bracketsRemoved = false
    @editor.mutateSelectedText (selection) =>
      return unless @selectionIsWrappedByMatchingBrackets(selection)

      range = selection.getBufferRange()
      options = reversed: selection.isReversed()
      selectionStart = range.start
      if range.start.row is range.end.row
        selectionEnd = range.end.add([0, -2])
      else
        selectionEnd = range.end.add([0, -1])

      text = selection.getText()
      selection.insertText(text.substring(1, text.length - 1))
      selection.setBufferRange([selectionStart, selectionEnd], options)
      bracketsRemoved = true
    bracketsRemoved

  wrapSelectionInBrackets: (bracket) ->
    return false unless atom.config.get('bracket-matcher.wrapSelectionsInBrackets')

    pair = @pairedCharacters[bracket]
    selectionWrapped = false
    @editor.mutateSelectedText (selection) ->
      return if selection.isEmpty()

      selectionWrapped = true
      range = selection.getBufferRange()
      options = reversed: selection.isReversed()
      selection.insertText("#{bracket}#{selection.getText()}#{pair}")
      selectionStart = range.start.add([0, 1])
      if range.start.row is range.end.row
        selectionEnd = range.end.add([0, 1])
      else
        selectionEnd = range.end
      selection.setBufferRange([selectionStart, selectionEnd], options)

    selectionWrapped

  isQuote: (string) ->
    /['"`]/.test(string)

  isCursorOnInterpolatedString: ->
    unless @interpolatedStringSelector?
      segments = [
        'constant.other.symbol.interpolated.ruby'
        'string.interpolated.ruby'
        'string.regexp.interpolated.ruby'
        'string.quoted.double.coffee'
        'string.quoted.double.interpolated.ruby'
        'string.quoted.other.interpolated.ruby'
        'string.unquoted.heredoc.ruby'
      ]
      @interpolatedStringSelector = SelectorCache.get(segments.join(' | '))
    @interpolatedStringSelector.matches(@editor.getCursorScopes())

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

  selectionIsWrappedByMatchingBrackets: (selection) ->
    return false if selection.isEmpty()
    selectedText = selection.getText()
    firstCharacter = selectedText[0]
    lastCharacter = selectedText[selectedText.length - 1]
    @pairedCharacters[firstCharacter] is lastCharacter
