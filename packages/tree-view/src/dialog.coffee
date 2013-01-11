{View, $$} = require 'space-pen'
Editor = require 'editor'
fs = require 'fs'
$ = require 'jquery'

module.exports =
class Dialog extends View
  @content: ({prompt} = {}) ->
    @div class: 'tree-view-dialog', =>
      @div outlet: 'prompt', class: 'prompt', =>
        @span prompt, outlet: 'promptText'
      @subview 'miniEditor', new Editor(mini: true)

  initialize: ({path, @onConfirm, select, iconClass} = {}) ->
    @prompt.addClass(iconClass) if iconClass
    @miniEditor.focus()
    @on 'core:confirm', => @onConfirm(@miniEditor.getText())
    @on 'core:cancel', => @cancel()
    @miniEditor.on 'focusout', => @remove()

    @miniEditor.setText(path)

    if select
      extension = fs.extension(path)
      baseName = fs.base(path)
      range = [[0, path.length - baseName.length], [0, path.length - extension.length]]
      @miniEditor.setSelectedBufferRange(range)

  close: ->
    @remove()
    $('#root-view').focus()

  cancel: ->
    @remove()
    $('.tree-view').focus()

  showError: (message) ->
    @promptText.text(message)
    @flashError()
