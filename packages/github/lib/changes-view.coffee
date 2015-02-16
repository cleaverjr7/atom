TemplateHelper = require './template-helper'
GitChanges = require './git-changes'
Git = require 'nodegit'
PatchView = require './patch-view'
CommitHeaderView = require './commit-header-view'
PathWatcher = require 'pathwatcher'
timeago = require 'timeago'
_ = require 'underscore-contrib'
$ = require 'jquery'

BaseTemplate = """
  <div class="data" tabindex="-1">
    <div class="unstaged column-header">
      Unstaged changes
      <button class="btn btn-xs">Stage all</button>
    </div>
    <div class="unstaged files"></div>
    <div class="staged column-header">
      Staged changes
      <button class="btn btn-xs">Unstage all</button>
    </div>
    <div class="staged files"></div>
    <div class="staged column-header">Commit message</div>
    <div class="commit-message-box">
      <atom-text-editor class="commit-description" gutter-hidden data-placeholder="Enter the commit message describing your changes." style="height: 120px"></atom-text-editor>
      <div class="commit-button">
        <button class="btn btn-commit">Commit</button>
      </div>
    </div>
    <div class="undo-last-commit-box">
      <div class="undo-wrapper">
        <button class="btn">Undo</button>
        <div class="description">Committed <span class="time"></span></div>
        <div class="title">Commit title</div>
      </div>
    </div>
  </div>
  <div class="diffs"></div>
"""

ChangeSummaryTemplateString = """
  <div class="change" data-path="">
    <div>
      <span class='icon'></span>
      <span class="path"></span>
    </div>
    <button class="btn btn-xs"></button>
  </div>
"""

