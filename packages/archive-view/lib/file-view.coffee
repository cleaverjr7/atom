{View} = require 'space-pen'
$ = require 'jquery'
fsUtils = require 'fs-utils'
path = require 'path'
temp = require 'temp'
archive = require 'ls-archive'

module.exports =
class FileView extends View
  @content: (archivePath, entry) ->
    @li class: 'list-item entry', tabindex: -1, =>
      @span entry.getName(), class: 'file icon', outlet: 'name'

  initialize: (@archivePath, @entry) ->
    if @entry.isSymbolicLink()
      @name.addClass('icon-file-symlink')
    else
      @name.addClass('icon-file-text')

    @on 'click', =>
      @select()
      @openFile()

    @on 'core:confirm', =>
      @openFile() if @isSelected()

    @on 'core:move-down', =>
      if @isSelected()
        files = @closest('.archive-view').find('.file')
        $(files[files.index(@name) + 1]).view()?.select()

    @on 'core:move-up', =>
      if @isSelected()
        files = @closest('.archive-view').find('.file')
        $(files[files.index(@name) - 1]).view()?.select()

  isSelected: -> @hasClass('selected')

  logError: (message, error) ->
    console.error(message, error.stack ? error)

  openFile: ->
    archive.readFile @archivePath, @entry.getPath(), (error, contents) =>
      if error?
        @logError("Error reading: #{@entry.getPath()} from #{@archivePath}", error)
      else
        temp.mkdir 'atom-', (error, tempDirPath) =>
          if error?
            @logError("Error creating temp directory: #{tempDirPath}", error)
          else
            tempFilePath = path.join(tempDirPath, path.basename(@archivePath), @entry.getName())
            fsUtils.write tempFilePath, contents, (error) =>
              if error?
                @logError("Error writing to #{tempFilePath}", error)
              else
                rootView.open(tempFilePath)

  select: ->
    @closest('.archive-view').find('.selected').toggleClass('selected')
    @addClass('selected')
    @focus()
