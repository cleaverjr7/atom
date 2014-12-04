path = require 'path'
_ = require 'underscore-plus'
{CompositeDisposable, Emitter} = require 'event-kit'
fs = require 'fs-plus'
PathWatcher = require 'pathwatcher'
File = require './file'

realpathCache = {}

module.exports =
class Directory
  constructor: ({@name, fullPath, @symlink, @expandedEntries, @isExpanded, @isRoot, @ignoredPatterns}) ->
    @emitter = new Emitter()
    @subscriptions = new CompositeDisposable()

    @path = fullPath
    @realPath = @path
    if fs.isCaseInsensitive()
      @lowerCasePath = @path.toLowerCase()
      @lowerCaseRealPath = @lowerCasePath

    @isRoot ?= false
    @isExpanded ?= false
    @expandedEntries ?= {}
    @status = null
    @entries = {}

    @submodule = atom.project.getRepo()?.isSubmodule(@path)

    @subscribeToRepo()
    @updateStatus()
    @loadRealPath()

  destroy: ->
    @unwatch()
    @subscriptions.dispose()
    @emitter.emit('did-destroy')

  onDidDestroy: (callback) ->
    @emitter.on('did-destroy', callback)

  onDidStatusChange: (callback) ->
    @emitter.on('did-status-change', callback)

  onDidAddEntries: (callback) ->
    @emitter.on('did-add-entries', callback)

  onDidRemoveEntries: (callback) ->
    @emitter.on('did-remove-entries', callback)

  loadRealPath: ->
    fs.realpath @path, realpathCache, (error, realPath) =>
      if realPath and realPath isnt @path
        @realPath = realPath
        @lowerCaseRealPath = @realPath.toLowerCase() if fs.isCaseInsensitive()
        @updateStatus()

  # Subscribe to project's repo for changes to the Git status of this directory.
  subscribeToRepo: ->
    repo = atom.project.getRepo()
    return unless repo?

    @subscriptions.add repo.onDidChangeStatus (event) =>
      @updateStatus(repo) if event.path.indexOf("#{@path}#{path.sep}") is 0
    @subscriptions.add repo.onDidChangeStatuses =>
      @updateStatus(repo)

  # Update the status property of this directory using the repo.
  updateStatus: ->
    repo = atom.project.getRepo()
    return unless repo?

    newStatus = null
    if repo.isPathIgnored(@path)
      newStatus = 'ignored'
    else
      status = repo.getDirectoryStatus(@path)
      if repo.isStatusModified(status)
        newStatus = 'modified'
      else if repo.isStatusNew(status)
        newStatus = 'added'

    if newStatus isnt @status
      @status = newStatus
      @emitter.emit('did-status-change', newStatus)

  # Is the given path ignored?
  isPathIgnored: (filePath) ->
    if atom.config.get('tree-view.hideVcsIgnoredFiles')
      repo = atom.project.getRepo()
      return true if repo? and repo.isProjectAtRoot() and repo.isPathIgnored(filePath)

    if atom.config.get('tree-view.hideIgnoredNames')
      for ignoredPattern in @ignoredPatterns
        return true if ignoredPattern.match(filePath)

    false

  # Does given full path start with the given prefix?
  isPathPrefixOf: (prefix, fullPath) ->
    fullPath.indexOf(prefix) is 0 and fullPath[prefix.length] is path.sep

  isPathEqual: (pathToCompare) ->
    @path is pathToCompare or @realPath is pathToCompare

  # Public: Does this directory contain the given path?
  #
  # See atom.Directory::contains for more details.
  contains: (pathToCheck) ->
    return false unless pathToCheck

    # Normalize forward slashes to back slashes on windows
    pathToCheck = pathToCheck.replace(/\//g, '\\') if process.platform is 'win32'

    if fs.isCaseInsensitive()
      directoryPath = @lowerCasePath
      pathToCheck = pathToCheck.toLowerCase()
    else
      directoryPath = @path

    return true if @isPathPrefixOf(directoryPath, pathToCheck)

    # Check real path
    if @realPath isnt @path
      if fs.isCaseInsensitive()
        directoryPath = @lowerCaseRealPath
      else
        directoryPath = @realPath

      return @isPathPrefixOf(directoryPath, pathToCheck)

    false

  # Public: Stop watching this directory for changes.
  unwatch: ->
    if @watchSubscription?
      @watchSubscription.close()
      @watchSubscription = null

    for key, entry of @entries
      entry.destroy()
      delete @entries[key]

  # Public: Watch this directory for changes.
  watch: ->
    try
      @watchSubscription ?= PathWatcher.watch @path, (eventType) =>
        switch eventType
          when 'change' then @reload()
          when 'delete' then @destroy()

  getEntries: ->
    try
      names = fs.readdirSync(@path)
    catch error
      names = []

    names.sort (name1, name2) -> name1.toLowerCase().localeCompare(name2.toLowerCase())

    files = []
    directories = []

    for name in names
      fullPath = path.join(@path, name)
      continue if @isPathIgnored(fullPath)

      stat = fs.lstatSyncNoException(fullPath)
      symlink = stat.isSymbolicLink?()
      stat = fs.statSyncNoException(fullPath) if symlink

      if stat.isDirectory?()
        if @entries.hasOwnProperty(name)
          # push a placeholder since this entry already exists but this helps
          # track the insertion index for the created views
          directories.push(name)
        else
          expandedEntries = @expandedEntries[name]
          isExpanded = expandedEntries?
          directories.push(new Directory({name, fullPath, symlink, isExpanded, expandedEntries, @ignoredPatterns}))
      else if stat.isFile?()
        if @entries.hasOwnProperty(name)
          # push a placeholder since this entry already exists but this helps
          # track the insertion index for the created views
          files.push(name)
        else
          files.push(new File({name, fullPath, symlink, realpathCache}))

    combined = directories.concat(files)

    combined.sort (first, second) ->
      firstName = first.name
      unless firstName?
        firstName = first
      unless firstName?
        firstName = firstName.toLowerCase()

      secondName = second.name
      unless secondName?
        secondName = second
      unless secondName?
        secondName = secondName.toLowerCase()

      firstName.localeCompare(secondName)
      
  # Public: Perform a synchronous reload of the directory.
  reload: ->
    newEntries = []
    removedEntries = _.clone(@entries)
    index = 0

    for entry in @getEntries()
      if @entries.hasOwnProperty(entry)
        delete removedEntries[entry]
        index++
        continue

      entry.indexInParentDirectory = index
      index++
      newEntries.push(entry)

    entriesRemoved = false
    for name, entry of removedEntries
      entriesRemoved = true
      entry.destroy()
      delete @entries[name]
      delete @expandedEntries[name]
    @emitter.emit('did-remove-entries', removedEntries) if entriesRemoved

    if newEntries.length > 0
      @entries[entry.name] = entry for entry in newEntries
      @emitter.emit('did-add-entries', newEntries)

  # Public: Collapse this directory and stop watching it.
  collapse: ->
    @isExpanded = false
    @expandedEntries = @serializeExpansionStates()
    @unwatch()

  # Public: Expand this directory, load its children, and start watching it for
  # changes.
  expand: ->
    @isExpanded = true
    @reload()
    @watch()

  serializeExpansionStates: ->
    expandedEntries = {}
    for name, entry of @entries when entry.isExpanded
      expandedEntries[name] = entry.serializeExpansionStates()
    expandedEntries
