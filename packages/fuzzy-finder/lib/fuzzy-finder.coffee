_ = require 'underscore'

module.exports =
  projectPaths: null
  fuzzyFinderView: null
  loadPathsTask: null

  activate: (state) ->
    rootView.command 'fuzzy-finder:toggle-file-finder', =>
      @createView().toggleFileFinder()
    rootView.command 'fuzzy-finder:toggle-buffer-finder', =>
      @createView().toggleBufferFinder()
    rootView.command 'fuzzy-finder:find-under-cursor', =>
      @createView().findUnderCursor()
    rootView.command 'fuzzy-finder:toggle-git-status-finder', =>
      @createView().toggleGitFinder()

    if project.getPath()?
      PathLoader = require './path-loader'
      @loadPathsTask = PathLoader.startTask (paths) => @projectPaths = paths

    for editSession in project.getEditSessions()
      editSession.lastOpened = state[editSession.getPath()]

  deactivate: ->
    if @loadPathsTask?
      @loadPathsTask.terminate()
      @loadPathsTask = null
    if @fuzzyFinderView?
      @fuzzyFinderView.cancel()
      @fuzzyFinderView.remove()
      @fuzzyFinderView = null
    @projectPaths = null

  serialize: ->
    if @fuzzyFinderView?
      paths = {}
      for editSession in project.getEditSessions()
        path = editSession.getPath()
        paths[path] = editSession.lastOpened if path?
      paths

  createView:  ->
    unless @fuzzyFinderView
      @loadPathsTask?.terminate()
      FuzzyFinderView  = require './fuzzy-finder-view'
      @fuzzyFinderView = new FuzzyFinderView(@projectPaths)
    @fuzzyFinderView