class ChangesView extends HTMLElement
  createdCallback: ->
    atom.commands.add 'git-experiment-changes-view .data',
      'core:move-down': =>
        @moveSelectionDown()
      'core:move-up': =>
        @moveSelectionUp()

    atom.commands.add 'git-experiment-changes-view atom-text-editor',
      'core:confirm': (event) =>
        @commit()

    @changes = new GitChanges()

    @innerHTML = BaseTemplate
    @unstagedChangesNode = @querySelector('.unstaged.files')
    @stagedChangesNode = @querySelector('.staged.files')
    @commitNode = @querySelector('.commit')
    @diffsNode = @querySelector('.diffs')
    @commitMessageNode = @querySelector('atom-text-editor')
    @commitMessageModel = @commitMessageNode.getModel()
    @undoNode = @querySelector('.undo-wrapper')

    @commitMessageModel.setSoftWrapped(true)
    @commitMessageModel.setPlaceholderText(@commitMessageNode.dataset['placeholder'])

    @selectedPath = @selectedState = null

    $(@).on 'click', '.change', (e) =>
      el = e.currentTarget
      path = el.dataset['path']
      state = el.dataset['state']
      @renderChangeDetail(path, state)

    $(@).on 'click', '.column-header.unstaged .btn', => @stageAll()
    $(@).on 'click', '.column-header.staged .btn', => @unstageAll()

    $(@).on 'click', '.undo-wrapper .btn', =>
      @changes.getLatestUnpushed().then (commit) =>
        @commitMessageModel.setText(commit.message())
        @changes.undoLastCommit()
        @renderChanges()

    $(window).on 'blur', =>
      @watch() if atom.workspace.getActivePaneItem() == @

    $(window).on 'focus', =>
      @renderChanges() if atom.workspace.getActivePaneItem() == @
      @unwatch()

    $(@).on 'click', '.change .btn', (e) =>
      el = $(e.target).closest('.change').get(0)
      path = el.dataset['path']
      state = el.dataset['state']
      promise = if state == 'unstaged'
        @changes.stagePath(path)
      else
        @changes.unstagePath(path)

      promise.then =>
        @renderChanges()

      e.stopPropagation()

    $(@).on 'click', '.btn-commit', =>
      @commit()

    @changeTemplate = TemplateHelper.addTemplate(this, ChangeSummaryTemplateString)

    atom.workspace.onDidChangeActivePaneItem (pane) =>
      @renderChanges() if pane == @

  getTitle: ->
    'Commit Changes'

  updateColumnHeader: (count, state) ->
    @querySelector(".#{state}.column-header").textContent = "#{count} #{state} file#{if count == 1 then '' else 's'}"

  changeIsStaged: (change) ->
    bit = change.statusBit()
    codes = Git.Status.STATUS

    return bit & codes.INDEX_NEW ||
           bit & codes.INDEX_MODIFIED ||
           bit & codes.INDEX_DELETED ||
           bit & codes.INDEX_RENAMED ||
           bit & codes.INDEX_TYPECHANGE

  changeIsUnstaged: (change) ->
    bit = change.statusBit()
    codes = Git.Status.STATUS

    return bit & codes.WT_NEW ||
           bit & codes.WT_MODIFIED ||
           bit & codes.WT_DELETED ||
           bit & codes.WT_RENAMED ||
           bit & codes.WT_TYPECHANGE

  renderChanges: ->
    @changes.getStatuses().then (statuses) =>
      @stagedChangesNode.innerHTML = ''
      @unstagedChangesNode.innerHTML = ''

      statuses.forEach (status) =>
        if @changeIsUnstaged(status)
          @renderChangeSummary(status, 'unstaged')

        if @changeIsStaged(status)
          @renderChangeSummary(status, 'staged')

      @querySelector('.change')?.click() unless @querySelector('.change.selected')
      @diffsNode.innerHTML = '' unless @querySelector('.change.selected')

    @changes.getLatestUnpushed().then (commit) =>
      if commit
        @undoNode.querySelector('.title').textContent = commit.message()
        @undoNode.querySelector('.time').textContent = timeago(commit.date())
        @undoNode.classList.add('show')
      else
        @undoNode.classList.remove('show')

  renderChangeSummary: (change, state) =>
    changeNode = TemplateHelper.renderTemplate(@changeTemplate)
    changeNode.querySelector('.path').textContent = change.path()
    changeNode.firstElementChild.dataset['path'] = change.path()
    changeNode.firstElementChild.dataset['state'] = state
    changeNode.firstElementChild.classList.add('selected') if @selectedPath == change.path() and @selectedState == state

    @addStatusClasses(change, state, changeNode.querySelector('.icon'))

    changeNode.querySelector('button').textContent = if state == 'unstaged' then 'Stage' else 'Unstage'
    node = if state == 'staged' then @stagedChangesNode else @unstagedChangesNode
    node.appendChild(changeNode)

  addStatusClasses: (change, state, node) ->
    bit = change.statusBit()
    codes = Git.Status.STATUS


    if state == 'unstaged'
      className = if bit & codes.WT_NEW
        'added'
      else if bit & codes.WT_RENAMED
        'renamed'
      else if bit & codes.WT_DELETED
        'removed'
      else
        'modified'
    else
      className = if bit & codes.INDEX_NEW
        'added'
      else if bit & codes.INDEX_RENAMED
        'renamed'
      else if bit & codes.INDEX_DELETED
        'removed'
      else
        'modified'

    node.classList.add("status-#{className}")
    node.classList.add("icon-diff-#{className}")

  renderChangeDetail: (path, state) ->
    diffsNode = @diffsNode
    diffsNode.innerHTML = ''

    @selectChange @querySelector("[data-path='#{path}'][data-state='#{state}']")

    @changes.getPatch(path, state).then (patch) =>
      if patch
        setImmediate ->
          patchView = new PatchView
          patchView.setPatch(patch)
          diffsNode.appendChild(patchView)
          diffsNode.style.webkitTransform = 'scale(1)' # fixes redraw issues

  selectChange: (el) ->
    return unless el

    for commitNode in @querySelectorAll('.change')
      commitNode.classList.remove('selected')

    el.classList.add('selected')

    @selectedPath = el.dataset['path']
    @selectedState = el.dataset['state']

    if @unstagedChangesNode.offsetHeight + @unstagedChangesNode.scrollTop - el.offsetTop - el.offsetHeight < 0
      el.scrollIntoView(false) # off the bottom of the scroll
    else if el.offsetTop < @unstagedChangesNode.scrollTop
      el.scrollIntoView()

  moveSelectionUp: ->
    @querySelector(".change.selected").previousElementSibling?.click()

  moveSelectionDown: ->
    @querySelector(".change.selected").nextElementSibling?.click()

  stageAll: =>
    paths = $(@).find('.unstaged .change').map( ->
      this.dataset['path']
    ).get()

    @changes.stageAllPaths(paths).then =>
      @renderChanges()
    false

  unstageAll: =>
    paths = $(@).find('.staged .change').map( ->
      this.dataset['path']
    ).get()

    @changes.unstageAllPaths(paths).then =>
      @renderChanges()
    false

  unwatch: ->
    if @watchSubscription?
      @watchSubscription.close()
      @watchSubscription = null

  # Public: Watch this directory for changes.
  watch: ->
    try
      @watchSubscription ?= PathWatcher.watch "#{atom.project.getPaths()[0]}/.git", (eventType) =>
        setTimeout( =>
          @renderChanges()
        , 10)

  commit: ->
    commitPromise = @changes.commit(@commitMessageModel.getText()).then =>
      @commitMessageModel.setText('')
      @renderChanges()

module.exports = document.registerElement 'git-experiment-changes-view', prototype: ChangesView.prototype
