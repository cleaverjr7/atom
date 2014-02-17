GitHubFile  = require './github-file'

module.exports =
  activate: ->
    return unless atom.project.getRepo()?

    atom.workspaceView.eachPane (pane) ->
      pane.command 'open-on-github:file', ->
        if itemPath = getActivePath()
          GitHubFile.fromPath(itemPath).open()

      pane.command 'open-on-github:blame', ->
        if itemPath = getActivePath()
          GitHubFile.fromPath(itemPath).blame()

      pane.command 'open-on-github:history', ->
        if itemPath = getActivePath()
          GitHubFile.fromPath(itemPath).history()

      pane.command 'open-on-github:copy-url', ->
        if itemPath = getActivePath()
          GitHubFile.fromPath(itemPath).copyUrl(getSelectedRange())

getActivePath = ->
  atom.workspaceView.getActivePaneItem()?.getPath?()

getSelectedRange = ->
  atom.workspaceView.getActivePaneItem()?.getSelectedBufferRange?()
