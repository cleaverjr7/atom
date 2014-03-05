path = require 'path'
_ = require 'underscore-plus'
{$, BufferedProcess, EditorView, View} = require 'atom'
fs = require 'fs-plus'

module.exports =
class PackageGeneratorView extends View
  previouslyFocusedElement: null
  mode: null

  @content: ->
    @div class: 'package-generator overlay from-top', =>
      @subview 'miniEditor', new EditorView(mini: true)
      @div class: 'error', outlet: 'error'
      @div class: 'message', outlet: 'message'

  initialize: ->
    atom.workspaceView.command "package-generator:generate-package", => @attach('package')
    atom.workspaceView.command "package-generator:generate-syntax-theme", => @attach('theme')
    @miniEditor.hiddenInput.on 'focusout', => @detach()
    @on 'core:confirm', => @confirm()
    @on 'core:cancel', => @detach()

  attach: (@mode) ->
    @previouslyFocusedElement = $(':focus')
    @message.text("Enter #{mode} path")
    atom.workspaceView.append(this)
    if @mode == 'package'
      @setPathText("my-package")
    else
      @setPathText("my-theme-syntax", [0, 8])
    @miniEditor.focus()

  setPathText: (placeholderName, rangeToSelect) ->
    {editor} = @miniEditor
    rangeToSelect ?= [0, placeholderName.length]
    packagesDirectory = @getPackagesDirectory()
    editor.setText(path.join(packagesDirectory, placeholderName))
    pathLength = editor.getText().length
    endOfDirectoryIndex = pathLength - placeholderName.length
    editor.setSelectedBufferRange([[0, endOfDirectoryIndex + rangeToSelect[0]], [0, endOfDirectoryIndex + rangeToSelect[1]]])

  detach: ->
    return unless @hasParent()
    @previouslyFocusedElement?.focus()
    super

  confirm: ->
    if @validPackagePath()
      @createPackageFiles =>
        packagePath = @getPackagePath()
        atom.open(pathsToOpen: [packagePath])
        @detach()

  getPackagePath: ->
    packagePath = @miniEditor.getText()
    packageName = _.dasherize(path.basename(packagePath))
    path.join(path.dirname(packagePath), packageName)

  getPackagesDirectory: ->
    _.last(atom.packages.getPackageDirPaths())

  validPackagePath: ->
    if fs.existsSync(@getPackagePath())
      @error.text("Path already exists at '#{@getPackagePath()}'")
      @error.show()
      false
    else
      true

  initPackage: (packagePath, callback) ->
    @runCommand(atom.packages.getApmPath(), ['init', "--#{@mode}", "#{packagePath}"], callback)

  linkPackage: (packagePath, callback) ->
    @runCommand(atom.packages.getApmPath(), ['link', "#{packagePath}"], callback)

  createPackageFiles: (callback) ->
    packagePath = @getPackagePath()
    packagesDirectory = @getPackagesDirectory()

    if packagePath.indexOf(path.join(packagesDirectory, path.sep)) is 0
      @initPackage(packagePath, callback)
    else
      @initPackage packagePath, => @linkPackage(packagePath, callback)

  runCommand: (command, args, exit) ->
    new BufferedProcess({command, args, exit})
