Shell = require 'shell'
{Range} = require 'atom'
parseUrl = require('url').parse

module.exports =
class GitHubFile

  # Public
  @fromPath: (filePath) ->
    new GitHubFile(filePath)

  # Internal
  constructor: (@filePath) ->
    [rootDir] = atom.project.relativizePath(filePath)
    if rootDir?
      rootDirIndex = atom.project.getPaths().indexOf(rootDir)
      @repo = atom.project.getRepositories()[rootDirIndex]?.async

  # Public
  open: (lineRange) ->
    if @isOpenable()
      @blobUrl().then (blobUrl) =>
        @openUrlInBrowser(blobUrl + @getLineRangeSuffix(lineRange))
    else
      @reportValidationErrors()

  # Public
  openOnMaster: (lineRange) ->
    if @isOpenable()
      @blobUrlForMaster().then (blobUrlForMaster) =>
        @openUrlInBrowser(blobUrlForMaster + @getLineRangeSuffix(lineRange))
    else
      @reportValidationErrors()

  # Public
  blame: (lineRange) ->
    if @isOpenable()
      @blameUrl().then (blameUrl) =>
        @openUrlInBrowser(blameUrl + @getLineRangeSuffix(lineRange))
    else
      @reportValidationErrors()

  history: ->
    if @isOpenable()
      @openUrlInBrowser(@historyUrl())
    else
      @reportValidationErrors()

  copyUrl: (lineRange) ->
    if @isOpenable()
      @shaUrl().then (shaUrl) =>
        atom.clipboard.write(shaUrl + @getLineRangeSuffix(lineRange))
    else
      @reportValidationErrors()

  openBranchCompare: ->
    if @isOpenable()
      @branchCompareUrl().then (branchCompareUrl) =>
        @openUrlInBrowser(branchCompareUrl)
    else
      @reportValidationErrors()

  openIssues: ->
    if @isOpenable()
      @issuesUrl().then (issuesUrl) =>
        @openUrlInBrowser(issuesUrl
    else
      @reportValidationErrors()

  openRepository: ->
    if @isOpenable()
      @gitHubRepoUrl().then (gitHubRepoUrl) =>
        @openUrlInBrowser(gitHubRepoUrl)
    else
      @reportValidationErrors()

  getLineRangeSuffix: (lineRange) ->
    if lineRange and atom.config.get('open-on-github.includeLineNumbersInUrls')
      lineRange = Range.fromObject(lineRange)
      startRow = lineRange.start.row + 1
      endRow = lineRange.end.row + 1
      if startRow is endRow
        "#L#{startRow}"
      else
        "#L#{startRow}-L#{endRow}"
    else
      ''

  # Public
  isOpenable: ->
    @validationErrors().length is 0

  # Public
  validationErrors: ->
    unless @repo
      return ["No repository found for path: #{@filePath}."]

    unless @gitUrl()
      return ["No URL defined for remote: #{@remoteName()}"]

    unless @gitHubRepoUrl()
      return ["Remote URL is not hosted on GitHub: #{@gitUrl()}"]

    []

  # Internal
  reportValidationErrors: ->
    message = @validationErrors().join('\n')
    atom.notifications.addWarning(message)

  # Internal
  openUrlInBrowser: (url) ->
    Shell.openExternal url

  # Internal
  blobUrl: ->
    Promise.all([@gitHubRepoUrl(), @remoteBranchName(), @repoRelativePath()])
      .then ([gitHubRepoUrl, remoteBranchName, repoRelativePath]) =>
        "#{gitHubRepoUrl}/blob/#{remoteBranchName}/#{@encodeSegments(repoRelativePath)}"

  # Internal
  blobUrlForMaster: ->
    Promise.all([@gitHubRepoUrl(), @repoRelativePath()])
      .then ([gitHubRepoUrl, repoRelativePath]) =>
        "#{gitHubRepoUrl}/blob/master/#{@encodeSegments(repoRelativePath)}"

  # Internal
  shaUrl: ->
    Promise.all([@gitHubRepoUrl(), @sha(), @repoRelativePath()])
      .then ([gitHubRepoUrl, sha, repoRelativePath]) =>
        "#{gitHubRepoUrl}/blob/#{@encodeSegments(sha)}/#{@encodeSegments(repoRelativePath)}"

  # Internal
  blameUrl: ->
    Promise.all([@gitHubRepoUrl(), @remoteBranchName(), @repoRelativePath()])
      .then ([gitHubRepoUrl, remoteBranchName, repoRelativePath]) =>
        "#{gitHubRepoUrl}/blame/#{remoteBranchName}/#{@encodeSegments(repoRelativePath)}"

  # Internal
  historyUrl: ->
    Promise.all([@gitHubRepoUrl(), @remoteBranchName(), @repoRelativePath()])
      .then ([gitHubRepoUrl, remoteBranchName, repoRelativePath]) =>
        "#{gitHubRepoUrl}/commits/#{remoteBranchName}/#{@encodeSegments(repoRelativePath)}"

  # Internal
  issuesUrl: ->
    @gitHubRepoUrl().then (gitHubRepoUrl) -> "#{gitHubRepoUrl}/issues"

  # Internal
  branchCompareUrl: ->
    Promise.all([@gitHubRepoUrl(), @branchName()])
      .then ([gitHubRepoUrl, branchName]) =>
        "#{gitHubRepoUrl}/compare/#{@encodeSegments(branchName)}"

  encodeSegments: (segments='') ->
    segments = segments.split('/')
    segments = segments.map (segment) -> encodeURIComponent(segment)
    segments.join('/')

  # Internal
  gitUrl: ->
    @remoteName().then (remoteOrBestGuess = 'origin') =>
      @repo.getConfigValue("remote.#{remoteOrBestGuess}.url", @filePath)

  # Internal
  gitHubRepoUrl: ->
    @gitUrl().then (url) =>
      if url.match /git@[^:]+:/    # e.g., git@github.com:foo/bar.git
        url = url.replace /^git@([^:]+):(.+)$/, (match, host, repoPath) ->
          repoPath = repoPath.replace(/^\/+/, '') # replace leading slashes
          "http://#{host}/#{repoPath}"
      else if url.match /ssh:\/\/git@([^\/]+)\//    # e.g., ssh://git@github.com/foo/bar.git
        url = "http://#{url.substring(10)}"
      else if url.match /^git:\/\/[^\/]+\// # e.g., git://github.com/foo/bar.git
        url = "http#{url.substring(3)}"

      url = url.replace(/\.git$/, '')
      url = url.replace(/\/+$/, '')

      return url unless @isBitbucketUrl(url)

  isBitbucketUrl: (url) ->
    return true if url.indexOf('git@bitbucket.org') is 0

    try
      {host} = parseUrl(url)
      host is 'bitbucket.org'

  # Internal
  repoRelativePath: ->
    @repo.relativizeToWorkingDirectory(@filePath)

  # Internal
  remoteName: ->
    @repo.getShortHead(@filePath).then (shortBranch) =>
      return null unless shortBranch

      @repo.getConfigValue("branch.#{shortBranch}.remote", @filePath).then (branchRemote) ->
        return null unless branchRemote?.length > 0

        branchRemote

  # Internal
  sha: ->
    @repo.getReferenceTarget('HEAD', @filePath)

  # Internal
  branchName: ->
    @repo.getShortHead(@filePath).then (shortBranch) =>
      return null unless shortBranch

      @repo.getConfigValue("branch.#{shortBranch}.merge", @filePath).then (branchMerge) ->
        return shortBranch unless branchMerge?.length > 11
        return shortBranch unless branchMerge.indexOf('refs/heads/') is 0

        branchMerge.substring(11)

  # Internal
  remoteBranchName: ->
    @remoteName().then (remoteName) =>
      if remoteName?
        @branchName().then (branchName) =>
          @encodeSegments(branchName)
      else
        'master'
