path = require 'path'

_ = require 'underscore-plus'
async = require 'async'
CSON = require 'season'
{$, $$, ScrollView} = require 'atom'

GeneralPanel = require './general-panel'
ThemesPanel = require './themes-panel'
PackageManager = require './package-manager'
InstalledPackageView = require './installed-package-view'
PackagesPanel = require './packages-panel'
KeybindingsPanel = require './keybindings-panel'

module.exports =
class SettingsView extends ScrollView
  @content: ->
    @div class: 'settings-view pane-item', tabindex: -1, =>
      @div class: 'config-menu', =>
        @div class: 'atom-banner'
        @ul class: 'panels-menu nav nav-pills nav-stacked', outlet: 'panelMenu'
        @div class: 'button-area', =>
          @button 'Open ~/.atom', class: 'btn btn-default icon icon-link-external', outlet: 'openDotAtom'
      @div class: 'panels padded', outlet: 'panels'

  initialize: ({@uri, @activePanelName}={}) ->
    super
    @packageManager = new PackageManager()
    @panelToShow = null
    process.nextTick => @activatePackages => @initializePanels()

  initializePanels: ->
    return if @panels.size > 0

    activePanelName = @panelToShow ? @activePanelName

    @panelsByName = {}
    @on 'click', '.panels-menu li a', (e) =>
      @showPanel($(e.target).closest('li').attr('name'))

    @openDotAtom.on 'click', ->
      atom.open(pathsToOpen: [atom.getConfigDirPath()])

    @addPanel('General Settings', 'settings', new GeneralPanel)
    @addPanel('Keybindings', 'keyboard', new KeybindingsPanel)
    @addPanel('Packages', 'package', new PackagesPanel(@packageManager))
    @addPanel('Themes', 'paintcan', new ThemesPanel(@packageManager))

    packages = atom.packages.getLoadedPackages()
    # Include disabled packages so they can be re-enabled from the UI
    for packageName in atom.config.get('core.disabledPackages') ? []
      packagePath = atom.packages.resolvePackagePath(packageName)
      if metadataPath = CSON.resolve(path.join(packagePath, 'package'))
        try
          metadata = CSON.readFileSync(metadataPath)
          name = metadata?.name ? packageName
          packages.push({name, metadata})

    packages.sort (pack1, pack2) ->
      title1 = _.undasherize(_.uncamelcase(pack1.name))
      title2 = _.undasherize(_.uncamelcase(pack2.name))
      title1.localeCompare(title2)

    @addPanelMenuSeparator()

    for pack in packages
      @addPanel(_.undasherize(_.uncamelcase(pack.name)), new InstalledPackageView(pack))

    @showPanel(activePanelName) if activePanelName

  serialize: ->
    deserializer: 'SettingsView'
    version: 2
    activePanelName: @activePanelName

  addPanelMenuSeparator: ->
    @panelMenu.append $$ ->
      @div class: 'panel-menu-separator'

  addPanel: (name, iconName, panel) ->
    if arguments.length is 2
      panel = iconName
      iconName = null

    panelItem = $$ ->
      @li name: name, =>
        if iconName
          @a class: "icon icon-#{iconName}", name
        else
          @a name

    @panelMenu.append(panelItem)
    panel.hide()
    @panelsByName[name] = panel
    @panels.append(panel)
    @showPanel(name) if @getPanelCount() is 1 or @panelToShow is name

  getPanelCount: ->
    _.values(@panelsByName).length

  showPanel: (name) ->
    if @panelsByName?[name]
      @panels.children().hide()
      @panelMenu.children('.active').removeClass('active')
      @panelsByName[name].show()
      for editorElement in @panelsByName[name].find(".editor")
        $(editorElement).view().redraw()
      @panelMenu.children("[name='#{name}']").addClass('active')
      @activePanelName = name
      @panelToShow = null
    else
      @panelToShow = name

  getTitle: ->
    "Settings"

  getUri: ->
    @uri

  isEqual: (other) ->
    other instanceof SettingsView

  activatePackages: (finishedCallback) ->
    iterator = (pack, callback) ->
      try
        pack.activateConfig()
      catch error
        console.error "Error activating package config for '#{pack.name}'", error
      finally
        callback()

    async.each atom.packages.getLoadedPackages(), iterator, finishedCallback
