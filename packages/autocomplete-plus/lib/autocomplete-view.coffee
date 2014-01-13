{_, $, $$, Range, SelectList}  = require 'atom'

module.exports =
class AutocompleteView extends SelectList
  @viewClass: -> "autocomplete #{super} popover-list"

  editor: null
  currentBuffer: null
  wordList: null
  wordRegex: /\w+/g
  originalSelectionBufferRange: null
  originalCursorPosition: null
  aboveCursor: false
  filterKey: 'word'

  initialize: (@editorView) ->
    super
    {@editor} = @editorView
    @handleEvents()
    @setCurrentBuffer(@editor.getBuffer())

  itemForElement: (match) ->
    $$ ->
      @li =>
        @span match.word

  handleEvents: ->
    @list.on 'mousewheel', (event) -> event.stopPropagation()

    @editorView.on 'editor:path-changed', => @setCurrentBuffer(@editor.getBuffer())
    @editorView.command 'autocomplete:attach', => @attach()
    @editorView.command 'autocomplete:next', => @selectNextItem()
    @editorView.command 'autocomplete:previous', => @selectPreviousItem()

    @miniEditor.preempt 'textInput', (e) =>
      text = e.originalEvent.data
      unless text.match(@wordRegex)
        @confirmSelection()
        @editor.insertText(text)
        false

  setCurrentBuffer: (@currentBuffer) ->

  selectItem: (item) ->
    super
    match = @getSelectedElement()
    @replaceSelectedTextWithMatch(match) if match

  selectNextItem: ->
    super
    false

  selectPreviousItem: ->
    super
    false

  getCompletionsForCursorScope: ->
    cursorScope = @editor.scopesForBufferPosition(@editor.getCursorBufferPosition())
    completions = atom.syntax.propertiesForScope(cursorScope, 'editor.completions')
    completions = completions.map (properties) -> _.valueForKeyPath(properties, 'editor.completions')
    _.uniq(_.flatten(completions))

  buildWordList: ->
    wordHash = {}
    if atom.config.get('autocomplete.includeCompletionsFromAllBuffers')
      buffers = atom.project.getBuffers()
    else
      buffers = [@currentBuffer]
    matches = []
    matches.push(buffer.getText().match(@wordRegex)) for buffer in buffers
    wordHash[word] ?= true for word in _.flatten(matches)
    wordHash[word] ?= true for word in @getCompletionsForCursorScope()

    @wordList = Object.keys(wordHash).sort (word1, word2) ->
      word1 = word1.toLowerCase()
      word2 = word2.toLowerCase()
      if word1 > word2
        1
      else if word1 < word2
        -1
      else
        0

  confirmed: (match) ->
    @editor.getSelection().clear()
    @cancel()
    return unless match
    @replaceSelectedTextWithMatch match
    position = @editor.getCursorBufferPosition()
    @editor.setCursorBufferPosition([position.row, position.column + match.suffix.length])

  cancelled: ->
    super

    @editor.abortTransaction()
    @editor.setSelectedBufferRange(@originalSelectionBufferRange)
    atom.workspaceView.focus() if @miniEditor.isFocused

  attach: ->
    @editor.beginTransaction()

    @aboveCursor = false
    @originalSelectionBufferRange = @editor.getSelection().getBufferRange()
    @originalCursorPosition = @editor.getCursorScreenPosition()

    @buildWordList()
    matches = @findMatchesForCurrentSelection()
    @setArray(matches)

    if matches.length is 1
      @confirmSelection()
    else
      @editorView.appendToLinesView(this)
      @setPosition()
      @miniEditor.focus()

  detach: ->
    super

    @editorView.focus()

  setPosition: ->
    { left, top } = @editorView.pixelPositionForScreenPosition(@originalCursorPosition)
    height = @outerHeight()
    potentialTop = top + @editorView.lineHeight
    potentialBottom = potentialTop - @editorView.scrollTop() + height

    if @aboveCursor or potentialBottom > @editorView.outerHeight()
      @aboveCursor = true
      @css(left: left, top: top - height, bottom: 'inherit')
    else
      @css(left: left, top: potentialTop, bottom: 'inherit')

  findMatchesForCurrentSelection: ->
    selection = @editor.getSelection()
    {prefix, suffix} = @prefixAndSuffixOfSelection(selection)

    if (prefix.length + suffix.length) > 0
      regex = new RegExp("^#{prefix}.+#{suffix}$", "i")
      currentWord = prefix + @editor.getSelectedText() + suffix
      for word in @wordList when regex.test(word) and word != currentWord
        {prefix, suffix, word}
    else
      {word, prefix, suffix} for word in @wordList

  replaceSelectedTextWithMatch: (match) ->
    selection = @editor.getSelection()
    startPosition = selection.getBufferRange().start
    buffer = @editor.getBuffer()

    selection.deleteSelectedText()
    cursorPosition = @editor.getCursorBufferPosition()
    buffer.delete(Range.fromPointWithDelta(cursorPosition, 0, match.suffix.length))
    buffer.delete(Range.fromPointWithDelta(cursorPosition, 0, -match.prefix.length))
    @editor.insertText(match.word)

    infixLength = match.word.length - match.prefix.length - match.suffix.length
    @editor.setSelectedBufferRange([startPosition, [startPosition.row, startPosition.column + infixLength]])

  prefixAndSuffixOfSelection: (selection) ->
    selectionRange = selection.getBufferRange()
    lineRange = [[selectionRange.start.row, 0], [selectionRange.end.row, @editor.lineLengthForBufferRow(selectionRange.end.row)]]
    [prefix, suffix] = ["", ""]

    @currentBuffer.scanInRange @wordRegex, lineRange, ({match, range, stop}) ->
      stop() if range.start.isGreaterThan(selectionRange.end)

      if range.intersectsWith(selectionRange)
        prefixOffset = selectionRange.start.column - range.start.column
        suffixOffset = selectionRange.end.column - range.end.column

        prefix = match[0][0...prefixOffset] if range.start.isLessThan(selectionRange.start)
        suffix = match[0][suffixOffset..] if range.end.isGreaterThan(selectionRange.end)

    {prefix, suffix}

  afterAttach: (onDom) ->
    if onDom
      widestCompletion = parseInt(@css('min-width')) or 0
      @list.find('span').each ->
        widestCompletion = Math.max(widestCompletion, $(this).outerWidth())
      @list.width(widestCompletion)
      @width(@list.outerWidth())

  populateList: ->
    super

    @setPosition()
