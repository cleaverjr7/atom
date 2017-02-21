_ = require 'underscore-plus'
{CompositeDisposable} = require 'atom'
{$, ScrollView} = require 'atom-space-pen-views'
ResultView = require './result-view'

module.exports =
class ResultsView extends ScrollView
  @content: ->
    @ol class: 'results-view list-tree focusable-panel has-collapsable-children', tabindex: -1

  initialize: (@model) ->
    commandsDisposable = super()
    commandsDisposable.dispose() # turn off default scrolling behavior from ScrollView

    @pixelOverdraw = 100
    @lastRenderedResultIndex = 0

    @on 'mousedown', '.path', (e) =>
      @find('.selected').removeClass('selected')
      view = $(e.target).view()
      view.find('.match-line:first').addClass('selected')
      if not e.ctrlKey
        if e.originalEvent?.detail is 1
          view.confirm(pending: true)
        else if e.originalEvent?.detail is 2
          view.confirm() unless view instanceof ResultView
        e.preventDefault()
      @renderResults()

    @on 'scroll', => @renderResults()
    @on 'resize', => @renderResults()

  attached: ->
    @subscriptions = new CompositeDisposable
    @subscriptions.add atom.commands.add @element,
      'core:move-down': =>
        @userMovedSelection = true
        @selectNextResult()
      'core:move-up': =>
        @userMovedSelection = true
        @selectPreviousResult()
      'core:move-left': => @collapseResult()
      'core:move-right': => @expandResult()
      'core:page-up': => @selectPreviousPage()
      'core:page-down': => @selectNextPage()
      'core:move-to-top': =>
        @selectFirstResult()
      'core:move-to-bottom': =>
        @renderResults(renderAll: true)
        @selectLastResult()
      'core:confirm': =>
        @find('.selected').view()?.confirm?()
        false
      'core:copy': =>
        @find('.selected').view()?.copy?()
        false
      'find-and-replace:copy-path': =>
        @find('.selected').view()?.copyPath?()
        false

    @subscriptions.add @model.onDidAddResult @addResult
    @subscriptions.add @model.onDidRemoveResult @removeResult
    @subscriptions.add @model.onDidClearSearchState @clear

    @renderResults()

  detached: ->
    @clear()
    @subscriptions.dispose()

  hasResults: ->
    @model.getResultCount() > 0

  addResult: ({filePath, result, filePathInsertedIndex}) =>
    resultView = @getResultView(filePath)
    return resultView.renderResult(result) if resultView

    if filePathInsertedIndex? and (filePathInsertedIndex < @lastRenderedResultIndex or @shouldRenderMoreResults())
      children = @children()
      resultView = new ResultView(@model, filePath, result)

      if children.length is 0 or filePathInsertedIndex is children.length
        @append(resultView)
      else if filePathInsertedIndex is 0
        @prepend(resultView)
      else
        @element.insertBefore(resultView.element, children[filePathInsertedIndex])

      @lastRenderedResultIndex++

    @selectFirstResult() if not @userMovedSelection or @getPathCount() is 1

  removeResult: ({filePath}) =>
    @getResultView(filePath)?.remove()

  renderResults: ({renderAll, renderNext}={}) ->
    return unless renderAll or renderNext or @shouldRenderMoreResults()

    initialIndex = @lastRenderedResultIndex

    paths = @model.getPaths()
    for filePath in paths[@lastRenderedResultIndex..]
      result = @model.getResult(filePath)
      if not renderAll and not renderNext and not @shouldRenderMoreResults()
        break
      else if renderNext is @lastRenderedResultIndex - @lastRenderedResultIndex
        break
      resultView = new ResultView(@model, filePath, result)
      @append(resultView)
      @lastRenderedResultIndex++

    null # dont return an array

  shouldRenderMoreResults: ->
    @prop('scrollHeight') <= @height() + @pixelOverdraw or @prop('scrollHeight') <= @scrollBottom() + @pixelOverdraw

  selectFirstResult: ->
    @selectResult(@find('.search-result:first'))
    @scrollToTop()

  selectLastResult: ->
    @selectResult(@find('.search-result:last'))
    @scrollToBottom()

  selectPreviousPage: ->
    selectedItem = @find('.selected')
    selectedView = selectedItem.view()
    return @selectFirstResult() unless selectedView

    if selectedView.hasClass('path')
      itemHeight = selectedView.find('.path-details').outerHeight()
    else
      itemHeight = selectedItem.outerHeight()
    pageHeight = @innerHeight()
    linesPerPage = Math.round(pageHeight / itemHeight)
    pageHeight = linesPerPage * itemHeight # so it's divisible by the number of lines

    visibleItems = @find('li:visible')
    index = visibleItems.index(selectedItem)

    previousIndex = Math.max(index - linesPerPage , 0)
    previousView = $(visibleItems[previousIndex]).view()

    @selectResult(previousView)
    @scrollTop(@scrollTop() - pageHeight)
    @scrollTo(previousView) # just in case the scrolltop misses the mark

  selectNextPage: ->
    selectedItem = @find('.selected')
    selectedView = selectedItem.view()
    return @selectFirstResult() unless selectedView

    if selectedView.hasClass('path')
      itemHeight = selectedView.find('.path-details').outerHeight()
    else
      itemHeight = selectedItem.outerHeight()
    pageHeight = @innerHeight()
    linesPerPage = Math.round(pageHeight / itemHeight)
    pageHeight = linesPerPage * itemHeight # so it's divisible by the number of lines

    visibleItems = @find('li:visible')
    index = visibleItems.index(selectedItem)

    nextIndex = Math.min(index + linesPerPage, visibleItems.length - 1)
    nextView = $(visibleItems[nextIndex]).view()

    # determine number of moved-by results for rendering
    visibleResults = @find('li:not(.list-item):visible')
    resultIndex = visibleResults.index(selectedView)
    nextResultIndex = visibleResults.index(nextView)
    @renderResults(renderNext: nextResultIndex - resultIndex + 1)

    @selectResult(nextView)
    @scrollTop(@scrollTop() + pageHeight)
    @scrollTo(nextView) # just in case the scrolltop misses the mark

  selectNextResult: ->
    selectedView = @find('.selected').view()
    return @selectFirstResult() unless selectedView

    nextView = @getNextVisible(selectedView)

    @selectResult(nextView)
    @scrollTo(nextView)

  selectPreviousResult: ->
    selectedView = @find('.selected').view()
    return @selectFirstResult() unless selectedView

    prevView = @getPreviousVisible(selectedView)

    @selectResult(prevView)
    @scrollTo(prevView)

  getNextVisible: (element) ->
    return unless element?.length
    visibleItems = @find('li:not(.list-item):visible')
    itemIndex = visibleItems.index(element)
    $(visibleItems[Math.min(itemIndex + 1, visibleItems.length - 1)])

  getPreviousVisible: (element) ->
    return unless element?.length
    visibleItems = @find('li:not(.list-item):visible')
    itemIndex = visibleItems.index(element)
    $(visibleItems[Math.max(itemIndex - 1, 0)])

  selectResult: (resultView) ->
    return unless resultView?.length
    @find('.selected').removeClass('selected')

    unless resultView.hasClass('path')
      resultView = resultView.find('.match-line')
      parentView = resultView.closest('.path')
      resultView = parentView if parentView.hasClass('collapsed')

    resultView.addClass('selected')

  collapseResult: ->
    parent = @find('.selected').closest('.path').view()
    parent.expand(false) if parent instanceof ResultView
    @renderResults()

  collapseAllResults: ->
    @renderResults(renderAll: true) # without this, not all views will be affected
    @find('.path').views().forEach(
      (view) -> view.expand(false)
    )

  expandResult: ->
    selectedView = @find('.selected').view()
    selectedView.expand(true) if selectedView instanceof ResultView
    @renderResults()

  expandAllResults: ->
    @renderResults(renderAll: true) # without this, not all views will be affected
    @find('.path').views().forEach(
      (view) -> view.expand(true)
    )

  getPathCount: ->
    @model.getPathCount()

  getMatchCount: ->
    @model.getMatchCount()

  clear: =>
    @userMovedSelection = false
    @lastRenderedResultIndex = 0
    @empty()

  scrollTo: (element) ->
    return unless element?.length
    top = @scrollTop() + element.offset().top - @offset().top
    bottom = top + element.outerHeight()

    @scrollBottom(bottom) if bottom > @scrollBottom()
    @scrollTop(top) if top < @scrollTop()

  scrollToBottom: ->
    @renderResults(renderAll: true)
    super()

  scrollToTop: ->
    super()

  getResultView: (filePath) ->
    el = @find("[data-path=\"#{_.escapeAttribute(filePath)}\"]")
    if el.length then el.view() else null
