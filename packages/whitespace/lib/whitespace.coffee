{CompositeDisposable} = require 'atom'

module.exports =
class Whitespace
  constructor: ->
    @subscriptions = new CompositeDisposable
    @subscriptions.add atom.workspace.observeTextEditors (editor) =>
      @handleEvents(editor)

    @subscriptions.add atom.commands.add 'atom-workspace',
      'whitespace:remove-trailing-whitespace': =>
        if editor = atom.workspace.getActiveTextEditor()
          @removeTrailingWhitespace(editor, editor.getGrammar().scopeName)
      'whitespace:convert-tabs-to-spaces': =>
        if editor = atom.workspace.getActiveTextEditor()
          @convertTabsToSpaces(editor)
      'whitespace:convert-spaces-to-tabs': =>
        if editor = atom.workspace.getActiveTextEditor()
          @convertSpacesToTabs(editor)

  destroy: ->
    @subscriptions.dispose()

  handleEvents: (editor) ->
    buffer = editor.getBuffer()
    bufferSavedSubscription = buffer.onWillSave =>
      buffer.transact =>
        scopeDescriptor = editor.getRootScopeDescriptor()
        if atom.config.get('whitespace.removeTrailingWhitespace', scope: scopeDescriptor)
          @removeTrailingWhitespace(editor, editor.getGrammar().scopeName)
        if atom.config.get('whitespace.ensureSingleTrailingNewline', scope: scopeDescriptor)
          @ensureSingleTrailingNewline(editor)

    editorTextInsertedSubscription = editor.onDidInsertText (event) ->
      return unless event.text is '\n'
      return unless buffer.isRowBlank(event.range.start.row)

      scopeDescriptor = editor.getRootScopeDescriptor()
      if atom.config.get('whitespace.removeTrailingWhitespace', scope: scopeDescriptor)
        unless atom.config.get('whitespace.ignoreWhitespaceOnlyLines', scope: scopeDescriptor)
          editor.setIndentationForBufferRow(event.range.start.row, 0)

    editorDestroyedSubscription = editor.onDidDestroy =>
      bufferSavedSubscription.dispose()
      editorTextInsertedSubscription.dispose()
      editorDestroyedSubscription.dispose()

      @subscriptions.remove(bufferSavedSubscription)
      @subscriptions.remove(editorTextInsertedSubscription)
      @subscriptions.remove(editorDestroyedSubscription)

    @subscriptions.add(bufferSavedSubscription)
    @subscriptions.add(editorTextInsertedSubscription)
    @subscriptions.add(editorDestroyedSubscription)

  removeTrailingWhitespace: (editor, grammarScopeName) ->
    buffer = editor.getBuffer()
    scopeDescriptor = editor.getRootScopeDescriptor()
    ignoreCurrentLine = atom.config.get('whitespace.ignoreWhitespaceOnCurrentLine', scope: scopeDescriptor)
    ignoreWhitespaceOnlyLines = atom.config.get('whitespace.ignoreWhitespaceOnlyLines', scope: scopeDescriptor)

    buffer.backwardsScan /[ \t]+$/g, ({lineText, match, replace}) ->
      whitespaceRow = buffer.positionForCharacterIndex(match.index).row
      cursorRows = (cursor.getBufferRow() for cursor in editor.getCursors())

      return if ignoreCurrentLine and whitespaceRow in cursorRows

      [whitespace] = match
      return if ignoreWhitespaceOnlyLines and whitespace is lineText

      if grammarScopeName is 'source.gfm' and atom.config.get('whitespace.keepMarkdownLineBreakWhitespace')
        # GitHub Flavored Markdown permits two or more spaces at the end of a line
        replace('') unless whitespace.length >= 2 and whitespace isnt lineText
      else
        replace('')

  ensureSingleTrailingNewline: (editor) ->
    buffer = editor.getBuffer()
    lastRow = buffer.getLastRow()

    if buffer.lineForRow(lastRow) is ''
      row = lastRow - 1
      buffer.deleteRow(row--) while row and buffer.lineForRow(row) is ''
    else
      selectedBufferRanges = editor.getSelectedBufferRanges()
      buffer.append('\n')
      editor.setSelectedBufferRanges(selectedBufferRanges)

  convertTabsToSpaces: (editor) ->
    buffer = editor.getBuffer()
    spacesText = new Array(editor.getTabLength() + 1).join(' ')
	
    buffer.transact ->
      buffer.scan /\t/g, ({replace}) -> replace(spacesText)

    editor.setSoftTabs(true)

  convertSpacesToTabs: (editor) ->
    buffer = editor.getBuffer()
    scope = editor.getRootScopeDescriptor()
    fileTabSize = editor.getTabLength()
    userTabSize = atom.config.get 'editor.tabLength', {scope}

    if atom.config.get 'whitespace.convertLeadingSpacesOnly', {scope}
      regex = new RegExp '^(?: {' + fileTabSize + '})+', 'g'
      iterator = ({matchText, replace}) ->
        replace '\t'.repeat(matchText.length / fileTabSize)

    else
      regex = new RegExp ' '.repeat(fileTabSize), 'g'
      iterator = ({replace}) -> replace('\t')

    buffer.transact ->
      buffer.scan regex, iterator

    editor.setSoftTabs(false)
    editor.setTabLength(userTabSize) unless fileTabSize is userTabSize
