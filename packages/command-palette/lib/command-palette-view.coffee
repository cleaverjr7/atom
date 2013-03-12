{$$} = require 'space-pen'
SelectList = require 'select-list'
$ = require 'jquery'
_ = require 'underscore'

module.exports =
class CommandPaletteView extends SelectList
  @activate: ->
    new CommandPaletteView

  @viewClass: ->
    "#{super} command-palette overlay from-top"

  filterKey: 'eventDescription'

  previouslyFocusedElement: null
  keyBindings: null

  initialize: ->
    super

    rootView.command 'command-palette:toggle', => @toggle()

  toggle: ->
    if @hasParent()
      @cancel()
    else
      @attach()

  attach: ->
    super

    @keyBindings = _.losslessInvert(keymap.bindingsForElement(@previouslyFocusedElement))

    events = []
    for eventName, eventDescription of _.extend($(window).events(), @previouslyFocusedElement.events())
      events.push({eventName, eventDescription}) if eventDescription

    events = _.sortBy events, (e) -> e.eventDescription

    @setArray(events)
    @appendTo(rootView)
    @miniEditor.focus()

  itemForElement: ({eventName, eventDescription}) ->
    keyBindings = @keyBindings
    $$ ->
      @li class: 'event', 'data-event-name': eventName, =>
        @span eventDescription, class: 'label', title: eventName
        @div class: 'right', =>
          for binding in keyBindings[eventName] ? []
            @kbd binding, class: 'key-binding'

  confirmed: ({eventName}) ->
    @cancel()
    @previouslyFocusedElement.trigger(eventName)
