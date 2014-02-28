{Subscriber} = require 'emissary'

module.exports =
class Whitespace
  Subscriber.includeInto(this)

  constructor: ->
    atom.workspace.eachEditor (editor) =>
      @handleBufferEvents(editor)

  destroy: ->
    @unsubscribe()

  handleBufferEvents: (editor) ->
    buffer = editor.getBuffer()
    @subscribe buffer, 'will-be-saved', =>
      buffer.transact =>
        if atom.config.get('whitespace.removeTrailingWhitespace')
          @removeTrailingWhitespace(editor, editor.getGrammar().scopeName)

        if atom.config.get('whitespace.ensureSingleTrailingNewline')
          @ensureSingleTrailingNewline(buffer)

    @subscribe buffer, 'destroyed', =>
      @unsubscribe(buffer)

  removeTrailingWhitespace: (editor, grammarScopeName) ->
    buffer = editor.getBuffer()
    ignoreCurLine = atom.config.get('whitespace.ignoreWhitespaceOnCurrentLine')

    buffer.scan /[ \t]+$/g, ({lineText, match, replace}) ->
      whitespaceRow = buffer.positionForCharacterIndex(match.index).row
      cursorRow = editor.getCursor().getBufferRow()

      return if ignoreCurLine and whitespaceRow is cursorRow

      if grammarScopeName is 'source.gfm'
        # GitHub Flavored Markdown permits two spaces at the end of a line
        [whitespace] = match
        replace('') unless whitespace is '  ' and whitespace isnt lineText
      else
        replace('')

  ensureSingleTrailingNewline: (buffer) ->
    lastRow = buffer.getLastRow()
    if buffer.lineForRow(lastRow) is ''
      row = lastRow - 1
      buffer.deleteRow(row--) while row and buffer.lineForRow(row) is ''
    else
      buffer.append('\n')
