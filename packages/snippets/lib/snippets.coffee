{_, fs} = require 'atom'
path = require 'path'
SnippetExpansion = require './snippet-expansion'
Snippet = require './snippet'
CSON = require 'season'
async = require 'async'

module.exports =
  snippetsByExtension: {}
  loaded: false

  activate: ->
    @loadAll()
    atom.workspaceView.eachEditorView (editorView) =>
      @enableSnippetsInEditor(editorView) if editorView.attached

  loadAll: ->
    packages = atom.packages.getLoadedPackages()
    packages.push(path: atom.getConfigDirPath())
    async.eachSeries packages, @loadSnippetsFromPackage.bind(this), @doneLoading.bind(this)

  doneLoading: ->
    @loaded = true

  loadSnippetsFromPackage: (pack, done) ->
    if pack.getType?() is 'textmate'
      @loadTextMateSnippets(pack.path, done)
    else
      @loadAtomSnippets(pack.path, done)

  loadAtomSnippets: (packagePath, done) ->
    snippetsDirPath = path.join(packagePath, 'snippets')
    return done() unless fs.isDirectorySync(snippetsDirPath)

    loadSnippetFile = (filename, done) =>
      return done() if filename.indexOf('.') is 0
      filepath = path.join(snippetsDirPath, filename)
      CSON.readFile filepath, (err, object) =>
        if err
          console.warn "Error reading snippets file '#{filepath}': #{err.stack}"
        else
          @add(object)
        done()

    fs.readdir snippetsDirPath, (err, paths) ->
      async.eachSeries(paths, loadSnippetFile, done)

  loadTextMateSnippets: (bundlePath, done) ->
    snippetsDirPath = path.join(bundlePath, 'Snippets')
    if not fs.isDirectorySync(snippetsDirPath)
      snippetsDirPath = path.join(bundlePath, "snippets")

    return done() unless fs.isDirectorySync(snippetsDirPath)

    loadSnippetFile = (filename, done) =>
      return done() if filename.indexOf('.') is 0

      filepath = path.join(snippetsDirPath, filename)

      logError = (err) ->
        console.warn "Error reading snippets file '#{filepath}': #{err.stack ? err}"

      try
        fs.readObject filepath, (err, object) =>
          try
            if err
              logError(err)
            else
              @add(@translateTextmateSnippet(object))
          catch err
            logError(err)
          finally
            done()
      catch err
        logError(err)
        done()

    fs.readdir snippetsDirPath, (err, paths) ->
      if err
        console.warn err
        return done()
      async.eachSeries(paths, loadSnippetFile, done)

  translateTextmateSnippet: (snippet) ->
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

  add: (snippetsBySelector) ->
    for selector, snippetsByName of snippetsBySelector
      snippetsByPrefix = {}
      for name, attributes of snippetsByName
        { prefix, body, bodyTree } = attributes
        # if `add` isn't called by the loader task (in specs for example), we need to parse the body
        bodyTree ?= @getBodyParser().parse(body)
        snippet = new Snippet({name, prefix, bodyTree})
        snippetsByPrefix[snippet.prefix] = snippet
      atom.syntax.addProperties(selector, snippets: snippetsByPrefix)

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
