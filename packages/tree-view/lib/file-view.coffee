{View} = require 'atom'

module.exports =
class FileView extends View
  @content: ->
    @li class: 'file entry list-item', =>
      @span class: 'name icon', outlet: 'fileName'

  initialize: (@file) ->
    @fileName.text(@file.getName())

    if @file.isSymlink()
      @fileName.addClass('icon-file-symlink-file')
    else
      switch @file.getType()
        when 'readme'     then @fileName.addClass('icon-book')
        when 'compressed' then @fileName.addClass('icon-file-zip')
        when 'image'      then @fileName.addClass('icon-file-media')
        when 'pdf'        then @fileName.addClass('icon-file-pdf')
        when 'binary'     then @fileName.addClass('icon-file-binary')
        when 'text'       then @fileName.addClass('icon-file-text')

    @subscribe @file.$status.onValue (status) => @updateStatus(status)

  updateStatus: (status) ->
    @removeClass('status-ignored status-modified status-added')
    @addClass("status-#{status}") if status?

  getPath: ->
    @file.getPath()
