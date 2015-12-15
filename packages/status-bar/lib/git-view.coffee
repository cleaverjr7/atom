{CompositeDisposable} = require "atom"

class GitView extends HTMLElement
  initialize: ->
    @classList.add('git-view')

    @createBranchArea()
    @createCommitsArea()
    @createStatusArea()

    @updateStatusPromise = Promise.resolve()

    @activeItemSubscription = atom.workspace.onDidChangeActivePaneItem =>
      @subscribeToActiveItem()
    @projectPathSubscription = atom.project.onDidChangePaths =>
      @subscribeToRepositories()
    @subscribeToRepositories()
    @subscribeToActiveItem()

  createBranchArea: ->
    @branchArea = document.createElement('div')
    @branchArea.classList.add('git-branch', 'inline-block')
    @appendChild(@branchArea)

    branchIcon = document.createElement('span')
    branchIcon.classList.add('icon', 'icon-git-branch')
    @branchArea.appendChild(branchIcon)

    @branchLabel = document.createElement('span')
    @branchLabel.classList.add('branch-label')
    @branchArea.appendChild(@branchLabel)

  createCommitsArea: ->
    @commitsArea = document.createElement('div')
    @commitsArea.classList.add('git-commits', 'inline-block')
    @appendChild(@commitsArea)

    @commitsAhead = document.createElement('span')
    @commitsAhead.classList.add('icon', 'icon-arrow-up', 'commits-ahead-label')
    @commitsArea.appendChild(@commitsAhead)

    @commitsBehind = document.createElement('span')
    @commitsBehind.classList.add('icon', 'icon-arrow-down', 'commits-behind-label')
    @commitsArea.appendChild(@commitsBehind)

  createStatusArea: ->
    @gitStatus = document.createElement('div')
    @gitStatus.classList.add('git-status', 'inline-block')
    @appendChild(@gitStatus)

    @gitStatusIcon = document.createElement('span')
    @gitStatusIcon.classList.add('icon')
    @gitStatus.appendChild(@gitStatusIcon)

  subscribeToActiveItem: ->
    activeItem = @getActiveItem()

    @savedSubscription?.dispose()
    @savedSubscription = activeItem?.onDidSave? => @update()

    @update()

  subscribeToRepositories: ->
    @repositorySubscriptions?.dispose()
    @repositorySubscriptions = new CompositeDisposable

    for repo in atom.project.getRepositories() when repo?
      @repositorySubscriptions.add repo.async.onDidChangeStatus ({path, status}) =>
        @update() if path is @getActiveItemPath()
      @repositorySubscriptions.add repo.async.onDidChangeStatuses =>
        @update()

  destroy: ->
    @activeItemSubscription?.dispose()
    @projectPathSubscription?.dispose()
    @savedSubscription?.dispose()
    @repositorySubscriptions?.dispose()

  getActiveItemPath: ->
    @getActiveItem()?.getPath?()

  getRepositoryForActiveItem: ->
    [rootDir] = atom.project.relativizePath(@getActiveItemPath())
    rootDirIndex = atom.project.getPaths().indexOf(rootDir)
    if rootDirIndex >= 0
      atom.project.getRepositories()[rootDirIndex]?.async
    else
      for repo in atom.project.getRepositories() when repo
        return repo.async

  getActiveItem: ->
    atom.workspace.getActivePaneItem()

  update: ->
    repo = @getRepositoryForActiveItem()
    @updateBranchText(repo)
    @updateAheadBehindCount(repo)
    @updateStatusText(repo)

  updateBranchText: (repo) ->
    if @showBranchInformation()
      repo?.getShortHead(@getActiveItemPath())
        .then (head) =>
          @branchLabel.textContent = head
          @branchArea.style.display = '' if head
    else
      @branchArea.style.display = 'none'

  showBranchInformation: ->
    if itemPath = @getActiveItemPath()
      atom.project.contains(itemPath)
    else
      not @getActiveItem()?

  updateAheadBehindCount: (repo) ->
    itemPath = @getActiveItemPath()

    if repo? and @showBranchInformation()
      {ahead, behind} = repo.getCachedUpstreamAheadBehindCount(itemPath) ? {}

      if ahead > 0
        @commitsAhead.textContent = ahead
        @commitsAhead.style.display = ''
      else
        @commitsAhead.style.display = 'none'

      if behind > 0
        @commitsBehind.textContent = behind
        @commitsBehind.style.display = ''
      else
        @commitsBehind.style.display = 'none'

    if ahead > 0 or behind > 0
      @commitsArea.style.display = ''
    else
      @commitsArea.style.display = 'none'

  clearStatus: ->
    @gitStatusIcon.classList.remove('icon-diff-modified', 'status-modified', 'icon-diff-added', 'status-added', 'icon-diff-ignored', 'status-ignored')

  updateAsNewFile: ->
    @clearStatus()

    @gitStatusIcon.classList.add('icon-diff-added', 'status-added')
    if textEditor = atom.workspace.getActiveTextEditor()
      @gitStatusIcon.textContent = "+#{textEditor.getLineCount()}"
    else
      @gitStatusIcon.textContent = ''
    @gitStatus.style.display = ''

    Promise.resolve()

  updateAsModifiedFile: (repo, path) ->
    repo.getDiffStats(path).then (stats) =>
      @clearStatus()

      @gitStatusIcon.classList.add('icon-diff-modified', 'status-modified')
      if stats.added and stats.deleted
        @gitStatusIcon.textContent = "+#{stats.added}, -#{stats.deleted}"
      else if stats.added
        @gitStatusIcon.textContent = "+#{stats.added}"
      else if stats.deleted
        @gitStatusIcon.textContent = "-#{stats.deleted}"
      else
        @gitStatusIcon.textContent = ''
      @gitStatus.style.display = ''

  updateAsIgnoredFile: ->
    @clearStatus()

    @gitStatusIcon.classList.add('icon-diff-ignored',  'status-ignored')
    @gitStatusIcon.textContent = ''
    @gitStatus.style.display = ''

    Promise.resolve()

  updateStatusText: (repo) ->
    itemPath = @getActiveItemPath()
    return unless itemPath

    @updateStatusPromise = @updateStatusPromise
      .then (_) -> repo?.getCachedPathStatus(itemPath)
      .then (status = 0) =>
        if repo?.isStatusNew(status)
          return @updateAsNewFile()

        if repo?.isStatusModified(status)
          return @updateAsModifiedFile(repo, itemPath)

        repo?.isPathIgnored(itemPath).then (ignored) =>
          if ignored
            @updateAsIgnoredFile()
          else
            @clearStatus()
            @gitStatus.style.display = 'none'
            Promise.resolve()

module.exports = document.registerElement('status-bar-git', prototype: GitView.prototype, extends: 'div')
