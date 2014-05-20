path = require 'path'
{$$, Point, SelectListView} = require 'atom'
fs = require 'fs-plus'

module.exports =
class SymbolsView extends SelectListView
  @activate: ->
    new SymbolsView

  initialize: (@stack) ->
    super
    @addClass('symbols-view overlay from-top')

  destroy: ->
    @cancel()
    @remove()

  getFilterKey: -> 'name'

  viewForItem: ({position, name, file}) ->
    $$ ->
      @li class: 'two-lines', =>
        @div name, class: 'primary-line'
        if position
          text = "Line #{position.row + 1}"
        else
          text = path.basename(file)
        @div text, class: 'secondary-line'

  getEmptyMessage: (itemCount) ->
    if itemCount is 0
      'No symbols found'
    else
      super

  confirmed : (tag) ->
    if tag.file and not fs.isFileSync(atom.project.resolve(tag.file))
      @setError('Selected file does not exist')
      setTimeout((=> @setError()), 2000)
    else
      @cancel()
      @openTag(tag)

  openTag: (tag) ->
    if editor = atom.workspace.getActiveEditor()
      previous =
        position: editor.getCursorBufferPosition()
        file: editor.getUri()

    {position} = tag
    position = @getTagLine(tag) unless position
    if tag.file
      atom.workspaceView.open(tag.file).done =>
        @moveToPosition(position) if position
    else if position
      @moveToPosition(position)

    @afterTagOpen?(previous) if previous?

  moveToPosition: (position, beginningOfLine=true) ->
    editorView = atom.workspaceView.getActiveView()
    if editor = editorView.getEditor?()
      editorView.scrollToBufferPosition(position, center: true)
      editor.setCursorBufferPosition(position)
      editor.moveCursorToFirstCharacterOfLine() if beginningOfLine

  attach: ->
    @storeFocusedElement()
    atom.workspaceView.appendToTop(this)
    @focusFilterEditor()

  getTagLine: (tag) ->
    # Remove leading /^ and trailing $/
    pattern = tag.pattern?.replace(/(^^\/\^)|(\$\/$)/g, '').trim()

    return unless pattern
    file = atom.project.resolve(tag.file)
    return unless fs.isFileSync(file)
    for line, index in fs.readFileSync(file, 'utf8').split('\n')
      return new Point(index, 0) if pattern is line.trim()
