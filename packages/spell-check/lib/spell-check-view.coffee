_ = require 'underscore-plus'
{View} = require 'atom'
MisspellingView = require './misspelling-view'
SpellCheckTask = require './spell-check-task'

module.exports =
class SpellCheckView extends View
  @content: ->
    @div class: 'spell-check'

  initialize: (@editor) ->
    @views = []
    @task = new SpellCheckTask()

    @subscribe @editor, 'path-changed grammar-changed', =>
      @subscribeToBuffer()

    @subscribe atom.config.observe 'editor.fontSize', callNow: false, =>
      @subscribeToBuffer()
    @subscribe atom.config.observe 'spell-check.grammars', callNow: false, =>
      @subscribeToBuffer()

    @subscribeToBuffer()

    @subscribe @editor.onDidDestroy(@destroy.bind(this))

  destroy: ->
    @unsubscribeFromBuffer()
    @task.terminate()

  unsubscribeFromBuffer: ->
    @destroyViews()

    if @buffer?
      @unsubscribe(@buffer)
      @buffer = null

  subscribeToBuffer: ->
    @unsubscribeFromBuffer()

    if @spellCheckCurrentGrammar()
      @buffer = @editor.getBuffer()
      @subscribe @buffer, 'contents-modified', =>
        @updateMisspellings()
      @updateMisspellings()

  spellCheckCurrentGrammar: ->
    grammar = @editor.getGrammar().scopeName
    _.contains(atom.config.get('spell-check.grammars'), grammar)

  destroyViews: ->
    while view = @views.shift()
      view.destroy()

  addViews: (misspellings) ->
    for misspelling in misspellings
      view = new MisspellingView(misspelling, @editor)
      @views.push(view)

  updateMisspellings: ->
    # Task::start can throw errors atom/atom#3326
    try
      @task.start @buffer.getText(), (misspellings) =>
        @destroyViews()
        @addViews(misspellings) if @buffer?
    catch error
      console.warn('Error starting spell check task', error.stack ? error)
