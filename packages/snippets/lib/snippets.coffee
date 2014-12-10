path = require 'path'

_ = require 'underscore-plus'
async = require 'async'
CSON = require 'season'
{File} = require 'pathwatcher'
fs = require 'fs-plus'

Snippet = require './snippet'
SnippetExpansion = require './snippet-expansion'

module.exports =
  loaded: false

  activate: ->
    atom.workspace.addOpener (uri) =>
      if uri is 'atom://.atom/snippets'
        atom.workspace.open(@getUserSnippetsPath())

    @loadAll()

    snippets = this

    atom.commands.add 'atom-text-editor',
      'snippets:expand': (event) ->
        editor = @getModel()
        if snippets.snippetToExpandUnderCursor(editor)
          snippets.clearExpansions(editor)
          snippets.expandSnippetsUnderCursors(editor)
        else
          event.abortKeyBinding()

      'snippets:next-tab-stop': (event) ->
        editor = @getModel()
        event.abortKeyBinding() unless snippets.goToNextTabStop(editor)

      'snippets:previous-tab-stop': (event) ->
        editor = @getModel()
        event.abortKeyBinding() unless snippets.goToPreviousTabStop(editor)

      'snippets:available': (event) ->
        editor = @getModel()
        SnippetsAvailable = require './snippets-available'
        snippets.availableSnippetsView ?= new SnippetsAvailable(snippets)
        snippets.availableSnippetsView.toggle(editor)

    atom.workspace.observeTextEditors (editor) =>
      @clearExpansions(editor)

  deactivate: ->
    @userSnippetsFile?.off()
    @editorSnippetExpansions?.clear()

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

    CSON.readFile filePath, (error, object={}) =>
      if error?
        console.warn "Error reading snippets file '#{filePath}': #{error.stack ? error}"
        atom.notifications?.addError("Failed to load snippets from '#{filePath}'", {detail: error.stack, closable: true})
      else
        @add(filePath, object)
      callback?()

  add: (filePath, snippetsBySelector) ->
    for selector, snippetsByName of snippetsBySelector
      snippetsByPrefix = {}
      for name, attributes of snippetsByName
        {prefix, body, bodyTree} = attributes
        continue if typeof body isnt 'string'

        # if `add` isn't called by the loader task (in specs for example), we need to parse the body
        bodyTree ?= @getBodyParser().parse(body)
        snippet = new Snippet({name, prefix, bodyTree, bodyText: body})
        snippetsByPrefix[snippet.prefix] = snippet
      atom.syntax.addProperties(filePath, selector, snippets: snippetsByPrefix)

  getBodyParser: ->
    @bodyParser ?= require './snippet-body-parser'

  getPrefixText: (snippets, editor) ->
    wordRegex = @wordRegexForSnippets(snippets)
    cursors = editor.getCursors()
    for cursor in cursors
      prefixStart = cursor.getBeginningOfCurrentWordBufferPosition({wordRegex})
      editor.getTextInRange([prefixStart, cursor.getBufferPosition()])

  # Get a RegExp of all the characters used in the snippet prefixes
  wordRegexForSnippets: (snippets) ->
    prefixes = {}
    for prefix of snippets
      prefixes[character] = true for character in prefix
    prefixCharacters = Object.keys(prefixes).join('')
    new RegExp("[#{_.escapeRegExp(prefixCharacters)}]+")

  # Get the best match snippet for the given prefix text.  This will return
  # the longest match where there is no exact match to the prefix text.
  snippetForPrefix: (snippets, prefix) ->
    longestPrefixMatch = null

    for snippetPrefix, snippet of snippets
      if snippetPrefix is prefix
        longestPrefixMatch = snippet
        break
      else if _.endsWith(prefix, snippetPrefix)
        longestPrefixMatch ?= snippet
        if snippetPrefix.length > longestPrefixMatch.prefix.length
          longestPrefixMatch = snippet

    longestPrefixMatch

  getSnippets: (editor) ->
    scope = editor.getLastCursor().getScopeDescriptor()
    snippets = {}
    for properties in atom.syntax.propertiesForScope(scope, 'snippets')
      snippetProperties = _.valueForKeyPath(properties, 'snippets') ? {}
      for snippetPrefix, snippet of snippetProperties
        snippets[snippetPrefix] ?= snippet
    snippets

  snippetToExpandUnderCursor: (editor) ->
    return false unless editor.getLastSelection().isEmpty()
    snippets = @getSnippets(editor)
    return false if _.isEmpty(snippets)

    prefix = @getPrefixText(snippets, editor)
    return false unless prefix and _.uniq(prefix).length is 1

    prefix = prefix[0]
    @snippetForPrefix(snippets, prefix)

  expandSnippetsUnderCursors: (editor) ->
    return false unless snippet = @snippetToExpandUnderCursor(editor)

    editor.transact =>
      cursors = editor.getCursors()
      for cursor in cursors
        cursorPosition = cursor.getBufferPosition()
        startPoint = cursorPosition.translate([0, -snippet.prefix.length], [0, 0])
        cursor.selection.setBufferRange([startPoint, cursorPosition])
        @insert(snippet, editor, cursor)
    true

  goToNextTabStop: (editor) ->
    nextTabStopVisited = false
    for expansion in @getExpansions(editor)
      if expansion?.goToNextTabStop()
        nextTabStopVisited = true
    nextTabStopVisited

  goToPreviousTabStop: (editor) ->
    previousTabStopVisited = false
    for expansion in @getExpansions(editor)
      if expansion?.goToPreviousTabStop()
        previousTabStopVisited = true
    previousTabStopVisited

  getExpansions: (editor) ->
    @editorSnippetExpansions?.get(editor) ? []

  clearExpansions: (editor) ->
    @editorSnippetExpansions ?= new WeakMap()
    @editorSnippetExpansions.set(editor, [])

  addExpansion: (editor, snippetExpansion) ->
    @getExpansions(editor).push(snippetExpansion)

  insert: (snippet, editor=atom.workspace.getActiveTextEditor(), cursor=editor.getLastCursor()) ->
    if typeof snippet is 'string'
      bodyTree = @getBodyParser().parse(snippet)
      snippet = new Snippet({name: '__anonymous', prefix: '', bodyTree, bodyText: snippet})

    new SnippetExpansion(snippet, editor, cursor, this)
