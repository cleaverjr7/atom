{ScrollView} = require 'atom'
fs = require 'fs-plus'
humanize = require 'humanize-plus'
archive = require 'ls-archive'

FileView = require './file-view'
DirectoryView = require './directory-view'

module.exports =
class ArchiveEditorView extends ScrollView
  @content: ->
    @div class: 'archive-editor', tabindex: -1, =>
      @div class: 'archive-container', =>
        @div outlet: 'loadingMessage', class: 'padded icon icon-hourglass text-info', 'Loading archive\u2026'
        @div class: 'inset-panel', =>
          @div outlet: 'summary', class: 'panel-heading'
          @ol outlet: 'tree', class: 'archive-tree padded list-tree has-collapsable-children'

  initialize: (editor) ->
    super

    @setModel(editor)

    @on 'focus', =>
      @focusSelectedFile()
      false

  setPath: (path) ->
    if path and @path isnt path
      @path = path
      @refresh()

  refresh: ->
    @summary.hide()
    @tree.hide()
    @loadingMessage.show()

    originalPath = @path
    archive.list @path, tree: true, (error, entries) =>
      return unless originalPath is @path

      if error?
        console.error("Error listing archive file: #{@path}", error.stack ? error)
      else
        @loadingMessage.hide()
        @createTreeEntries(entries)
        @updateSummary()

  createTreeEntries: (entries) ->
    @tree.empty()

    for entry in entries
      if entry.isDirectory()
        @tree.append(new DirectoryView(@path, entry))
      else
        @tree.append(new FileView(@path, entry))

    @tree.show()
    @tree.find('.file').view()?.select()

  updateSummary: ->
    fileCount = @tree.find('.file').length
    fileLabel = if fileCount is 1 then "1 file" else "#{humanize.intComma(fileCount)} files"

    directoryCount = @tree.find('.directory').length
    directoryLabel = if directoryCount is 1 then "1 folder" else "#{humanize.intComma(directoryCount)} folders"

    @summary.text("#{humanize.fileSize(fs.getSizeSync(@path))} with #{fileLabel} and #{directoryLabel}").show()

  focusSelectedFile: ->
    @tree.find('.selected').view()?.focus()

  focus: ->
    @focusSelectedFile()

  setModel: (editor) ->
    @unsubscribe(@editor) if @editor
    if editor
      @editor = editor
      @setPath(editor.getPath())
      editor.file.on 'contents-changed', =>
        @refresh()
      editor.file.on 'removed', =>
        @parents('.pane').view()?.destroyItem(editor)
