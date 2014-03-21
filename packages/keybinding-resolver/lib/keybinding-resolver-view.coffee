_ = require 'underscore-plus'
{$, $$, View} = require 'atom'
Humanize = require 'humanize-plus'

module.exports =
class KeybindingResolverView extends View
  @content: ->
    @div class: 'keybinding-resolver tool-panel pannel panel-bottom padding', =>
      @div class: 'panel-heading padded', =>
        @span 'Keybinding Resolver: '
        @span outlet: 'keystroke', 'Press any key'
      @div outlet: 'commands', class: 'panel-body padded'

  initialize: ({attached})->
    @attach() if attached

    atom.workspaceView.command 'keybinding-resolver:toggle', => @toggle()
    atom.workspaceView.command 'core:cancel core:close', => @detach()

    @on 'click', '.source', (event) -> atom.workspaceView.open(event.target.innerText)

  serialize: ->
    attached: @hasParent()

  destroy: ->
    @detach()

  toggle: ->
    if @hasParent()
      @detach()
    else
      @attach()

  attach: ->
    atom.workspaceView.prependToBottom(this)
    $(document).preempt 'keydown', @handleEvent

  detach: ->
    super
    $(document).off 'keydown', @handleEvent

  handleEvent: (event) =>
    keystroke = atom.keymap.keystrokeStringForEvent(event)
    keyBindings = atom.keymap.keyBindingsForKeystroke(keystroke)
    matchedKeyBindings = atom.keymap.keyBindingsMatchingElement(document.activeElement, keyBindings)
    unmatchedKeyBindings = keyBindings.filter (binding) ->
      for matchedBinding in matchedKeyBindings
        return false if _.isEqual(matchedBinding, binding)
      true

    keyBindingsLength = Object.keys(keyBindings).length
    @keystroke.html $$ ->
      @span class: 'keystroke', keystroke

    createListItem = (classString, binding) ->
      @tr class: classString, =>
        @td class: 'command', binding.command
        @td class: 'selector', binding.selector
        @td class: 'source', binding.source

    @commands.html $$ ->
      @table class: 'table-condensed', =>
        for binding, index in matchedKeyBindings
          classString = 'matched'
          classString += ' selected text-success' if index == 0
          createListItem.call this, classString, binding

        for binding in unmatchedKeyBindings
          classString = 'unmatched text-subtle'
          createListItem.call this, classString, binding
