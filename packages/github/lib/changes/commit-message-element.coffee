CommitMessage = require './commit-message'
GitIndex = require './git-changes'
observe = require '../observe'

DOMListener = require 'dom-listener'

{CompositeDisposable, Disposable} = require 'atom'

BaseTemplate = """
<atom-text-editor tabindex="-1" class="commit-description" gutter-hidden
  style="height: 120px"></atom-text-editor>
<div class="commit-button">
  <button class="btn btn-commit">Commit to
    <strong class="branch-name"></strong>
  </button>
</div>
"""

PlaceholderText = "Please enter a commit message describing your changes"

class CommitMessageElement extends HTMLElement
  initialize: ({@changesView}) ->
    @model = new CommitMessage(gitIndex: @changesView.model.gitIndex)
    # branchName could maybe get its own update function
    observe @model, ['branchName', 'message', 'complete'], @update.bind(this)
    @model.initialize()

  createdCallback: ->
    @disposables = new CompositeDisposable

    # Elements
    @innerHTML    = BaseTemplate
    @messageNode  = @querySelector('atom-text-editor')
    @messageModel = @messageNode.getModel()

    @branchNode   = @querySelector('.branch-name')
    @buttonNode   = @querySelector('.btn')

    @messageModel.setSoftWrapped(true)
    @messageModel.setPlaceholderText(PlaceholderText)

    @stagedCount = 0

  attachedCallback: ->
    # Model events
    @disposables.add @changesView.model.gitIndex.onDidUpdateRepository(@update.bind(this))
    @disposables.add @messageModel.onDidChange(@updateCommitButton.bind(this))
    @disposables.add @messageModel.onDidChange =>
      # This is a little bit of awkwardness but it keeps this element/model
      # relationship consistent with the rest of the elements.
      @model.message = @messageModel.getText()

    # Global UI events
    changesViewListener = new DOMListener(@changesView)

    # TODO figure out if this is needed
    @disposables.add changesViewListener.add(@changesView, 'set-commit-message', @setMessage.bind(this))

    # Events on this element
    listener = new DOMListener(this)
    @disposables.add listener.add('.btn', 'click', @model.commit)

    # Atom commands
    @disposables.add atom.commands.add "git-commit-message-view atom-text-editor:not(.mini)",
      "git:focus-status-list": @changesView.focusList.bind(this)
      "git:commit": @model.commit

  detatchedCallback: ->
    @disposables.dispose()

  update: =>
    @updateCommitButton()
    @branchNode.textContent = @model.branchName
    if @model.complete
      # reset UI and commit model to fresh state - I should just be able to reset
      # the commit model and have the UI follow but my first attempt put me in a
      # loop
      @setMessage('')
      @model.reset()

  focusTextArea: ->
    @messageNode.focus()

  setMessage: (e, text) ->
    text =
      if text is undefined
        if e.detail
          e.detail
        else
          e
      else
        text

    @messageModel.setText(text)

  updateCommitButton: ->
    @buttonNode.disabled = !@model.canCommit()

module.exports = document.registerElement 'git-commit-message-view',
  prototype: CommitMessageElement.prototype
