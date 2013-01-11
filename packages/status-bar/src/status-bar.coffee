_ = require 'underscore'
{View, $$} = require 'space-pen'
$ = require 'jquery'

module.exports =
class StatusBar extends View
  @activate: (rootView) ->
    for editor in rootView.getEditors()
      @appendToEditorPane(rootView, editor) if rootView.parents('html').length

    rootView.on 'editor:attached', (e, editor) =>
      @appendToEditorPane(rootView, editor)

  @appendToEditorPane: (rootView, editor) ->
    if pane = editor.pane()
      pane.append(new StatusBar(rootView, editor))

  @content: ->
    @div class: 'status-bar', =>
      @span class: 'git-branch', outlet: 'branchArea', =>
        @span class: 'octicons branch-icon'
        @span class: 'branch-label', outlet: 'branchLabel'
        @span class: 'git-status', outlet: 'gitStatusIcon'
      @span class: 'file-info', =>
        @span class: 'current-path', outlet: 'currentPath'
        @span class: 'buffer-modified', outlet: 'bufferModified'
      @span class: 'cursor-position', outlet: 'cursorPosition'
      @span class: 'grammar-name', outlet: 'grammarName'

  initialize: (@rootView, @editor) ->
    @updatePathText()
    @editor.on 'editor:path-changed', =>
      @subscribeToBuffer()
      @updatePathText()

    @updateCursorPositionText()
    @subscribe @editor, 'cursor:moved', => @updateCursorPositionText()
    @subscribe $(window), 'focus', => @updateStatusBar()
    @subscribe @grammarName, 'click', => @editor.trigger 'editor:select-grammar'
    @subscribe @editor, 'editor:grammar-changed', => @updateGrammarText()

    @subscribeToBuffer()

  subscribeToBuffer: ->
    @buffer?.off '.status-bar'
    @buffer = @editor.getBuffer()
    @buffer.on 'contents-modified.status-bar', (e) => @updateBufferHasModifiedText(e.differsFromDisk)
    @buffer.on 'saved.status-bar', => @updateStatusBar()
    @buffer.on 'git-status-changed.status-bar', => @updateStatusBar()
    @updateStatusBar()

  updateStatusBar: ->
    @updateGrammarText()
    @updateBranchText()
    @updateBufferHasModifiedText(@buffer.isModified())
    @updateStatusText()

  updateGrammarText: ->
    @grammarName.text(@editor.getGrammar().name)

  updateBufferHasModifiedText: (differsFromDisk)->
    if differsFromDisk
      @bufferModified.text('*') unless @isModified
      @isModified = true
    else
      @bufferModified.text('') if @isModified
      @isModified = false

  updateBranchText: ->
    path = @editor.getPath()
    @branchArea.hide()
    return unless path

    head = @buffer.getRepo()?.getShortHead() or ''
    @branchLabel.text(head)
    @branchArea.show() if head

  updateStatusText: ->
    path = @editor.getPath()
    @gitStatusIcon.removeClass()
    return unless path

    @gitStatusIcon.addClass('git-status octicons')
    git = @buffer.getRepo()
    return unless git

    status = git.getPathStatus(path)
    if git.isStatusModified(status)
      @gitStatusIcon.addClass('modified-status-icon')
      stats = git.getDiffStats(path)
      if stats.added and stats.deleted
        @gitStatusIcon.text("+#{stats.added},-#{stats.deleted}")
      else if stats.added
        @gitStatusIcon.text("+#{stats.added}")
      else if stats.deleted
        @gitStatusIcon.text("-#{stats.deleted}")
      else
        @gitStatusIcon.text('')
    else if git.isStatusNew(status)
      @gitStatusIcon.addClass('new-status-icon')
      @gitStatusIcon.text("+#{@buffer.getLineCount()}")

  updatePathText: ->
    if path = @editor.getPath()
      @currentPath.text(@rootView.project.relativize(path))
    else
      @currentPath.text('untitled')

  updateCursorPositionText: ->
    { row, column } = @editor.getCursorBufferPosition()
    @cursorPosition.text("#{row + 1},#{column + 1}")
