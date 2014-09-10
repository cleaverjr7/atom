path = require 'path'
_ = require 'underscore-plus'
{Emitter, Subscriber} = require 'emissary'
fs = require 'fs-plus'
PathWatcher = require 'pathwatcher'
File = require './file'

module.exports =
class Directory
  Emitter.includeInto(this)
  Subscriber.includeInto(this)

  constructor: ({@name, fullPath, @symlink, @expandedEntries, @isExpanded, @isRoot}) ->
    @path = fullPath
    @isRoot ?= false
    @isExpanded ?= false
    @expandedEntries ?= {}
    @status = null
    @entries = {}

    @submodule = atom.project.getRepo()?.isSubmodule(@path)

    repo = atom.project.getRepo()
    if repo?
      @subscribeToRepo(repo)
      @updateStatus(repo)

  destroy: ->
    @unwatch()
    @unsubscribe()
    @emit 'destroyed'

  # Subscribe to the given repo for changes to the Git status of this directory.
  subscribeToRepo: (repo) ->
    @subscribe repo, 'status-changed', (changedPath, status) =>
      @updateStatus(repo) if changedPath.indexOf("#{@path}#{path.sep}") is 0
    @subscribe repo, 'statuses-changed', =>
      @updateStatus(repo)

  # Update the status property of this directory using the repo.
  updateStatus: (repo) ->
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
      @emit 'status-changed', newStatus

  # Is the given path ignored?
  isPathIgnored: (filePath) ->
    if atom.config.get('tree-view.hideVcsIgnoredFiles')
      repo = atom.project.getRepo()
      return true if repo? and repo.isProjectAtRoot() and repo.isPathIgnored(filePath)

    if atom.config.get('tree-view.hideIgnoredNames')
      ignoredNames = atom.config.get('core.ignoredNames') ? []
      ignoredNames = [ignoredNames] if typeof ignoredNames is 'string'
      name = path.basename(filePath)
      return true if _.contains(ignoredNames, name)
      extension = path.extname(filePath)
      return true if extension and _.contains(ignoredNames, "*#{extension}")

    false

  # Public: Does this directory contain the given path?
  #
  # See atom.Directory::contains for more details.
  contains: (pathToCheck) ->
    # @directory.contains(pathToCheck)

  # Public: Stop watching this directory for changes.
  unwatch: ->
    if @watchSubscription?
      @watchSubscription.close()
      @watchSubscription = null

    for key, entry of @entries
      entry.destroy()
      delete @entries[key]

  # Public: Watch this directory for changes.
  #
  # The changes will be emitted as 'entries-added' and 'entries-removed' events.
  watch: ->
    @watchSubscription ?= PathWatcher.watch @path, (eventType) =>
      @reload() if eventType is 'change'

  getEntries: ->
    names = fs.readdirSync(@path).sort (name1, name2) ->
      name1.toLowerCase().localeCompare(name2.toLowerCase())

    files = []
    directories = []

    for name in names
      fullPath = path.join(@path, name)
      continue if @isPathIgnored(fullPath)

      try
        stat = fs.lstatSync(fullPath)
        symlink = stat.isSymbolicLink()
        stat = fs.statSync(fullPath) if symlink

      if stat?.isDirectory()
        if @entries.hasOwnProperty(name)
          # push a placeholder since this entry already exists but this helps
          # track the insertion index for the created views
          directories.push(name)
        else
          expandedEntries = @expandedEntries[name]
          isExpanded = expandedEntries?
          directories.push(new Directory({name, fullPath, symlink, isExpanded, expandedEntries}))
      else if stat?.isFile()
        if @entries.hasOwnProperty(name)
          # push a placeholder since this entry already exists but this helps
          # track the insertion index for the created views
          files.push(name)
        else
          files.push(new File({name, fullPath, symlink}))

    directories.concat(files)

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


      console.log index
      entry.indexInParentDirectory = index
      index++
      newEntries.push(entry)

    entriesRemoved = false
    for name, entry of removedEntries
      entriesRemoved = true
      entry.destroy()
      delete @entries[name]
      delete @expandedEntries[name]
    @emit 'entries-removed', removedEntries if entriesRemoved

    if newEntries.length > 0
      @entries[entry.name] = entry for entry in newEntries
      @emit 'entries-added', newEntries

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
