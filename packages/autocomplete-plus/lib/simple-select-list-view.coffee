{$, View} = require "atom"
_ = require "underscore-plus"

Keys =
  Escape: 27
  Enter: 13
  Tab: 9

class SimpleSelectListView extends View
  eventsAttached: false
  maxItems: 10
  @content: ->
    @div class: "select-list", =>
      @input class: "hidden-input", outlet: "hiddenInput"
      @ol class: "list-group", outlet: "list"

  ###
   * Listens to events, delegates them to instance methods
   * @private
  ###
  initialize: ->
    # Core events for keyboard handling
    @on "core:move-up", (e) => @selectPreviousItemView()
    @on "core:move-down", => @selectNextItemView()
    @on "core:confirm", => @confirmSelection()
    @on "core:cancel", => @cancel()

    # List mouse events
    @list.on "mousedown", "li", (e) =>
      e.preventDefault()
      e.stopPropagation()

      @selectItemView $(e.target).closest("li")

    @list.on "mouseup", "li", (e) =>
      e.preventDefault()
      e.stopPropagation()

      if $(e.target).closest("li").hasClass "selected"
        @confirmSelection()

  ###
   * Selects the previous item view
   * @private
  ###
  selectPreviousItemView: ->
    view = @getSelectedItemView().prev()
    unless view.length
      view = @list.find "li:last"
    @selectItemView view

  ###
   * Selects the next item view
   * @private
  ###
  selectNextItemView: ->
    view = @getSelectedItemView().next()
    unless view.length
      view = @list.find "li:first"
    @selectItemView view

  ###
   * Sets the items, displays the list
   * @param {Array} items
   * @private
  ###
  setItems: (items=[]) ->
    @items = items
    @populateList()

  ###
   * Unselects all views, selects the given view
   * @param  {jQuery} view
   * @private
  ###
  selectItemView: (view) ->
    return unless view.length

    @list.find(".selected").removeClass "selected"
    view.addClass "selected"
    @scrollToItemView view

  ###
   * Sets the scroll position to match the given view's position
   * @param  {jQuery} view
   * @private
  ###
  scrollToItemView: (view) ->
    scrollTop = @list.scrollTop()
    desiredTop = view.position().top + scrollTop
    desiredBottom = desiredTop + view.outerHeight()

    if desiredTop < scrollTop
      @list.scrollTop desiredTop
    else
      @list.scrollBottom desiredBottom

  ###
   * Returns the currently selected item view
   * @return {jQuery}
   * @private
  ###
  getSelectedItemView: ->
    @list.find "li.selected"

  ###
   * Returns the currently selected item (NOT the view)
   * @return {Object}
   * @private
  ###
  getSelectedItem: ->
    @getSelectedItemView().data "select-list-item"

  ###*
   * Confirms the currently selected item or cancels the list view
   * if no item has been selected
   * @private
  ###
  confirmSelection: ->
    item = @getSelectedItem()
    if item?
      @confirmed item
    else
      @cancel()

  ###
   * Focuses the hidden input, starts listening to keyboard events
   * @private
  ###
  setActive: ->
    @hiddenInput.focus()

    unless @eventsAttached
      @eventsAttached = true

      @hiddenInput.keydown (e) =>
        switch e.keyCode
          when Keys.Enter, Keys.Tab
            @trigger "core:confirm"
          when Keys.Escape
            @trigger "core:cancel"

        if e.keyCode in _.values Keys
          return false

  ###
   * Re-builds the list with the current items
   * @private
  ###
  populateList: ->
    return unless @items?

    @list.empty()
    for i in [0...Math.min(@items.length, @maxItems)]
      item = @items[i]
      itemView = @viewForItem item
      $(itemView).data "select-list-item", item
      @list.append itemView

    @selectItemView @list.find "li:first"

  cancel: ->
    @list.empty()
    @detach()

module.exports = SimpleSelectListView
