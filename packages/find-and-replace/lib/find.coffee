{$} = require 'atom'
{Subscriber} = require 'emissary'

_ = require 'underscore-plus'

SelectNext = require './select-next'
{HistoryData} = require './history'
FindModel = require './find-model'
FindView = require './find-view'
ProjectFindView = require './project-find-view'
ResultsModel = require './project/results-model'
ResultsPaneView = require './project/results-pane'

module.exports =
  configDefaults:
    focusEditorAfterSearch: false
    openProjectFindResultsInRightPane: false

  activate: ({@viewState, @projectViewState, @resultsModelState, @modelState, findHistory, replaceHistory, pathsHistory}={}) ->
    atom.workspace.registerOpener (filePath) =>
      new ResultsPaneView() if filePath is ResultsPaneView.URI

    @subscriber = new Subscriber()
    @findModel = new FindModel(@modelState)
    @findHistory = new HistoryData(findHistory)
    @replaceHistory = new HistoryData(replaceHistory)
    @pathsHistory = new HistoryData(pathsHistory)

    @subscriber.subscribeToCommand atom.workspaceView, 'project-find:show', =>
      @createViews()
      @findView?.detach()
      @projectFindView.attach()

    @subscriber.subscribeToCommand atom.workspaceView, 'project-find:toggle', =>
      @createViews()
      @findView?.detach()

      if @projectFindView.hasParent()
        @projectFindView.detach()
      else
        @projectFindView.attach()

    @subscriber.subscribeToCommand atom.workspaceView, 'project-find:show-in-current-directory', (e) =>
      @createViews()
      @findView?.detach()
      @projectFindView.attach()
      @projectFindView.findInCurrentlySelectedDirectory($(e.target))

    @subscriber.subscribeToCommand atom.workspaceView, 'find-and-replace:use-selection-as-find-pattern', =>
      return if @projectFindView?.isOnDom() or @findView?.isOnDom()

      @createViews()
      @projectFindView?.detach()
      @findView.showFind()

    @subscriber.subscribeToCommand atom.workspaceView, 'find-and-replace:toggle', =>
      @createViews()
      @projectFindView?.detach()

      if @findView.hasParent()
        @findView.detach()
      else
        @findView.showFind()

    @subscriber.subscribeToCommand atom.workspaceView, 'find-and-replace:show', =>
      @createViews()
      @projectFindView?.detach()
      @findView.showFind()

    @subscriber.subscribeToCommand atom.workspaceView, 'find-and-replace:show-replace', =>
      @createViews()
      @projectFindView?.detach()
      @findView.showReplace()

    # in code editors
    @subscriber.subscribeToCommand atom.workspaceView, 'core:cancel core:close', ({target}) =>
      if target isnt atom.workspaceView.getActivePaneView()?[0]
        editor = $(target).parents('.editor:not(.mini)')
        return unless editor.length

      @findView?.detach()
      @projectFindView?.detach()

    atom.workspaceView.eachEditorView (editorView) ->
      selectNext = new SelectNext(editorView.editor)
      editorView.command 'find-and-replace:select-next', ->
        selectNext.findAndSelectNext()
      editorView.command 'find-and-replace:select-all', ->
        selectNext.findAndSelectAll()

  createViews: ->
    @findView ?= new FindView(@findModel, _.extend({}, @viewState, {@findHistory, @replaceHistory}))

    @resultsModel ?= new ResultsModel(@resultsModelState)
    @projectFindView ?= new ProjectFindView(@findModel, @resultsModel, _.extend({}, @projectViewState, {@findHistory, @replaceHistory, @pathsHistory}))

    # HACK: Soooo, we need to get the model to the pane view whenever it is
    # created. Creation could come from the opener below, or, more problematic,
    # from a deserialize call when splitting panes. For now, all pane views will
    # use this same model. This needs to be improved! I dont know the best way
    # to deal with this:
    # 1. How should serialization work in the case of a shared model.
    # 2. Or maybe we create the model each time a new pane is created? Then
    #    ProjectFindView needs to know about each model so it can invoke a search.
    #    And on each new model, it will run the search again.
    #
    # See https://github.com/atom/find-and-replace/issues/63
    ResultsPaneView.model = @resultsModel

  deactivate: ->
    @findView?.remove()
    @findView = null

    @findModel = null

    @projectFindView?.remove()
    @projectFindView = null

    ResultsPaneView.model = null
    @resultsModel = null

    @subscriber?.unsubscribe()
    @subscriber = null

  serialize: ->
    viewState: @findView?.serialize() ? @viewState
    modelState: @findModel?.serialize() ? @modelState
    projectViewState: @projectFindView?.serialize() ? @projectViewState
    resultsModelState: @resultsModel?.serialize() ? @resultsModelState
    findHistory: @findHistory.serialize()
    replaceHistory: @replaceHistory.serialize()
    pathsHistory: @replaceHistory.serialize()
