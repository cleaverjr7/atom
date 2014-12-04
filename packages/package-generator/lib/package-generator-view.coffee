path = require 'path'
_ = require 'underscore-plus'
{$, TextEditorView, View} = require 'atom-space-pen-views'
{BufferedProcess} = require 'atom'
fs = require 'fs-plus'

module.exports =
class PackageGeneratorView extends View
  previouslyFocusedElement: null
  mode: null
  attached: false

  @content: ->
    @div class: 'package-generator', =>
      @subview 'miniEditor', new TextEditorView(mini: true)
      @div class: 'error', outlet: 'error'
      @div class: 'message', outlet: 'message'

  initialize: ->
    atom.commands.add 'atom-workspace',
      'package-generator:generate-package': => @attach('package')
      'package-generator:generate-syntax-theme': => @attach('theme')

    @miniEditor.on 'blur', => @close()
    @on 'core:confirm', => @confirm()
    @on 'core:cancel', => @close()

  attach: (@mode) ->
    @panel ?= atom.workspace.addModalPanel(item: this, visible: false)
    @attached = true
    @previouslyFocusedElement = $(document.activeElement)
    @panel.show()
    @message.text("Enter #{mode} path")
    if @mode == 'package'
      @setPathText("my-package")
    else
      @setPathText("my-theme-syntax", [0, 8])
    @miniEditor.focus()

  setPathText: (placeholderName, rangeToSelect) ->
    editor = @miniEditor.getModel()
    rangeToSelect ?= [0, placeholderName.length]
    packagesDirectory = @getPackagesDirectory()
    editor.setText(path.join(packagesDirectory, placeholderName))
    pathLength = editor.getText().length
    endOfDirectoryIndex = pathLength - placeholderName.length
    editor.setSelectedBufferRange([[0, endOfDirectoryIndex + rangeToSelect[0]], [0, endOfDirectoryIndex + rangeToSelect[1]]])

  close: ->
    return unless @panel.isVisible()
    @panel.hide()
    @previouslyFocusedElement?.focus()

  confirm: ->
    if @validPackagePath()
      @createPackageFiles =>
        packagePath = @getPackagePath()
        atom.open(pathsToOpen: [packagePath])
        @close()

  getPackagePath: ->
    packagePath = @miniEditor.getText()
    packageName = _.dasherize(path.basename(packagePath))
    path.join(path.dirname(packagePath), packageName)

  getPackagesDirectory: ->
    atom.config.get('core.projectHome') or
      process.env.ATOM_REPOS_HOME or
      path.join(fs.getHomeDirectory(), 'github')

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
    args = ['link']
    args.push('--dev') if atom.config.get('package-generator.createInDevMode')
    args.push packagePath.toString()

    @runCommand(atom.packages.getApmPath(), args, callback)

  isStoredInDotAtom: (packagePath) ->
    packagesPath = path.join(atom.getConfigDirPath(), 'packages', path.sep)
    return true if packagePath.indexOf(packagesPath) is 0

    devPackagesPath = path.join(atom.getConfigDirPath(), 'dev', 'packages', path.sep)
    packagePath.indexOf(devPackagesPath) is 0

  createPackageFiles: (callback) ->
    packagePath = @getPackagePath()
    packagesDirectory = @getPackagesDirectory()

    if @isStoredInDotAtom(packagePath)
      @initPackage(packagePath, callback)
    else
      @initPackage packagePath, => @linkPackage(packagePath, callback)

  runCommand: (command, args, exit) ->
    new BufferedProcess({command, args, exit})
