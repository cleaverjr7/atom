{View} = require 'atom'
path = require 'path'

module.exports =
class TabView extends View
  @content: ->
    @li class: 'tab sortable', =>
      @div class: 'title', outlet: 'title'
      @div class: 'close-icon'

  initialize: (@item, @pane) ->
    @titleSubscription = @item.onDidChangeTitle? =>
      @updateDataAttributes()
      @updateTitle()
      @updateTooltip()

    @iconSubscription = @item.onDidChangeIcon? =>
      @updateIcon()

    @modifiedSubscription = @item.onDidChangeModified? =>
      @updateModifiedStatus()

    @configSubscription = atom.config.observe 'tabs.showIcons', =>
      @updateIconVisibility()

    @updateDataAttributes()
    @updateTitle()
    @updateIcon()
    @updateModifiedStatus()
    @setupTooltip()

  setupTooltip: ->
    # Defer creating the tooltip until the tab is moused over
    onMouseEnter = =>
      @mouseEnterSubscription.dispose()
      @hasBeenMousedOver = true
      @updateTooltip()
      @trigger 'mouseenter' # Trigger again so the tooltip shows

    @mouseEnterSubscription = dispose: =>
      @element.removeEventListener('mouseenter', onMouseEnter)
      @mouseEnterSubscription = null

    @element.addEventListener('mouseenter', onMouseEnter)

  updateTooltip: ->
    return unless @hasBeenMousedOver

    @destroyTooltip()

    if itemPath = @item.getPath?()
      @setTooltip
        title: itemPath
        html: false
        delay:
          show: 2000
          hide: 100
        placement: 'bottom'

  beforeRemove: ->
    @titleSubscription?.dispose()
    @modifiedSubscription?.dispose()
    @iconSubscription?.dispose()
    @mouseEnterSubscription?.dispose()
    @configSubscription?.off() # Not a Disposable yet

    @destroyTooltip() if @hasBeenMousedOver

  updateDataAttributes: ->
    if itemPath = @item.getPath?()
      @title.element.dataset.name = path.basename(itemPath)
      @title.element.dataset.path = itemPath

  updateTitle: ({updateSiblings, useLongTitle}={}) ->
    return if @updatingTitle
    @updatingTitle = true

    if updateSiblings is false
      title = @item.getTitle()
      title = @item.getLongTitle?() ? title if useLongTitle
      @title.text(title)
    else
      title = @item.getTitle()
      useLongTitle = false
      for tab in @getSiblingTabs()
        if tab.item.getTitle() is title
          tab.updateTitle(updateSiblings: false, useLongTitle: true)
          useLongTitle = true
      title = @item.getLongTitle?() ? title if useLongTitle

      @title.text(title)

    @updatingTitle = false

  updateIcon: ->
    if @iconName
      @title.element.classList.remove('icon', "icon-#{@iconName}")

    if @iconName = @item.getIconName?()
      @title.element.classList.add('icon', "icon-#{@iconName}")

  getSiblingTabs: ->
    @siblings('.tab').views()

  updateIconVisibility: ->
    if atom.config.get 'tabs.showIcons'
      @title.element.classList.remove('hide-icon')
    else
      @title.element.classList.add('hide-icon')

  updateModifiedStatus: ->
    if @item.isModified?()
      @element.classList.add('modified') unless @isModified
      @isModified = true
    else
      @element.classList.remove('modified') if @isModified
      @isModified = false
