{_, $, $$$, EditorView, ScrollView} = require 'atom'
path = require 'path'
roaster = require 'roaster'
{extensionForFenceName} = require './extension-helper'

module.exports =
class MarkdownPreviewView extends ScrollView
  atom.deserializers.add(this)

  @deserialize: ({filePath}) ->
    new MarkdownPreviewView(filePath)

  @content: ->
    @div class: 'markdown-preview native-key-bindings', tabindex: -1

  initialize: (@filePath) ->
    super
    atom.project.bufferForPath(filePath).done (buffer) =>
      @buffer = buffer
      @renderMarkdown()
      @subscribe atom.syntax, 'grammar-added grammar-updated', _.debounce((=> @renderMarkdown()), 250)
      @on 'core:move-up', => @scrollUp()
      @on 'core:move-down', => @scrollDown()
      @subscribe @buffer, 'saved reloaded', =>
        @renderMarkdown()
        pane = @getPane()
        pane.showItem(this) if pane? and pane isnt atom.workspaceView.getActivePane()

  getPane: ->
    @parents('.pane').view()

  serialize: ->
    deserializer: 'MarkdownPreviewView'
    filePath: @getPath()

  getTitle: ->
    "#{path.basename(@getPath())} Preview"

  getUri: ->
    "markdown-preview://#{@getPath()}"

  getPath: ->
    @filePath

  setErrorHtml: (result) ->
    failureMessage = result?.message

    @html $$$ ->
      @h2 'Previewing Markdown Failed'
      @h3 failureMessage if failureMessage?

  setLoading: ->
    @html($$$ -> @div class: 'markdown-spinner', 'Loading Markdown...')

  tokenizeCodeBlocks: (html) =>
    html = $(html)
    preList = $(html.filter("pre"))

    for preElement in preList.toArray()
      $(preElement).addClass("editor-colors")
      codeBlock = $(preElement.firstChild)

      # go to next block unless this one has a class
      continue unless className = codeBlock.attr('class')

      fenceName = className.replace(/^lang-/, '')
      # go to next block unless the class name matches `lang`
      continue unless extension = extensionForFenceName(fenceName)
      text = codeBlock.text()

      grammar = atom.syntax.selectGrammar("foo.#{extension}", text)

      codeBlock.empty()
      for tokens in grammar.tokenizeLines(text)
        codeBlock.append(EditorView.buildLineHtml({ tokens, text }))

    html

  renderMarkdown: ->
    @setLoading()
    roaster @buffer.getText(), (err, html) =>
      if err
        @setErrorHtml(err)
      else
        @html(@tokenizeCodeBlocks(html))
