{View, $$} = require 'space-pen'
SelectList = require 'select-list'
_ = require 'underscore'
$ = require 'jquery'
fs = require 'fs'

module.exports =
class FuzzyFinder extends SelectList
  filenameRegex: /([^\w\.\-\/\\])/

  @activate: (rootView) ->
    @instance = new FuzzyFinder(rootView)
    rootView.command 'fuzzy-finder:toggle-file-finder', => @instance.toggleFileFinder()
    rootView.command 'fuzzy-finder:toggle-buffer-finder', => @instance.toggleBufferFinder()
    rootView.command 'fuzzy-finder:find-under-cursor', => @instance.findUnderCursor()

  @viewClass: ->
    [super, 'fuzzy-finder'].join(' ')

  allowActiveEditorChange: null
  maxItems: 10
  projectPaths: null
  reloadProjectPaths: true

  initialize: (@rootView) ->
    super

    @subscribe $(window), 'focus', => @reloadProjectPaths = true
    @observeConfig 'fuzzy-finder.ignoredNames', => @reloadProjectPaths = true

    @miniEditor.command 'editor:split-left', =>
      @splitOpenPath (editor, session) -> editor.splitLeft(session)
    @miniEditor.command 'editor:split-right', =>
      @splitOpenPath (editor, session) -> editor.splitRight(session)
    @miniEditor.command 'editor:split-down', =>
      @splitOpenPath (editor, session) -> editor.splitDown(session)
    @miniEditor.command 'editor:split-up', =>
      @splitOpenPath (editor, session) -> editor.splitUp(session)

  itemForElement: (path) ->
    $$ ->
      @li =>
        ext = fs.extension(path)
        if fs.isCompressedExtension(ext)
          typeClass = 'compressed-name'
        else if fs.isImageExtension(ext)
          typeClass = 'image-name'
        else if fs.isPdfExtension(ext)
          typeClass = 'pdf-name'
        else
          typeClass = 'text-name'
        @span fs.base(path), class: "file #{typeClass}"
        if folder = fs.directory(path)
          @span "- #{folder}/", class: 'directory'

  openPath: (path) ->
    @rootView.open(path, {@allowActiveEditorChange}) if path

  splitOpenPath: (fn) ->
    path = @getSelectedElement()
    return unless path

    editor = @rootView.getActiveEditor()
    if editor
      fn(editor, @rootView.project.buildEditSessionForPath(path))
    else
      @openPath(path)

  confirmed : (path) ->
    return unless path.length
    if fs.isFile(rootView.project.resolve(path))
      @cancel()
      @openPath(path)
    else
      @setError('Selected path does not exist')
      setTimeout((=> @setError()), 2000)

  cancelled: ->
    @miniEditor.setText('')
    @rootView.focus() if @miniEditor.isFocused

  toggleFileFinder: ->
    if @hasParent()
      @cancel()
    else
      return unless @rootView.project.getPath()?
      @allowActiveEditorChange = false
      @populateProjectPaths()
      @attach()

  toggleBufferFinder: ->
    if @hasParent()
      @cancel()
    else
      @allowActiveEditorChange = true
      @populateOpenBufferPaths()
      @attach() if @paths?.length

  findUnderCursor: ->
    if @hasParent()
      @cancel()
    else
      return unless @rootView.project.getPath()?
      @allowActiveEditorChange = false
      theWord = @rootView.getActiveEditor()
        .getCursor().getCurrentWord(wordRegex: @filenameRegex)
      if theWord?
        @populateProjectPaths(filter: theWord, done: (paths) =>
          if paths?.length == 1
            @rootView.open(paths[0])
          else
            @attach() if paths?.length
            @miniEditor.setText(theWord))

  populateProjectPaths: (options = {}) ->
    if @projectPaths?.length > 0
      listedItems =
        if options.filter?
          @projectPaths.filter (path) ->
            return path.indexOf(options.filter) >= 0
        else
          @projectPaths
      @setArray(listedItems)
      options.done(listedItems) if options.done?
    else
      @setLoading("Indexing...")

    if @reloadProjectPaths
      @rootView.project.getFilePaths().done (paths) =>
        ignoredNames = config.get("fuzzyFinder.ignoredNames") or []
        ignoredNames = ignoredNames.concat(config.get("core.ignoredNames") or [])
        @projectPaths = paths
        if ignoredNames
          @projectPaths = @projectPaths.filter (path) ->
            for segment in path.split("/")
              return false if _.contains(ignoredNames, segment)
            return true

        @reloadProjectPaths = false
        listedItems =
          if options.filter?
            @projectPaths.filter (path) ->
              return path.indexOf(options.filter) >= 0
          else
            @projectPaths

        @setArray(listedItems)
        debugger
        options.done(listedItems) if options.done?

  populateOpenBufferPaths: ->
    @paths = @rootView.getOpenBufferPaths().map (path) =>
      @rootView.project.relativize(path)
    @setArray(@paths)

  attach: ->
    @rootView.append(this)
    @miniEditor.focus()
