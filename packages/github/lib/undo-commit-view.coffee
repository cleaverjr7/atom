$          = require 'jquery'
GitChanges = require './git-changes'
timeago    = require 'timeago'

BaseTemplate = """
<button class="btn">Undo</button>
<div class="description">Committed <span class="time"></span></div>
<div class="title"></div>
"""

class UndoCommitView extends HTMLElement
  initialize: (@statusListView) ->

  createdCallback: ->
    # Elements
    @el         = $(@)
    @innerHTML  = BaseTemplate
    @buttonNode = @querySelector('.btn')
    @titleNode  = @querySelector('.title')
    @timeNode   = @querySelector('.time')

    @git = new GitChanges()

    @handleEvents()

  handleEvents: ->
    @el.on 'click', '.btn', @undoCommit.bind(@)

  update: ->
    @git.getLatestUnpushed().then (commit) =>
      if commit
        @titleNode.textContent = commit.message()
        @timeNode.textContent = timeago(commit.date())
        @classList.add('show')
      else
        @classList.remove('show')

  undoCommit: ->
    @git.getLatestUnpushed().then (commit) =>
      @statusListView.commitMessageView.setText(commit.message())
      @git.undoLastCommit().then =>
        @statusListView.update()

module.exports = document.registerElement 'git-experiment-undo-commit-view',
  prototype: UndoCommitView.prototype
