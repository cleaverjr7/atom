fs = require 'fs-plus'
path = require 'path'
_ = require 'underscore-plus'
{Disposable, CompositeDisposable} = require 'atom'
{$, $$$, View, TextEditorView} = require 'atom-space-pen-views'

{HistoryCycler} = require './history'
Util = require './project/util'
ResultsModel = require './project/results-model'
ResultsPaneView = require './project/results-pane'

module.exports =
class ProjectFindView extends View
  @content: ->
    @div tabIndex: -1, class: 'project-find padded', =>
      @header class: 'header', =>
        @span outlet: 'descriptionLabel', class: 'header-item description'
        @span class: 'header-item options-label pull-right', =>
          @span 'Finding with Options: '
          @span outlet: 'optionsLabel', class: 'options'

      @section outlet: 'replacmentInfoBlock', class: 'input-block', =>
        @progress outlet: 'replacementProgress', class: 'inline-block'
        @span outlet: 'replacmentInfo', class: 'inline-block', 'Replaced 2 files of 10 files'

      @section class: 'input-block find-container', =>
        @div class: 'input-block-item input-block-item--flex editor-container', =>
          @subview 'findEditor', new TextEditorView(mini: true, placeholderText: 'Find in project')
        @div class: 'input-block-item', =>
          @div class: 'btn-group btn-toggle btn-group-options', =>
            @button outlet: 'regexOptionButton', class: 'btn option-regex', =>
              @raw '<svg class="icon"><use xlink:href="#find-and-replace-icon-regex" /></svg>'
            @button outlet: 'caseOptionButton', class: 'btn option-case-sensitive', =>
              @raw '<svg class="icon"><use xlink:href="#find-and-replace-icon-case" /></svg>'
            @button outlet: 'wholeWordOptionButton', class: 'btn option-whole-word', =>
              @raw '<svg class="icon"><use xlink:href="#find-and-replace-icon-word" /></svg>'

      @section class: 'input-block replace-container', =>
        @div class: 'input-block-item input-block-item--flex editor-container', =>
          @subview 'replaceEditor', new TextEditorView(mini: true, placeholderText: 'Replace in project')
        @div class: 'input-block-item', =>
          @div class: 'btn-group btn-group-replace-all', =>
            @button outlet: 'replaceAllButton', class: 'btn', disabled: 'disabled', 'Replace All'

      @section class: 'input-block paths-container', =>
        @div class: 'input-block-item editor-container', =>
          @subview 'pathsEditor', new TextEditorView(mini: true, placeholderText: 'File/directory pattern. eg. `src` to search in the "src" directory or `*.js` to search all javascript files.')

  initialize: (@findInBufferModel, @model, {findHistory, replaceHistory, pathsHistory}) ->
    @subscriptions = new CompositeDisposable
    @handleEvents()
    @findHistory = new HistoryCycler(@findEditor, findHistory)
    @replaceHistory = new HistoryCycler(@replaceEditor, replaceHistory)
    @pathsHistory = new HistoryCycler(@pathsEditor, pathsHistory)
    @onlyRunIfChanged = true

    @regexOptionButton.addClass('selected') if @model.getFindOptions().useRegex
    @caseOptionButton.addClass('selected') if @model.getFindOptions().caseSensitive
    @wholeWordOptionButton.addClass('selected') if @model.getFindOptions().wholeWord

    @clearMessages()
    @updateOptionsLabel()

  destroy: ->
    @subscriptions?.dispose()
    @tooltipSubscriptions?.dispose()

  setPanel: (@panel) ->
    @subscriptions.add @panel.onDidChangeVisible (visible) =>
      if visible then @didShow() else @didHide()

  didShow: ->
    atom.views.getView(atom.workspace).classList.add('find-visible')
    return if @tooltipSubscriptions?

    @tooltipSubscriptions = subs = new CompositeDisposable
    subs.add atom.tooltips.add @regexOptionButton,
      title: "Use Regex"
      keyBindingCommand: 'project-find:toggle-regex-option',
      keyBindingTarget: @findEditor.element

    subs.add atom.tooltips.add @caseOptionButton,
      title: "Match Case",
      keyBindingCommand: 'project-find:toggle-case-option',
      keyBindingTarget: @findEditor.element

    subs.add atom.tooltips.add @wholeWordOptionButton,
      title: "Whole Word",
      keyBindingCommand: 'project-find:toggle-whole-word-option',
      keyBindingTarget: @findEditor.element

    subs.add atom.tooltips.add @replaceAllButton,
      title: "Replace All",
      keyBindingCommand: 'project-find:replace-all',
      keyBindingTarget: @replaceEditor.element

  didHide: ->
    @hideAllTooltips()
    workspaceElement = atom.views.getView(atom.workspace)
    workspaceElement.focus()
    workspaceElement.classList.remove('find-visible')

  hideAllTooltips: ->
    @tooltipSubscriptions.dispose()
    @tooltipSubscriptions = null

  handleEvents: ->
    @subscriptions.add atom.commands.add 'atom-workspace',
      'find-and-replace:use-selection-as-find-pattern': @setSelectionAsFindPattern

    @subscriptions.add atom.commands.add @element,
      'find-and-replace:focus-next': => @focusNextElement(1)
      'find-and-replace:focus-previous': => @focusNextElement(-1)
      'core:confirm': => @confirm()
      'core:close': => @panel?.hide()
      'core:cancel': => @panel?.hide()
      'project-find:confirm': => @confirm()
      'project-find:toggle-regex-option': => @toggleRegexOption()
      'project-find:toggle-case-option': => @toggleCaseOption()
      'project-find:toggle-whole-word-option': => @toggleWholeWordOption()
      'project-find:replace-all': => @replaceAll()

    updateInterfaceForResults = (results) =>
      if results.matchCount is 0 and results.pattern is ''
        @clearMessages()
      else
        @generateResultsMessage(results)
      @updateReplaceAllButtonEnablement(results)

    resetInterface = =>
      @clearMessages()
      @updateReplaceAllButtonEnablement(null)

    @subscriptions.add @model.onDidClear(resetInterface)
    @subscriptions.add @model.onDidClearReplacementState(updateInterfaceForResults)
    @subscriptions.add @model.onDidFinishSearching(updateInterfaceForResults)

    @on 'focus', (e) => @findEditor.focus()
    @regexOptionButton.click => @toggleRegexOption()
    @caseOptionButton.click => @toggleCaseOption()
    @wholeWordOptionButton.click => @toggleWholeWordOption()
    @replaceAllButton.on 'click', => @replaceAll()

    focusCallback = => @onlyRunIfChanged = false
    $(window).on 'focus', focusCallback
    @subscriptions.add new Disposable ->
      $(window).off 'focus', focusCallback

    @findEditor.getModel().getBuffer().onDidChange =>
      @updateReplaceAllButtonEnablement(@model.getResultsSummary())
    @handleEventsForReplace()

  handleEventsForReplace: ->
    @replaceEditor.getModel().getBuffer().onDidChange => @model.clearReplacementState()
    @replaceEditor.getModel().onDidStopChanging => @model.updateReplacementPattern(@replaceEditor.getText())
    @replacementsMade = 0
    @subscriptions.add @model.onDidStartReplacing (promise) =>
      @replacementsMade = 0
      @replacmentInfoBlock.show()
      @replacementProgress.removeAttr('value')

    @subscriptions.add @model.onDidReplacePath (result) =>
      @replacementsMade++
      @replacementProgress[0].value = @replacementsMade / @model.getPathCount()
      @replacmentInfo.text("Replaced #{@replacementsMade} of #{_.pluralize(@model.getPathCount(), 'file')}")

    @subscriptions.add @model.onDidFinishReplacing (result) => @onFinishedReplacing(result)

  toggleRegexOption: ->
    @model.getFindOptions().toggleUseRegex()
    if @model.getFindOptions().useRegex then @regexOptionButton.addClass('selected') else @regexOptionButton.removeClass('selected')
    @updateOptionsLabel()
    @search(onlyRunIfActive: true)

  toggleCaseOption: ->
    @model.getFindOptions().toggleCaseSensitive()
    if @model.getFindOptions().caseSensitive then @caseOptionButton.addClass('selected') else @caseOptionButton.removeClass('selected')
    @updateOptionsLabel()
    @search(onlyRunIfActive: true)

  toggleWholeWordOption: ->
    @model.getFindOptions().toggleWholeWord()
    if @model.getFindOptions().wholeWord then @wholeWordOptionButton.addClass('selected') else @wholeWordOptionButton.removeClass('selected')
    @updateOptionsLabel()
    @search(onlyRunIfActive: true)

  focusNextElement: (direction) ->
    elements = [@findEditor, @replaceEditor, @pathsEditor]
    focusedElement = _.find elements, (el) -> el.hasClass('is-focused')
    focusedIndex = elements.indexOf focusedElement

    focusedIndex = focusedIndex + direction
    focusedIndex = 0 if focusedIndex >= elements.length
    focusedIndex = elements.length - 1 if focusedIndex < 0
    elements[focusedIndex].focus()
    elements[focusedIndex].getModel?().selectAll()

  focusFindElement: ->
    selectedText = atom.workspace.getActiveTextEditor()?.getSelectedText?()
    if selectedText and selectedText.indexOf('\n') < 0
      selectedText = Util.escapeRegex(selectedText) if @model.getFindOptions().useRegex
      @findEditor.setText(selectedText)
    @findEditor.focus()
    @findEditor.getModel().selectAll()

  confirm: ->
    if @findEditor.getText().length is 0
      @model.clear()
      return

    @findHistory.store()
    @replaceHistory.store()
    @pathsHistory.store()

    searchPromise = @search({@onlyRunIfChanged})
    @onlyRunIfChanged = true
    searchPromise

  search: ({onlyRunIfActive, onlyRunIfChanged}={}) ->
    return Promise.resolve() if onlyRunIfActive and not @model.active

    findPattern = @findEditor.getText()

    @clearMessages()
    @showResultPane().then =>
      try
        @model.search(findPattern, @getPaths(), @replaceEditor.getText(), {onlyRunIfChanged})
      catch e
        @setErrorMessage(e.message)

  replaceAll: ->
    return atom.beep() unless @model.matchCount
    findPattern = @model.getFindOptions().findPattern
    currentPattern = @findEditor.getText()
    if findPattern isnt currentPattern
      atom.confirm
        message: "The searched pattern '#{findPattern}' was changed to '#{currentPattern}'"
        detailedMessage: "Please run the search with the new pattern '#{currentPattern}' before running a replace-all"
        buttons: ['OK']
      return

    @showResultPane().then =>
      replacementPattern = @replaceEditor.getText()

      message = "This will replace '#{findPattern}' with '#{replacementPattern}' #{_.pluralize(@model.matchCount, 'time')} in #{_.pluralize(@model.pathCount, 'file')}"
      buttonChosen = atom.confirm
        message: 'Are you sure you want to replace all?'
        detailedMessage: message
        buttons: ['OK', 'Cancel']

      if buttonChosen is 0
        @clearMessages()
        @model.replace(@getPaths(), replacementPattern, @model.getPaths())

  getPaths: ->
    inputPath.trim() for inputPath in @pathsEditor.getText().trim().split(',') when inputPath

  directoryPathForElement: (element) ->
    elementPath = element?.dataset.path ? element?.querySelector('[data-path]')?.dataset.path

    # Traverse up the DOM if the element and its children don't have a path
    unless elementPath
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
      [rootPath, relPath] = atom.project.relativizePath(absPath)
      if rootPath? and atom.project.getDirectories().length > 1
        relPath = path.join(path.basename(rootPath), relPath)
      @pathsEditor.setText(relPath)
      @findEditor.focus()
      @findEditor.getModel().selectAll()

  showResultPane: ->
    options = {searchAllPanes: true}
    options.split = 'right' if atom.config.get('find-and-replace.openProjectFindResultsInRightPane')
    atom.workspace.open(ResultsPaneView.URI, options)

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

  updateReplaceAllButtonEnablement: (results) ->
    canReplace = results?.matchCount and results?.pattern is @findEditor.getText()
    @replaceAllButton[0].disabled = not canReplace

  updateOptionsLabel: ->
    label = []
    label.push('Regex') if @model.getFindOptions().useRegex
    if @model.getFindOptions().caseSensitive
      label.push('Case Sensitive')
    else
      label.push('Case Insensitive')
    label.push('Whole Word') if @model.getFindOptions().wholeWord
    @optionsLabel.text(label.join(', '))

  setSelectionAsFindPattern: =>
    editor = atom.workspace.getActivePaneItem()
    if editor?
      pattern = editor.getSelectedText() or editor.getWordUnderCursor()
      pattern = Util.escapeRegex(pattern) if @model.getFindOptions().useRegex
      @findEditor.setText(pattern) if pattern
