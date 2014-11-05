fs = require 'fs-plus'
Q = require 'q'
_ = require 'underscore-plus'
{$, $$$, TextEditorView, View} = require 'atom'

{HistoryCycler} = require './history'
Util = require './project/util'
ResultsModel = require './project/results-model'
ResultsPaneView = require './project/results-pane'

module.exports =
class ProjectFindView extends View
  @content: ->
    @div tabIndex: -1, class: 'project-find padded', =>
      @div class: 'block', =>
        @span outlet: 'descriptionLabel', class: 'description'
        @span class: 'options-label pull-right', =>
          @span 'Finding with Options: '
          @span outlet: 'optionsLabel', class: 'options'

      @div outlet: 'replacmentInfoBlock', class: 'block', =>
        @progress outlet: 'replacementProgress', class: 'inline-block'
        @span outlet: 'replacmentInfo', class: 'inline-block', 'Replaced 2 files of 10 files'

      @div class: 'find-container block', =>
        @div class: 'editor-container', =>
          @subview 'findEditor', new TextEditorView(mini: true, placeholderText: 'Find in project')

        @div class: 'btn-group btn-toggle btn-group-options', =>
          @button outlet: 'regexOptionButton', class: 'btn option-regex', '.*'
          @button outlet: 'caseOptionButton', class: 'btn option-case-sensitive', 'Aa'

      @div class: 'replace-container block', =>
        @div class: 'editor-container', =>
          @subview 'replaceEditor', new TextEditorView(mini: true, placeholderText: 'Replace in project')

        @div class: 'btn-group btn-group-replace-all', =>
          @button outlet: 'replaceAllButton', class: 'btn', 'Replace All'

      @div class: 'paths-container block', =>
        @div class: 'editor-container', =>
          @subview 'pathsEditor', new TextEditorView(mini: true, placeholderText: 'File/directory pattern. eg. `src` to search in the "src" directory or `*.js` to search all javascript files.')

  initialize: (@findInBufferModel, @model, {findHistory, replaceHistory, pathsHistory}) ->
    @handleEvents()
    @findHistory = new HistoryCycler(@findEditor, findHistory)
    @replaceHistory = new HistoryCycler(@replaceEditor, replaceHistory)
    @pathsHistory = new HistoryCycler(@pathsEditor, pathsHistory)
    @onlyRunIfChanged = true

    @regexOptionButton.addClass('selected') if @model.useRegex
    @caseOptionButton.addClass('selected') if @model.caseSensitive

    @clearMessages()
    @updateOptionsLabel()

  setPanel: (@panel) ->
    @subscribe @panel.onDidChangeVisible (visible) =>
      if visible then @didShow() else @didHide()

  didShow: ->
    atom.workspaceView.addClass('find-visible')

    selectedText = atom.workspace.getActiveEditor()?.getSelectedText?()
    if selectedText and selectedText.indexOf('\n') < 0
      @findEditor.setText(selectedText)

    @findEditor.focus()
    @findEditor.getEditor().selectAll()

    unless @tooltipsInitialized
      @regexOptionButton.setTooltip("Use Regex", command: 'project-find:toggle-regex-option', commandElement: @findEditor)
      @caseOptionButton.setTooltip("Match Case", command: 'project-find:toggle-case-option', commandElement: @findEditor)
      @replaceAllButton.setTooltip("Replace All", command: 'project-find:replace-all', commandElement: @replaceEditor)
      @tooltipsInitialized = true

  didHide: ->
    @hideAllTooltips()
    atom.workspaceView.focus()
    atom.workspaceView.removeClass('find-visible')

  hideAllTooltips: ->
    @regexOptionButton.hideTooltip()
    @caseOptionButton.hideTooltip()
    @replaceAllButton.hideTooltip()

  handleEvents: ->
    @on 'core:confirm', => @confirm()
    @on 'find-and-replace:focus-next', => @focusNextElement(1)
    @on 'find-and-replace:focus-previous', => @focusNextElement(-1)
    @on 'core:cancel core:close', => @panel?.hide()

    @on 'project-find:toggle-regex-option', => @toggleRegexOption()
    @regexOptionButton.click => @toggleRegexOption()

    @on 'project-find:toggle-case-option', => @toggleCaseOption()
    @caseOptionButton.click => @toggleCaseOption()

    @replaceAllButton.on 'click', => @replaceAll()
    @on 'project-find:replace-all', => @replaceAll()

    @subscribe @model, 'cleared', => @clearMessages()
    @subscribe @model, 'replacement-state-cleared', (results) => @generateResultsMessage(results)
    @subscribe @model, 'finished-searching', (results) => @generateResultsMessage(results)

    @subscribe $(window), 'focus', => @onlyRunIfChanged = false

    atom.workspaceView.command 'find-and-replace:use-selection-as-find-pattern', @setSelectionAsFindPattern

    @handleEventsForReplace()

  handleEventsForReplace: ->
    @replaceEditor.getModel().getBuffer().onDidChange => @model.clearReplacementState()
    @replaceEditor.getModel().onDidStopChanging => @model.updateReplacementPattern(@replaceEditor.getText())
    @replacementsMade = 0
    @subscribe @model, 'replace', (promise) =>
      @replacementsMade = 0
      @replacmentInfoBlock.show()
      @replacementProgress.removeAttr('value')

    @subscribe @model, 'path-replaced', (result) =>
      @replacementsMade++
      @replacementProgress[0].value = @replacementsMade / @model.getPathCount()
      @replacmentInfo.text("Replaced #{@replacementsMade} of #{_.pluralize(@model.getPathCount(), 'file')}")

    @subscribe @model, 'finished-replacing', (result) => @onFinishedReplacing(result)

  toggleRegexOption: ->
    @model.toggleUseRegex()
    if @model.useRegex then @regexOptionButton.addClass('selected') else @regexOptionButton.removeClass('selected')
    @updateOptionsLabel()
    @search(onlyRunIfActive: true)

  toggleCaseOption: ->
    @model.toggleCaseSensitive()
    if @model.caseSensitive then @caseOptionButton.addClass('selected') else @caseOptionButton.removeClass('selected')
    @updateOptionsLabel()
    @search(onlyRunIfActive: true)

  focusNextElement: (direction) ->
    elements = [@findEditor, @replaceEditor, @pathsEditor].filter (el) -> el.has(':visible').length > 0
    focusedElement = _.find elements, (el) -> el.has(':focus').length > 0 or el.is(':focus')
    focusedIndex = elements.indexOf focusedElement

    focusedIndex = focusedIndex + direction
    focusedIndex = 0 if focusedIndex >= elements.length
    focusedIndex = elements.length - 1 if focusedIndex < 0
    elements[focusedIndex].focus()
    elements[focusedIndex].getEditor?().selectAll()

  confirm: ->
    if @findEditor.getText().length == 0
      @model.clear()
      return

    @findHistory.store()
    @replaceHistory.store()
    @pathsHistory.store()

    searchPromise = @search({@onlyRunIfChanged})
    @onlyRunIfChanged = true
    searchPromise

  search: ({onlyRunIfActive, onlyRunIfChanged}={}) ->
    return Q() if onlyRunIfActive and not @model.active

    pattern = @findEditor.getText()
    @findInBufferModel.update {pattern}

    @clearMessages()
    @showResultPane().then =>
      try
        @model.search(pattern, @getPaths(), @replaceEditor.getText(), {onlyRunIfChanged})
      catch e
        @setErrorMessage(e.message)

  replaceAll: ->
    @clearMessages()
    @showResultPane().then =>
      pattern = @findEditor.getText()
      replacementPattern = @replaceEditor.getText()

      @model.search(pattern, @getPaths(), replacementPattern, onlyRunIfChanged: true).then =>
        @clearMessages()
        @model.replace(pattern, @getPaths(), replacementPattern, @model.getPaths())

  getPaths: ->
    path.trim() for path in @pathsEditor.getText().trim().split(',') when path

  directoryPathForElement: (element) ->
    elementPath = null
    while element?
      elementPath = element.dataset.path
      break if elementPath
      element = element.parentElement

    if fs.isFileSync(elementPath)
      require('path').dirname(elementPath)
    else
      elementPath

  findInCurrentlySelectedDirectory: (selectedElement) ->
    if absPath = @directoryPathForElement(selectedElement)
      relPath = atom.project.relativize(absPath)
      @pathsEditor.setText(relPath)

  showResultPane: ->
    options = null
    options = {split: 'right'} if atom.config.get('find-and-replace.openProjectFindResultsInRightPane')
    atom.workspaceView.open(ResultsPaneView.URI, options)

  onFinishedReplacing: (results) ->
    atom.beep() unless results.replacedPathCount
    @replacmentInfoBlock.hide()

  generateResultsMessage: (results) =>
    message = Util.getSearchResultsMessage(results)
    message = Util.getReplacementResultsMessage(results) if results.replacedPathCount?
    @setInfoMessage(message)

  clearMessages: ->
    @setInfoMessage('Find in Project <span class="subtle-info-message">Close this panel with the <span class="highlight">esc</span> key</span>').removeClass('text-error')
    @replacmentInfoBlock.hide()

  setInfoMessage: (infoMessage) ->
    @descriptionLabel.html(infoMessage).removeClass('text-error')

  setErrorMessage: (errorMessage) ->
    @descriptionLabel.html(errorMessage).addClass('text-error')

  updateOptionsLabel: ->
    label = []
    label.push('Regex') if @model.useRegex
    if @model.caseSensitive
      label.push('Case Sensitive')
    else
      label.push('Case Insensitive')
    @optionsLabel.text(label.join(', '))

  setSelectionAsFindPattern: =>
    editor = atom.workspace.getActivePaneItem()
    if editor?.getSelectedText?
      pattern = editor.getSelectedText()
      @findEditor.setText(pattern)
