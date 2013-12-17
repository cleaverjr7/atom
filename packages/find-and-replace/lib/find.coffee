FindModel = require './find-model'
FindView = require './find-view'
ProjectFindView = require './project-find-view'
ResultsModel = require './project/results-model'
ResultsPaneView = require './project/results-pane'
{_, $, $$} = require 'atom'

module.exports =
  configDefaults:
    openProjectFindResultsInRightPane: false

  activate: ({viewState, projectViewState, resultsModelState, paneViewState}={}) ->
    atom.project.registerOpener (filePath) =>
      new ResultsPaneView() if filePath is ResultsPaneView.URI

    atom.workspaceView.command 'project-find:show', =>
      @createProjectFindView(projectViewState, resultsModelState)
      @findView?.detach()
      @projectFindView.attach()

    atom.workspaceView.command 'project-find:show-in-current-directory', (e) =>
      @createProjectFindView(projectViewState, resultsModelState)
      @findView?.detach()
      @projectFindView.attach()
      @projectFindView.findInCurrentlySelectedDirectory($(e.target))

    atom.workspaceView.command 'find-and-replace:use-selection-as-find-pattern', =>
      return if @projectFindView?.isOnDom() or @findView?.isOnDom()

      @createFindView(viewState)
      @projectFindView?.detach()
      @findView.showFind()

    atom.workspaceView.command 'find-and-replace:show', =>
      @createFindView(viewState)
      @projectFindView?.detach()
      @findView.showFind()

    atom.workspaceView.command 'find-and-replace:show-replace', =>
      @createFindView(viewState)
      @projectFindView?.detach()
      @findView.showReplace()

    # in code editors
    atom.workspaceView.on 'core:cancel core:close', (event) =>
      target = $(event.target)
      editor = target.parents('.editor:not(.mini)')
      return unless editor.length

      @findView?.detach()
      @projectFindView?.detach()

  createProjectFindView: (projectViewState, resultsModelState) ->
    @resultsModel ?= new ResultsModel(resultsModelState)
    @projectFindView ?= new ProjectFindView(@resultsModel, projectViewState)

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

  createFindView: (viewState) ->
    @findView ?= new FindView(viewState)

  deactivate: ->
    @findView?.remove()
    @findView = null

    @projectFindView?.remove()
    @projectFindView = null

  serialize: ->
    viewState: @findView.serialize()
    projectViewState: @projectFindView.serialize()
    resultsModelState: @resultsModel.serialize()
