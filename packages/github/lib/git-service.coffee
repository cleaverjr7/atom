{Emitter, GitRepositoryAsync} = require 'atom'
ChildProcess                  = require 'child_process'
os                            = require 'os'
fse                           = require 'fs-extra'
Path                          = require 'path'
_                             = require 'underscore-contrib'
exec                          = ChildProcess.exec
JsDiff                        = require 'diff'

Git = GitRepositoryAsync.Git

module.exports =
class GitService
  statuses: {}

  # Sorry about the singleton, but there is no need to pass this thing around all over the place
  @instance: ->
    unless @_instance?
      @_instance = new GitService
    @_instance

  @statusCodes: ->
    Git.Status.STATUS

  constructor: ->
    @tmpDir   = os.tmpDir()
    @repoPath = atom.project.getPaths()[0]
    @emitter = new Emitter

  emit: (event) ->
    @emitter.emit(event)

  onDidUpdateRepository: (callback) ->
    @emitter.on('did-update-repository', callback)

  updateRepository: ->
    @emitter.emit('did-update-repository')

  getBranchName: ->
    Git.Repository.open(@repoPath).then (repo) ->
      repo.getBranch('HEAD')
    .then (branch) =>
      @normalizeBranchName(branch.name())
    .catch ->
      Promise.resolve("master")

  normalizeBranchName: (name) ->
    name.replace('refs/heads/','')

  localBranches: ->
    data = {}
    branches = []
    @getBranchName()
    .then (branchName) =>
      data.branchName = branchName
      Git.Repository.open(@repoPath)
    .then (repo) ->
      repo.getReferenceNames()
    .then (refs) ->
      for ref in refs
        if matches = ref.match /^refs\/heads\/(.*)/
          branch =
            name: matches[1]
            current: matches[1] == data.branchName
          branches.push branch

      for ref in refs
        if matches = ref.match /^refs\/remotes\/origin\/(.*)/
          branch =
            name: matches[1]
            current: matches[1] == data.branchName
            remote: true

          local = _.find branches, (br) ->
            br.name == branch.name

          branches.push branch unless local or branch.name is "HEAD"

      branches.sort (a, b) ->
        aName = a.name.toLowerCase()
        bName = b.name.toLowerCase()
        if aName < bName
          -1
        else if aName > bName
          1
        else
          0
    .catch ->
      Promise.resolve(name: 'master', current: true)

  createBranch: ({name, from}) ->
    data = {}
    name = @normalizeBranchName(name)
    Git.Repository.open(@repoPath)
    .then (repo) ->
      data.repo = repo
      repo.getBranchCommit(from)
    .then (branch) =>
      signature = data.repo.defaultSignature()
      message = "Created #{name} from #{from}"
      data.repo.createBranch(name, branch, 0, signature, message).then =>
        @checkoutBranch(name)
    .then =>
      @emitter.emit('did-update-repository')

  trackRemoteBranch: (name) ->
    @createBranch({name: name, from: "origin/#{name}"})
    .then =>
      Git.Repository.open(@repoPath)
    .then (repo) ->
      repo.getBranch(name)
    .then (branch) ->
      Git.Branch.setUpstream(branch, "origin/#{name}")
    .then =>
      @emitter.emit('did-update-repository')

  checkoutBranch: (name) ->
    Git.Repository.open(@repoPath)
    .then (repo) ->
      repo.checkoutBranch(name)
    .then =>
      @emitter.emit('did-update-repository')

  getDiffForPath: (path, state) ->
    @diffsPromise.then (diffs) ->
      diffs[state]?.patches().then (patchList) ->
        _.find patchList, (patch) -> patch.newFile().path() == path

  getDiffs: (state) ->
    @diffsPromise.then (diffs) ->
      diffs[state]?.patches().then (patchList) ->
        patchList

  gatherDiffs: ->
    data = {}
    diffOpts =
      flags: Git.Diff.OPTION.SHOW_UNTRACKED_CONTENT |
             Git.Diff.OPTION.RECURSE_UNTRACKED_DIRS

    findOpts =
      flags: Git.Diff.FIND.RENAMES |
             Git.Diff.FIND.FOR_UNTRACKED

    @diffsPromise = Git.Repository.open(@repoPath).then (repo) ->
      data.repo = repo
      data.repo.openIndex()
    .then (index) ->
      data.index = index
      Git.Diff.indexToWorkdir(data.repo, data.index, diffOpts)
    .then (unstagedDiffs) ->
      data.unstagedDiffs = unstagedDiffs
      unstagedDiffs.findSimilar(findOpts)
    .then ->
      data.repo.getHeadCommit() unless data.repo.isEmpty()
    .then (commit) ->
      commit.getTree() unless data.repo.isEmpty()
    .then (tree) ->
      data.tree = tree
      Git.Diff.treeToIndex(data.repo, tree, data.index, diffOpts)
    .then (stagedDiffs) ->
      data.stagedDiffs = stagedDiffs
      stagedDiffs.findSimilar(findOpts)
    .then ->
      # Git.Diff.treeToWorkdir(data.repo, data.tree, diffOpts)
      Git.Diff.treeToWorkdirWithIndex(data.repo, data.tree, diffOpts)
    .then (allDiffs) ->
      data.allDiffs = allDiffs
      allDiffs.findSimilar(findOpts)
    .then ->
      diffs =
        all: data.allDiffs
        staged: data.stagedDiffs
        unstaged: data.unstagedDiffs

  getStatuses: ->
    opts =
      flags: Git.Status.OPT.INCLUDE_UNTRACKED |
             Git.Status.OPT.RECURSE_UNTRACKED_DIRS |
             Git.Status.OPT.RENAMES_INDEX_TO_WORKDIR |
             Git.Status.OPT.RENAMES_HEAD_TO_INDEX

    @gatherDiffs()
    Git.Repository.open(@repoPath)
    .then (repo) ->
      repo.getStatusExt(opts)
    .then (statuses) =>
      for status in statuses
        @statuses[status.path()] = status
      statuses

  getComparisonBranch: (names, branchName) ->
    origin = "refs/remotes/origin/#{branchName}"
    if names.indexOf(origin) >= 0
      origin
    else if branchName != "master"
      "master"
    else
      null

  getLatestUnpushed: ->
    data = {}
    Git.Repository.open(@repoPath)
    .then (repo) ->
      data.repo = repo
      repo.getCurrentBranch()
    .then (branch) =>
      data.branch     = branch
      data.branchName = @normalizeBranchName(branch.name())
      data.walker     = data.repo.createRevWalk()
      data.walker.pushHead()
      data.repo.getReferenceNames()
    .then (names) =>
      data.compareBranch = @getComparisonBranch(names, data.branchName)
      new Promise (resolve, reject) ->
        if data.compareBranch
          data.repo.getBranchCommit(data.compareBranch)
          .then (compare) ->
            data.walker.hide(compare)
            resolve()
        else
          resolve()
    .then ->
      data.walker.next()
    .then (oid) ->
      if oid then data.repo.getCommit(oid) else null

  resetBeforeCommit: (commit) ->
    commit.getParents().then (parents) ->
      Git.Reset.reset(commit.repo,
        if parents.length then parents[0] else null,
        Git.Reset.TYPE.SOFT)
    .then ->
      commit.repo.openIndex()
    .then (index) ->
      index.write()
    .then =>
      @emitter.emit('did-update-repository')

  stagePath: (path) ->
    @stageAllPaths([path])

  stageAllPaths: (paths) ->
    Git.Repository.open(@repoPath)
    .then (repo) ->
      repo.openIndex()
    .then (index) =>
      for path in paths
        status = @statuses[path]
        if status.isDeleted()
          index.removeByPath(path)
        else if status.isRenamed()
          index.removeByPath(status.indexToWorkdir().oldFile().path())
          index.addByPath(path)
        else
          index.addByPath(path)

      index.write()
    .then =>
      @emitter.emit('did-update-repository')

  unstagePath: (path) ->
    @unstageAllPaths([path])

  unstageAllPaths: (paths) ->
    data = {}
    Git.Repository.open(@repoPath)
    .then (repo) =>
      data.repo = repo
      if repo.isEmpty()
        repo.openIndex()
        .then (index) ->
          index.removeByPath(path) for path in paths
          index.write()
      else
        repo.getHeadCommit()
        .then (commit) =>
          for path in paths
            status = @statuses[path]
            if status.isRenamed()
              Git.Reset.default(data.repo, commit,
                status.headToIndex().oldFile().path())

            Git.Reset.default(data.repo, commit, path)
    .then =>
      @emitter.emit('did-update-repository')

  wordwrap: (str) ->
    return str unless str.length
    str.match(/.{1,80}(\s|$)|\S+?(\s|$)/g).join("\n")

  commit: (message) ->
    data = {}
    Git.Repository.open(@repoPath)
    .then (repo) ->
      data.repo = repo
      repo.openIndex()
    .then (index) ->
      data.index = index
      index.writeTree()
    .then (indexTree) ->
      data.indexTree = indexTree
      data.repo.getHeadCommit()
    .catch -> data.parent = null
    .then (parent) =>
      parents = if parent? then [parent] else null
      author = Git.Signature.default(data.repo)
      data.repo.createCommit("HEAD",
        author,
        author,
        @wordwrap(message),
        data.indexTree,
        parents)
    .then =>
      @emitter.emit('did-update-repository')

  parseHeader: (header) ->
    headerParts =
      header.match(/^@@ \-([0-9]+),?([0-9]+)? \+([0-9]+),?([0-9]+)? @@(.*)/)
    return false unless headerParts

    data =
      oldStart: parseInt(headerParts[1], 10)
      oldCount: parseInt(headerParts[2], 10)
      newStart: parseInt(headerParts[3], 10)
      newCount: parseInt(headerParts[4], 10)
      context:  headerParts[5]

  calculatePatchTexts: (selectedLinesByHunk, stage) ->
    offset = 0
    patches = []
    for hunkString of selectedLinesByHunk
      {linesToStage, linesToUnstage} = selectedLinesByHunk[hunkString]

      linesToUse = if linesToStage.length > 0 then linesToStage else linesToUnstage

      hunk = linesToUse[0].hunk
      result = @calculatePatchText(hunk, linesToUse, offset, stage)
      offset += result.offset
      patches.push(result.patchText)
    Promise.resolve(patches)

  calculatePatchText: (hunk, selectedLines, offset, stage) ->
    header = hunk.getHeader()

    {oldStart, context} = @parseHeader(header)
    oldStart += offset
    newStart = oldStart
    oldCount = newCount = 0

    hunkLines = hunk.getLines()
    patchLines = []
    for line, idx in hunkLines
      selected = selectedLines.some (selectedLine) ->
        if line.isAddition()
          line.getNewLineNumber() == selectedLine.getNewLineNumber()
        else if line.isDeletion()
          line.getOldLineNumber() == selectedLine.getOldLineNumber()
        else
          false

      content = line.getContent()
      origin = line.getLineOrigin()
      switch origin
        when ' '
          oldCount++
          newCount++
          patchLines.push "#{origin}#{content}"
        when '+'
          if selected
            newCount++
            patchLines.push "#{origin}#{content}"
          else if not stage
            oldCount++
            newCount++
            patchLines.push " #{content}"
        when '-'
          if selected
            oldCount++
            patchLines.push "#{origin}#{content}"
          else if stage
            oldCount++
            newCount++
            patchLines.push " #{content}"

    oldStart = 1 if oldCount > 0 and oldStart == 0
    newStart = 1 if newCount > 0 and newStart == 0

    header = "@@ -#{oldStart},#{oldCount} +#{newStart},#{newCount} @@#{context}\n"
    patchText = "#{header}#{patchLines.join("\n")}\n"
    {patchText, offset: newCount - oldCount}

  stagePatches: (fileDiff, patches) =>
    data = {}
    oldPath = fileDiff.getOldPathName()
    newPath = fileDiff.getNewPathName()
    Git.Repository.open(@repoPath)
    .then (repo) ->
      data.repo = repo
      repo.openIndex()
    .then (index) =>
      data.index = index
      @indexBlob(oldPath) unless fileDiff.isUntracked()
    .then (content) =>
      newContent = content ? ''
      for patchText in patches
        newContent = JsDiff.applyPatch(newContent, patchText)
      buffer = new Buffer(newContent)
      oid    = data.repo.createBlobFromBuffer(buffer)

      if fileDiff.isDeleted()
        entry = data.index.getByPath(oldPath)
        entry.id = oid
        entry.fileSize = buffer.length
      else
        entry = @createIndexEntry
          oid: oid
          path: newPath
          fileSize: buffer.length
          mode: fileDiff.getMode()

      data.index.removeByPath(oldPath) if oldPath != newPath
      data.index.add(entry)
      data.index.write()
    .then =>
      @emitter.emit('did-update-repository')
    .catch (error) ->
      console.log error.message
      console.log error.stack

  unstagePatches: (fileDiff, patches) =>
    data = {}
    oldPath = fileDiff.getOldPathName()
    newPath = fileDiff.getNewPathName()
    Git.Repository.open(@repoPath)
    .then (repo) ->
      data.repo = repo
      repo.openIndex()
    .then (index) ->
      data.index = index
      entry = index.getByPath(newPath, 0)
      if entry?
        data.repo.getBlob(entry.id).then (blob) ->
          blob?.toString()
    .then (content) =>
      newContent = content ? ''
      for patchText in patches
        patchText = @reversePatch(patchText)
        newContent = JsDiff.applyPatch(newContent, patchText)

      if !newContent and fileDiff.isAdded()
        @unstagePath(newPath)
      else
        buffer = new Buffer(newContent)
        oid    = data.repo.createBlobFromBuffer(buffer)
        entry = @createIndexEntry
          oid: oid
          path: newPath
          fileSize: buffer.length
          mode: fileDiff.getMode()
        data.index.add(entry)
        data.index.write()
    .then =>
      @emitter.emit('did-update-repository')

  createIndexEntry: ({oid, path, fileSize, mode}) ->
    entry  = new Git.IndexEntry()
    entry.id = oid
    entry.mode = mode
    entry.path = path
    entry.fileSize = fileSize
    entry.flags = 0
    entry.flagsExtended = 0

    entry

  reversePatch: (patch) ->
    lines = patch.split("\n")
    header = lines.shift()
    headerParts = header.match(/^@@ \-([^\s]+) \+([^\s]+) @@(.*)$/)
    newHeader = "@@ -#{headerParts[2]} +#{headerParts[1]} @@#{headerParts[3]}"

    newLines = lines.map (line) ->
      origin = line[0]
      content = line.substr(1)
      switch origin
        when '+'
          "-#{content}"
        when '-'
          "+#{content}"
        else
          line

    newLines.unshift(newHeader)
    newLines.join("\n")

  workingBlob: (path) ->
    new Git.Promise (resolve, reject) =>
      fse.readFile "#{@repoPath}/#{path}", "utf8", (e, text) ->
        resolve(text)

  indexBlob: (path) ->
    data = {}
    Git.Repository.open(@repoPath)
    .then (repo) ->
      data.repo = repo
      repo.openIndex()
    .then (index) =>
      entry = index.getByPath(path, 0)
      if entry?
        data.repo.getBlob(entry.id).then (blob) ->
          blob?.toString()
      else
        @treeBlob(path)

  treeBlob: (path, sha) ->
    Git.Repository.open(@repoPath)
    .then (repo) ->
      if sha
        repo.getCommit(sha)
      else
        repo.getHeadCommit()
    .then (commit) ->
      commit.getTree()
    .then (tree) ->
      tree.getEntry(path)
    .then (entry) ->
      if entry?
        entry.getBlob().then (blob) ->
          if blob?
            blob.toString()
          else
            ""
      else
        ""

  getCommitBlobs: (commit, patch) ->
    oldPath = patch.oldFile().path()
    oldSha = commit.parents()[0]
    newPath = patch.newFile().path()
    newSha = commit.id()

    oldBlob = @treeBlob(oldPath, oldSha) unless patch.isAdded()
    newBlob = @treeBlob(newPath, newSha) unless patch.isDeleted()

    if oldBlob and newBlob
      Git.Promise.all([oldBlob, newBlob]).then (blobs) ->
        data =
          old: blobs[0]
          new: blobs[1]
    else if newBlob
      newBlob.then (blob) ->
        data =
          old: ''
          new: blob
    else if oldBlob
      oldBlob.then (blob) ->
        data =
          old: blob
          new: ''
    else
      data =
        old: ''
        new: ''

  getBlobs: ({patch, status, commit}) ->
    if commit
      @getCommitBlobs(commit, patch)
    else
      if status == 'staged'
        @getStagedBlobs(patch)
      else
        @getUnstagedBlobs(patch)

  getStagedBlobs: (patch) ->
    oldPath = patch.oldFile().path()
    newPath = patch.newFile().path()

    if patch.isAdded() or patch.isUntracked()
      @indexBlob(newPath).then (newBlob) ->
        data =
          new: newBlob
          old: ''
    else if patch.isDeleted()
      @treeBlob(oldPath).then (oldBlob) ->
        data =
          old: oldBlob
          new: ''
    else
      Git.Promise.all([@treeBlob(oldPath), @indexBlob(newPath)])
      .then (blobs) ->
        data =
          old: blobs[0]
          new: blobs[1]

  getUnstagedBlobs: (patch) ->
    oldPath = patch.oldFile().path()
    newPath = patch.newFile().path()

    if patch.isAdded() or patch.isUntracked()
      @workingBlob(newPath).then (newBlob) ->
        data =
          new: newBlob
          old: ''
    else if patch.isDeleted()
      @indexBlob(oldPath).then (oldBlob) ->
        data =
          old: oldBlob
          new: ''
    else
      Git.Promise.all([@indexBlob(oldPath), @workingBlob(newPath)])
      .then (blobs) ->
        data =
          old: blobs[0]
          new: blobs[1]

  forceCheckoutPath: (path) ->
    opts =
      checkoutStrategy: Git.Checkout.STRATEGY.FORCE
      paths: path

    Git.Repository.open(@repoPath)
    .then (repo) ->
      Git.Checkout.head(repo, opts)
    .then =>
      @emitter.emit('did-update-repository')
