path = require 'path'

fs = require 'fs-plus'
Serializable = require 'serializable'
{Disposable, Emitter, File} = require 'atom'
FileIcons = require './file-icons'
ArchiveEditorView = require './archive-editor-view'

isPathSupported = (filePath) ->
  switch path.extname(filePath)
    when '.egg', '.epub', '.jar', '.love', '.nupkg', '.tar', '.tgz', '.war', '.whl', '.xpi', '.zip'
      return true
    when '.gz'
      return path.extname(path.basename(filePath, '.gz')) is '.tar'
    else
      return false

module.exports=
class ArchiveEditor extends Serializable
  @activate: ->
    atom.workspace.addOpener (filePath='') ->
      # Check that the file path exists before opening in case something like
      # an http: URI is being opened.
      if isPathSupported(filePath) and fs.isFileSync(filePath)
        new ArchiveEditor(path: filePath)

  constructor: ({path}) ->
    @emitter = new Emitter()
    @file = new File(path)
    @view = new ArchiveEditorView(this)
    @element = @view.element

  serializeParams: ->
    path: @getPath()

  deserializeParams: (params={}) ->
    if fs.isFileSync(params.path)
      params
    else
      console.warn "Could not build archive editor for path '#{params.path}' because that file no longer exists"

  @consumeFileIcons: (service) ->
    FileIcons.setService(service)
    new Disposable ->
      FileIcons.resetService()

  getPath: ->
    @file.getPath()

  destroy: ->
    @view.destroy()
    @emitter.emit 'did-destroy'

  onDidDestroy: (callback) ->
    @emitter.on 'did-destroy', callback

  getTitle: ->
    if @getPath()?
      path.basename(@getPath())
    else
      'untitled'

  getURI: -> @getPath()

  isEqual: (other) ->
    other instanceof ArchiveEditor and @getURI() is other.getURI()
