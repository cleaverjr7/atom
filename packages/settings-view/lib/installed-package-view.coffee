path = require 'path'
url = require 'url'

_ = require 'underscore-plus'
fs = require 'fs-plus'
shell = require 'shell'
{View} = require 'atom-space-pen-views'
{Subscriber} = require 'emissary'

ErrorView = require './error-view'
AvailablePackageView = require './available-package-view'
PackageGrammarsView = require './package-grammars-view'
PackageKeymapView = require './package-keymap-view'
PackageSnippetsView = require './package-snippets-view'
SettingsPanel = require './settings-panel'

module.exports =
class InstalledPackageView extends View
  Subscriber.includeInto(this)

  @content: (pack, packageManager) ->
    @div =>
      @ol outlet: 'breadcrumbContainer', class: 'native-key-bindings breadcrumb', tabindex: -1, =>
        @li =>
          @a outlet: 'breadcrumb'
        @li class: 'active', =>
          @a outlet: 'title'

      @section class: 'section', =>
        @form class: 'section-container installed-package-view', =>
          @div outlet: 'updateArea', class: 'alert alert-success package-update', =>
            @span outlet: 'updateLabel', class: 'icon icon-squirrel update-message'
            @span outlet: 'updateLink', class: 'alert-link update-link icon icon-cloud-download', 'Install'

          @div class: 'container package-container', =>
            @div class: 'row', =>
              @subview 'packageCard', new AvailablePackageView(pack.metadata, packageManager)

          @p outlet: 'packageRepo', class: 'link icon icon-repo repo-link'

          @p outlet: 'startupTime', class: 'text icon icon-dashboard native-key-bindings', tabindex: -1

          @div outlet: 'buttons', class: 'btn-wrap-group', =>
            @button outlet: 'learnMoreButton', class: 'btn btn-default icon icon-link', 'View on Atom.io', =>
            @button outlet: 'issueButton', class: 'btn btn-default icon icon-bug', 'Report Issue'
            @button outlet: 'readmeButton', class: 'btn btn-default icon icon-book', 'README'
            @button outlet: 'changelogButton', class: 'btn btn-default icon icon-squirrel', 'CHANGELOG'
            @button outlet: 'licenseButton', class: 'btn btn-default icon icon-law', 'LICENSE'
            @button outlet: 'openButton', class: 'btn btn-default icon icon-link-external', 'View Code'

          @div outlet: 'errors'

      @div outlet: 'sections'

  initialize: (@pack, @packageManager) ->
    @activate()
    @populate()
    @handleButtonEvents()
    @updateFileButtons()
    @checkForUpdate()
    @subscribeToPackageManager()

  activate: ->
    # Package.activateConfig() is part of the Private package API and should not be used outside of core.
    @pack.activateConfig() if not atom.packages.isPackageActive(@pack.name)

  detached: ->
    @unsubscribe()

  beforeShow: (opts) ->
    if opts?.back
      @breadcrumb.text(opts.back).on 'click', () =>
        @parents('.settings-view').view()?.showPanel(opts.back)
    else
      @breadcrumbContainer.hide()

  populate: ->
    @title.text("#{_.undasherize(_.uncamelcase(@pack.name))}")

    @type = if @pack.metadata.theme then 'theme' else 'package'
    @startupTime.html("This #{@type} added <span class='highlight'>#{@getStartupTime()}ms</span> to startup time.")

    if repoUrl = @packageManager.getRepositoryUrl(@pack)
      repoName = url.parse(repoUrl).pathname
      @packageRepo.text(repoName.substring(1)).show()
    else
      @packageRepo.hide()

    @sections.empty()
    @sections.append(new SettingsPanel(@pack.name, {includeTitle: false}))
    @sections.append(new PackageKeymapView(@pack.name))
    @sections.append(new PackageGrammarsView(@pack.path))
    @sections.append(new PackageSnippetsView(@pack.path))

  subscribeToPackageManager: ->
    @subscribe @packageManager, 'theme-updated package-updated', (pack, newVersion) =>
      return unless @pack.name is pack.name

      @updateFileButtons()
      @updateArea.hide()
      if updatedPackage = atom.packages.getLoadedPackage(@pack.name)
        @pack = updatedPackage
        @populate()

  handleButtonEvents: ->
    @packageRepo.on 'click', =>
      if repoUrl = @packageManager.getRepositoryUrl(@pack)
        shell.openExternal(repoUrl)
      false

    @issueButton.on 'click', =>
      if repoUrl = @packageManager.getRepositoryUrl(@pack)
        shell.openExternal("#{repoUrl}/issues/new")
      false

    @readmeButton.on 'click', =>
      @openMarkdownFile(@readmePath) if @readmePath
      false

    @changelogButton.on 'click', =>
      @openMarkdownFile(@changelogPath) if @changelogPath
      false

    @licenseButton.on 'click', =>
      @openMarkdownFile(@licensePath) if @licensePath
      false

    @openButton.on 'click', =>
      atom.open(pathsToOpen: [@pack.path]) if fs.existsSync(@pack.path)
      false

    @learnMoreButton.on 'click', =>
      shell.openExternal "https://atom.io/packages/#{@pack.name}"
      false

  openMarkdownFile: (path) ->
    if atom.packages.isPackageActive('markdown-preview')
      atom.workspace.open("#{encodeURI("markdown-preview://#{path}")}")
    else
      atom.workspace.open(path)

  updateFileButtons: ->
    @changelogPath = null
    @licensePath = null
    @readmePath = null

    for child in fs.listSync(@pack.path)
      switch path.basename(child, path.extname(child)).toLowerCase()
        when 'changelog', 'history' then @changelogPath = child
        when 'license', 'licence' then @licensePath = child
        when 'readme' then @readmePath = child

      break if @readmePath and @changelogPath and @licensePath

    if @changelogPath then @changelogButton.show() else @changelogButton.hide()
    if @licensePath then @licenseButton.show() else @licenseButton.hide()
    if @readmePath then @readmeButton.show() else @readmeButton.hide()

  getStartupTime: ->
    loadTime = @pack.loadTime ? 0
    activateTime = @pack.activateTime ? 0
    loadTime + activateTime

  installUpdate: ->
    return if @updateLink.prop('disabled')
    return unless @availableVersion

    @updateLink.prop('disabled', true)
    @updateLink.text('Installing\u2026')

    @packageManager.update @pack, @availableVersion, (error) =>
      if error?
        @updateLink.prop('disabled', false)
        @updateLink.text('Install')
        @errors.append(new ErrorView(@packageManager, error))

  checkForUpdate: ->
    @updateArea.hide()
    return if atom.packages.isBundledPackage(@pack.name)

    @updateLink.on 'click', => @installUpdate()

    @packageManager.getOutdated().then (packages) =>
      for pack in packages when pack.name is @pack.name
        if @packageManager.canUpgrade(@pack, pack.latestVersion)
          @availableVersion = pack.latestVersion
          @updateLabel.text("Version #{@availableVersion} is now available!")
          @updateArea.show()
