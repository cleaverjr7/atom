{_, $, BufferedProcess, Editor, fs, View} = require 'atom'
path = require 'path'

module.exports =
class PackageGeneratorView extends View
  previouslyFocusedElement: null
  mode: null

  @content: ->
    @div class: 'package-generator overlay from-top', =>
      @subview 'miniEditor', new Editor(mini: true)
      @div class: 'error', outlet: 'error'
      @div class: 'message', outlet: 'message'

  initialize: ->
    rootView.command "package-generator:generate-package", => @attach('package')
    rootView.command "package-generator:generate-syntax-theme", => @attach('theme')
    @miniEditor.hiddenInput.on 'focusout', => @detach()
    @on 'core:confirm', => @confirm()
    @on 'core:cancel', => @detach()

  attach: (@mode) ->
    @previouslyFocusedElement = $(':focus')
    @message.text("Enter #{mode} path")
    placeholderName = "#{mode}-name"
    @miniEditor.setText(path.join(_.last(config.userPackageDirPaths), placeholderName))
    pathLength = @miniEditor.getText().length
    @miniEditor.setSelectedBufferRange([[0, pathLength - placeholderName.length], [0, pathLength]])

    rootView.append(this)
    @miniEditor.focus()

  detach: ->
    return unless @hasParent()
    @previouslyFocusedElement?.focus()
    super

  confirm: ->
    if @validPackagePath()
      @createPackageFiles =>
        packagePath = @getPackagePath()
        atom.packages.loadPackage(path.basename(packagePath))
        atom.open(pathsToOpen: [packagePath])
        @detach()

  getPackagePath: ->
    packagePath = @miniEditor.getText()
    packageName = _.dasherize(path.basename(packagePath))
    path.join(path.dirname(packagePath), packageName)

  validPackagePath: ->
    if fs.exists(@getPackagePath())
      @error.text("Path already exists at '#{@getPackagePath()}'")
      @error.show()
      false
    else
      true

  createPackageFiles: (callback) ->
    @runCommand("apm", ['init', "--#{@mode}", "#{@getPackagePath()}"], callback)

  runCommand: (command, args, exit) ->
    new BufferedProcess({command, args, exit})
