$ = require 'jquery'
SortableList = require 'sortable-list'
Tab = require './tab'

module.exports =
class TabView extends SortableList
  @activate: ->
    rootView.eachEditor (editor) =>
      @prependToEditorPane(editor) if editor.attached

  @prependToEditorPane: (editor) ->
    if pane = editor.pane()
      pane.prepend(new TabView(editor))

  @content: ->
    @ul class: "tabs #{@viewClass()}"

  initialize: (@editor) ->
    super

    @addTabForEditSession(editSession) for editSession in @editor.editSessions

    @setActiveTab(@editor.getActiveEditSessionIndex())
    @editor.on 'editor:active-edit-session-changed', (e, editSession, index) => @setActiveTab(index)
    @editor.on 'editor:edit-session-added', (e, editSession) => @addTabForEditSession(editSession)
    @editor.on 'editor:edit-session-removed', (e, editSession, index) => @removeTabAtIndex(index)

    @on 'click', '.tab', (e) =>
      @editor.setActiveEditSessionIndex($(e.target).closest('.tab').index())
      @editor.focus()

    @on 'click', '.tab .close-icon', (e) =>
      index = $(e.target).closest('.tab').index()
      @editor.destroyEditSessionIndex(index)
      false

  addTabForEditSession: (editSession) ->
    @append(new Tab(editSession, @editor))

  setActiveTab: (index) ->
    @find(".tab.active").removeClass('active')
    @find(".tab:eq(#{index})").addClass('active')

  removeTabAtIndex: (index) ->
    @find(".tab:eq(#{index})").remove()

  containsEditSession: (editor, editSession) ->
    for session in editor.editSessions
      return true if editSession.getPath() is session.getPath()

  shouldAllowDrag: (event) ->
    panes = rootView.find('.pane')
    !(panes.length == 1 && panes.find('.sortable').length == 1)

  onDragStart: (event) =>
    super

    pane = $(event.target).closest('.pane')
    paneIndex = rootView.indexOfPane(pane)
    event.originalEvent.dataTransfer.setData 'from-pane-index', paneIndex

  onDrop: (event) =>
    super

    transfer = event.originalEvent.dataTransfer
    previousDraggedTabIndex = transfer.getData 'sortable-index'

    fromPaneIndex = ~~transfer.getData 'from-pane-index'
    toPaneIndex   = rootView.indexOfPane($(event.target).closest('.pane'))
    fromPane      = $(rootView.find('.pane')[fromPaneIndex])
    fromEditor    = fromPane.find('.editor').view()

    if fromPaneIndex == toPaneIndex
      toPane   = fromPane
      toEditor = fromEditor
    else
      toPane = $(rootView.find('.pane')[toPaneIndex])
      toEditor = toPane.find('.editor').view()

    droppedNearTab = @getSortableElement(event)
    draggedTab     = fromPane.find(".#{TabView.viewClass()} .sortable:eq(#{previousDraggedTabIndex})")

    return if draggedTab.is(droppedNearTab)
    if fromPaneIndex != toPaneIndex
      return if @containsEditSession(toEditor, fromEditor.editSessions[draggedTab.index()])

    draggedTab.remove()
    draggedTab.insertAfter(droppedNearTab)
    currentDraggedTabIndex = draggedTab.index()
    fromEditor.transferEditSessionAtIndex(previousDraggedTabIndex, currentDraggedTabIndex, toEditor)

    if !fromPane.find('.tab').length
      fromPane.view().remove()
    else if fromPaneIndex != toPaneIndex && draggedTab.hasClass('active')
      fromEditor.setActiveEditSessionIndex(0)

    @setActiveTab(currentDraggedTabIndex)
    toEditor.setActiveEditSessionIndex(currentDraggedTabIndex)
    toEditor.focus()
