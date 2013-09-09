shell = require 'shell'
{View} = require 'space-pen'
Editor = require 'editor'
FindModel = require './find-model'
FindResultsView = require './find-results-view'
History = require './history'

module.exports =
class FindView extends View

  @content: ->
    @div class: 'find-and-replace buffer-find-and-replace tool-panel panel-bottom', =>
      @div class: 'find-container block', =>
        @div class: 'btn-group pull-right btn-toggle', =>
          @button outlet: 'regexOptionButton', class: 'btn btn-mini option-regex', '.*'
          @button outlet: 'caseOptionButton', class: 'btn btn-mini option-case', 'Aa'
          @button outlet: 'selectionOptionButton', class: 'btn btn-mini option-selection', '"'

        @div class: 'find-editor-container editor-container', =>
          @div class: 'find-meta-container', =>
            @span outlet: 'resultCounter', class: 'result-counter', ''
            @a href: '#', outlet: 'previousButton', class: 'icon icon-chevron-left'
            @a href: '#', outlet: 'nextButton', class: 'icon icon-chevron-right'
          @subview 'findEditor', new Editor(mini: true)

      @div outlet: 'replaceContainer', class: 'replace-container block', =>
        @label outlet: 'replaceLabel', 'Replace'

        @div class: 'btn-group pull-right btn-toggle', =>
          @button outlet: 'replaceNextButton', class: 'btn btn-mini btn-next', 'Next'
          @button outlet: 'replaceAllButton', class: 'btn btn-mini btn-all', 'All'

        @div class: 'replace-editor-container editor-container', =>
          @subview 'replaceEditor', new Editor(mini: true)

  initialize: (@findModel, {findHistory, replaceHistory}) ->
    @findHistory = new History(@findEditor, findHistory)
    @replaceHistory = new History(@replaceEditor, replaceHistory)
    @findResultsView = new FindResultsView(@findModel)
    @handleEvents()
    @updateOptionButtons()

  handleEvents: ->
    @handleFindEvents()
    @handleReplaceEvents()

    @on 'core:cancel', @detach
    @on 'click', => @focus()

    @command 'find-and-replace:toggle-regex-option', @toggleRegexOption
    @command 'find-and-replace:toggle-case-option', @toggleCaseOption
    @command 'find-and-replace:toggle-selection-option', @toggleSelectionOption

    @regexOptionButton.on 'click', @toggleRegexOption
    @caseOptionButton.on 'click', @toggleCaseOption
    @selectionOptionButton.on 'click', @toggleSelectionOption

    @findModel.on 'updated', @markersUpdated

  handleFindEvents: ->
    rootView.command 'find-and-replace:show', @showFind
    @findEditor.on 'core:confirm', => @findNext()
    @nextButton.on 'click', => @findNext()
    @previousButton.on 'click', => @findPrevious()
    rootView.command 'find-and-replace:find-next', @findNext
    rootView.command 'find-and-replace:find-previous', @findPrevious
    rootView.command 'find-and-replace:use-selection-as-find-pattern', @setSelectionAsFindPattern

  handleReplaceEvents: ->
    rootView.command 'find-and-replace:show-replace', @showReplace
    @replaceEditor.on 'core:confirm', @replaceNext
    @replaceNextButton.on 'click', @replaceNext
    @replaceAllButton.on 'click', @replaceAll
    rootView.command 'find-and-replace:replace-next', @replaceNext
    rootView.command 'find-and-replace:replace-all', @replaceAll

  showFind: =>
    @attach()
    @addClass('find-mode').removeClass('replace-mode')
    @focus()

  showReplace: =>
    @attach()
    @addClass('replace-mode').removeClass('find-mode')
    @focus()

  focus: =>
    @replaceEditor.selectAll()
    @findEditor.selectAll()

    if @hasClass('find-mode')
      @findEditor.focus()
    else
      @replaceEditor.focus()

  attach: =>
    @findResultsView.attach()
    rootView.vertical.append(this)

  detach: =>
    @findResultsView.detach()
    rootView.focus()
    super()

  serialize: ->
    findHistory: @findHistory.serialize()
    replaceHistory: @replaceHistory.serialize()

  findNext: =>
    @findModel.update {pattern: @findEditor.getText()}
    if @markers.length == 0
      shell.beep()
    else
      @selectFirstMarkerAfterCursor()
      rootView.focus()

  findPrevious: =>
    @findModel.update {pattern: @findEditor.getText()}
    if @markers.length == 0
      shell.beep()
    else
      @selectFirstMarkerBeforeCursor()
      rootView.focus()

  replaceNext: =>
    @findModel.update {pattern: @findEditor.getText()}

    if @markers.length == 0
      shell.beep()
    else
      markerIndex = @firstMarkerIndexAfterCursor()
      currentMarker = @markers[markerIndex]
      @findModel.replace([currentMarker], @replaceEditor.getText())

      @findModel.getEditSession().setCursorBufferPosition currentMarker.bufferMarker.getEndPosition()

  replaceAll: =>
    @findModel.update {pattern: @findEditor.getText()}
    @findModel.replace(@markers, @replaceEditor.getText())

  markersUpdated: (@markers) =>
    @updateResultCounter()
    @updateOptionButtons()
    @findEditor.setText(@findModel.pattern)
    @findHistory.store()
    @replaceHistory.store()

  updateResultCounter: ->
    if not @markers? or @markers.length == 0
      text = "no results"
    else if @markers.length == 1
      text = "1 found"
    else
      text = "#{@markers.length} found"

    @resultCounter.text text

  selectFirstMarkerAfterCursor: ->
    markerIndex = @firstMarkerIndexAfterCursor()
    @selectMarkerAtIndex(markerIndex)

  firstMarkerIndexAfterCursor: ->
    selection = @findModel.getEditSession().getSelection()
    {start, end} = selection.getBufferRange()
    start = end if selection.isReversed()

    for marker, index in @markers
      markerStartPosition = marker.bufferMarker.getStartPosition()
      return index if markerStartPosition.isGreaterThan(start)
    0

  selectFirstMarkerBeforeCursor: ->
    markerIndex = @firstMarkerIndexBeforeCursor()
    @selectMarkerAtIndex(markerIndex)

  firstMarkerIndexBeforeCursor: ->
    selection = @findModel.getEditSession().getSelection()
    {start, end} = selection.getBufferRange()
    start = end if selection.isReversed()

    for marker, index in @markers by -1
      markerEndPosition = marker.bufferMarker.getEndPosition()
      return index if markerEndPosition.isLessThan(start)

    @markers.length - 1

  selectMarkerAtIndex: (markerIndex) ->
    return unless @markers?.length > 0

    if marker = @markers[markerIndex]
      @findModel.getEditSession().setSelectedBufferRange marker.getBufferRange()
      rootView.one 'cursor:moved', => @updateResultCounter()
      @resultCounter.text("#{markerIndex + 1} of #{@markers.length}")

  setSelectionAsFindPattern: =>
    pattern = @findModel.getEditSession().getSelectedText()
    @findModel.update {pattern}

  toggleRegexOption: =>
    @findModel.update {pattern: @findEditor.getText(), useRegex: !@findModel.useRegex}
    @selectFirstMarkerAfterCursor()

  toggleCaseOption: =>
    @findModel.update {pattern: @findEditor.getText(), caseInsensitive: !@findModel.caseInsensitive}
    @selectFirstMarkerAfterCursor()

  toggleSelectionOption: =>
    @findModel.update {pattern: @findEditor.getText(), inCurrentSelection: !@findModel.inCurrentSelection}
    @selectFirstMarkerAfterCursor()

  setOptionButtonState: (optionButton, selected) ->
    if selected
      optionButton.addClass 'selected'
    else
      optionButton.removeClass 'selected'

  updateOptionButtons: ->
    @setOptionButtonState(@regexOptionButton, @findModel.useRegex)
    @setOptionButtonState(@caseOptionButton, @findModel.caseInsensitive)
    @setOptionButtonState(@selectionOptionButton, @findModel.inCurrentSelection)
