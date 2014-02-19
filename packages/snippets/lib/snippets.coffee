path = require 'path'

async = require 'async'
CSON = require 'season'
{File} = require 'pathwatcher'
fs = require 'fs-plus'

Snippet = require './snippet'
SnippetExpansion = require './snippet-expansion'

module.exports =
  loaded: false

  activate: ->
    atom.project.registerOpener (uri) =>
      if uri is 'atom://.atom/snippets'
        atom.workspaceView.open(@getUserSnippetsPath())

    @loadAll()
    atom.workspaceView.eachEditorView (editorView) =>
      @enableSnippetsInEditor(editorView) if editorView.attached

  deactivate: ->
    @userSnippetsFile?.off()

  getUserSnippetsPath: ->
    userSnippetsPath = CSON.resolve(path.join(atom.getConfigDirPath(), 'snippets'))
    userSnippetsPath ? path.join(atom.getConfigDirPath(), 'snippets.cson')

  loadAll: ->
    @loadBundledSnippets => @loadUserSnippets => @loadPackageSnippets()

  loadBundledSnippets: (callback) ->
    bundledSnippetsPath = CSON.resolve(path.join(__dirname, 'snippets'))
    @loadSnippetsFile(bundledSnippetsPath, callback)

  loadUserSnippets: (callback) ->
    @userSnippetsFile?.off()
    userSnippetsPath = @getUserSnippetsPath()
    fs.stat userSnippetsPath, (error, stat) =>
      if stat?.isFile()
        @userSnippetsFile = new File(userSnippetsPath)
        @userSnippetsFile.on 'moved removed contents-changed', =>
          atom.syntax.removeProperties(userSnippetsPath)
          @loadUserSnippets()
        @loadSnippetsFile(userSnippetsPath, callback)
      else
        callback?()

  loadPackageSnippets: ->
    packages = atom.packages.getLoadedPackages()
    snippetsDirPaths = []
    snippetsDirPaths.push(path.join(pack.path, 'snippets')) for pack in packages
    async.eachSeries snippetsDirPaths, @loadSnippetsDirectory.bind(this), @doneLoading.bind(this)

  doneLoading: ->
    atom.packages.emit 'snippets:loaded'
    @loaded = true

  loadSnippetsDirectory: (snippetsDirPath, callback) ->
    return callback?() unless fs.isDirectorySync(snippetsDirPath)

    fs.readdir snippetsDirPath, (error, entries) =>
      if error?
        console.warn(error)
        callback?()
      else
        paths = entries.map (file) -> path.join(snippetsDirPath, file)
        async.eachSeries(paths, @loadSnippetsFile.bind(this), callback)

  loadSnippetsFile: (filePath, callback) ->
    return callback?() unless CSON.isObjectPath(filePath)

    CSON.readFile filePath, (error, object) =>
      if error?
        console.warn "Error reading snippets file '#{filePath}': #{error.stack ? error}"
      else
        @add(filePath, @translateTextmateSnippet(object))
      callback?()

  translateTextmateSnippet: (snippet={}) ->
    {scope, name, content, tabTrigger} = snippet

    # Treat it as an Atom snippet if none of the TextMate snippet fields
    # are present
    return snippet unless scope or name or content or tabTrigger

    scope = atom.syntax.cssSelectorFromScopeSelector(scope) if scope
    scope ?= '*'
    snippetsByScope = {}
    snippetsByName = {}
    snippetsByScope[scope] = snippetsByName
    snippetsByName[name] = { prefix: tabTrigger, body: content }
    snippetsByScope

  add: (filePath, snippetsBySelector) ->
    for selector, snippetsByName of snippetsBySelector
      snippetsByPrefix = {}
      for name, attributes of snippetsByName
        { prefix, body, bodyTree } = attributes
        # if `add` isn't called by the loader task (in specs for example), we need to parse the body
        bodyTree ?= @getBodyParser().parse(body)
        snippet = new Snippet({name, prefix, bodyTree, bodyText: body})
        snippetsByPrefix[snippet.prefix] = snippet
      atom.syntax.addProperties(filePath, selector, snippets: snippetsByPrefix)

  getBodyParser: ->
    @bodyParser ?= require './snippet-body-parser'

  enableSnippetsInEditor: (editorView) ->
    editor = editorView.getEditor()
    editorView.command 'snippets:expand', (e) =>
      unless editor.getSelection().isEmpty()
        e.abortKeyBinding()
        return

      prefix = editor.getCursor().getCurrentWordPrefix()
      if snippet = atom.syntax.getProperty(editor.getCursorScopes(), "snippets.#{prefix}")
        editor.transact ->
          new SnippetExpansion(snippet, editor)
      else
        e.abortKeyBinding()

    editorView.command 'snippets:next-tab-stop', (e) ->
      unless editor.snippetExpansion?.goToNextTabStop()
        e.abortKeyBinding()

    editorView.command 'snippets:previous-tab-stop', (e) ->
      unless editor.snippetExpansion?.goToPreviousTabStop()
        e.abortKeyBinding()
