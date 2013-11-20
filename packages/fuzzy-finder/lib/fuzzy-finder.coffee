{_} = require 'atom'

module.exports =
  projectPaths: null
  fuzzyFinderView: null
  loadPathsTask: null

  activate: (state) ->
    atom.rootView.command 'fuzzy-finder:toggle-file-finder', =>
      @createView().toggleFileFinder()
    atom.rootView.command 'fuzzy-finder:toggle-buffer-finder', =>
      @createView().toggleBufferFinder()
    atom.rootView.command 'fuzzy-finder:toggle-git-status-finder', =>
      @createView().toggleGitFinder()

    if atom.project.getPath()?
      PathLoader = require './path-loader'
      @loadPathsTask = PathLoader.startTask (paths) => @projectPaths = paths

    for editSession in atom.project.getEditSessions()
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
      for editSession in atom.project.getEditSessions()
        path = editSession.getPath()
        paths[path] = editSession.lastOpened if path?
      paths

  createView:  ->
    unless @fuzzyFinderView?
      @loadPathsTask?.terminate()
      FuzzyFinderView  = require './fuzzy-finder-view'
      @fuzzyFinderView = new FuzzyFinderView(@projectPaths)
      @projectPaths = null
    @fuzzyFinderView
