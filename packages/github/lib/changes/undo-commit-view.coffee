$          = require 'jquery'
GitIndex = require './git-changes'
timeago    = require 'timeago'

BaseTemplate = """
<button class="btn">Undo</button>
<div class="description">Committed <span class="time"></span></div>
<div class="title"></div>
"""

class UndoCommitView extends HTMLElement
  createdCallback: ->
    # Elements
    @el         = $(this)
    @innerHTML  = BaseTemplate
    @buttonNode = @querySelector('.btn')
    @titleNode  = @querySelector('.title')
    @timeNode   = @querySelector('.time')

    @gitIndex = new GitIndex

  attachedCallback: ->
    @base = @el.closest('.git-root-view')
    @handleEvents()

  handleEvents: ->
    @el.on 'click', '.btn', @undoCommit.bind(this)

  detatchedCallback: ->
    @el.off 'click', '.btn'

  update: ->
    @gitIndex.getLatestUnpushed().then (commit) =>
      if commit
        @titleNode.textContent = commit.message()
        @timeNode.textContent = timeago(commit.date())
        if commit.parents().length
          @buttonNode.style.display = 'inline-block'
        else
          @buttonNode.style.display = 'none'
        @classList.add('show')
      else
        @classList.remove('show')

  undoCommit: ->
    @gitIndex.getLatestUnpushed().then (commit) =>
      @base.trigger('set-commit-message', [commit.message()])
      @gitIndex.resetBeforeCommit(commit).then =>
        @base.trigger("")

module.exports = document.registerElement 'git-undo-commit-view',
  prototype: UndoCommitView.prototype
