_ = require 'underscore-plus'
{$$, TextEditorView, View} = require 'atom-space-pen-views'
{Subscriber} = require 'emissary'
fuzzaldrin = require 'fuzzaldrin'

PackageCard = require './package-card'
ErrorView = require './error-view'

List = require './list'
ListView = require './list-view'
{ownerFromRepository} = require './utils'

module.exports =
class InstalledPackagesPanel extends View
  Subscriber.includeInto(this)
  @loadPackagesDelay: 300

  @content: ->
    @div =>
      @section class: 'section', =>
        @div class: 'section-container', =>
          @div class: 'section-heading icon icon-package', =>
            @text 'Installed Packages'
            @span outlet: 'totalPackages', class: 'section-heading-count badge badge-flexible', '…'
          @div class: 'editor-container', =>
            @subview 'filterEditor', new TextEditorView(mini: true, placeholderText: 'Filter packages by name')

          @div outlet: 'updateErrors'

          @section class: 'sub-section deprecated-packages', =>
            @h3 class: 'sub-section-heading icon icon-package', =>
              @text 'Deprecated Packages'
              @span outlet: 'deprecatedCount', class: 'section-heading-count badge badge-flexible', '…'
            @p 'Atom does not load deprecated packages. These packages may have updates available.'
            @div outlet: 'deprecatedPackages', class: 'container package-container', =>
              @div class: 'alert alert-info loading-area icon icon-hourglass', "Loading packages…"

          @section class: 'sub-section installed-packages', =>
            @h3 class: 'sub-section-heading icon icon-package', =>
              @text 'Community Packages'
              @span outlet: 'communityCount', class: 'section-heading-count badge badge-flexible', '…'
            @div outlet: 'communityPackages', class: 'container package-container', =>
              @div class: 'alert alert-info loading-area icon icon-hourglass', "Loading packages…"

          @section class: 'sub-section core-packages', =>
            @h3 class: 'sub-section-heading icon icon-package', =>
              @text 'Core Packages'
              @span outlet: 'coreCount', class: 'section-heading-count badge badge-flexible', '…'
            @div outlet: 'corePackages', class: 'container package-container', =>
              @div class: 'alert alert-info loading-area icon icon-hourglass', "Loading packages…"

          @section class: 'sub-section dev-packages', =>
            @h3 class: 'sub-section-heading icon icon-package', =>
              @text 'Development Packages'
              @span outlet: 'devCount', class: 'section-heading-count badge badge-flexible', '…'
            @div outlet: 'devPackages', class: 'container package-container', =>
              @div class: 'alert alert-info loading-area icon icon-hourglass', "Loading packages…"

  initialize: (@packageManager) ->
    @packageViews = []
    @items =
      dev: new List('name')
      core: new List('name')
      user: new List('name')
      deprecated: new List('name')
    @itemViews =
      dev: new ListView(@items.dev, @devPackages, @createPackageCard)
      core: new ListView(@items.core, @corePackages, @createPackageCard)
      user: new ListView(@items.user, @communityPackages, @createPackageCard)
      deprecated: new ListView(@items.deprecated, @deprecatedPackages, @createPackageCard)

    @filterEditor.getModel().onDidStopChanging => @matchPackages()

    @subscribe @packageManager, 'package-install-failed theme-install-failed package-uninstall-failed theme-uninstall-failed package-update-failed theme-update-failed', (pack, error) =>
      @updateErrors.append(new ErrorView(@packageManager, error))

    loadPackagesTimeout = null
    @subscribe @packageManager, 'package-updated package-installed package-uninstalled package-installed-alternative', =>
      clearTimeout(loadPackagesTimeout)
      loadPackagesTimeout = setTimeout =>
        @loadPackages()
      , InstalledPackagesPanel.loadPackagesDelay

    @loadPackages()

  focus: ->
    @filterEditor.focus()

  detached: ->
    @unsubscribe()

  filterPackages: (packages) ->
    packages.dev = packages.dev.filter ({theme}) -> not theme
    packages.user = packages.user.filter ({theme}) -> not theme
    packages.deprecated = packages.user.filter ({name}) -> atom.packages.isPackageDeprecated(name)
    packages.core = packages.core.filter ({theme}) -> not theme

    for pack in packages.core
      pack.repository ?= "https://github.com/atom/#{pack.name}"

    for packageType in ['dev', 'core', 'user', 'deprecated']
      for pack in packages[packageType]
        pack.owner = ownerFromRepository(pack.repository)

    packages

  sortPackages: (packages) ->
    comparator = (left, right) ->
      leftStatus = atom.packages.isPackageDisabled(left.name)
      rightStatus = atom.packages.isPackageDisabled(right.name)
      if leftStatus is rightStatus
        if left.name > right.name
          -1
        else if left.name < right.name
          1
        else
          0
      else if leftStatus > rightStatus
        -1
      else
        1
    packages.dev.sort(comparator)
    packages.core.sort(comparator)
    packages.user.sort(comparator)
    packages.deprecated.sort(comparator)
    packages

  loadPackages: ->
    packagesWithUpdates = {}
    @packageManager.getOutdated().then (packages) =>
      for {name, latestVersion} in packages
        packagesWithUpdates[name] = latestVersion
      @displayPackageUpdates(packagesWithUpdates)

    @packageViews = []
    @packageManager.getInstalled()
      .then (packages) =>
        @packages = @sortPackages(@filterPackages(packages))

        @devPackages.find('.alert.loading-area').remove()
        @items.dev.setItems(@packages.dev)

        @corePackages.find('.alert.loading-area').remove()
        @items.core.setItems(@packages.core)

        @communityPackages.find('.alert.loading-area').remove()
        @items.user.setItems(@packages.user)

        @deprecatedPackages.find('.alert.loading-area').remove()
        @items.deprecated.setItems(@packages.deprecated)

        # TODO show empty mesage per section

        @updateSectionCounts()
        @displayPackageUpdates(packagesWithUpdates)

      .catch (error) =>
        console.error error.message, error.stack
        @loadingMessage.hide()
        @featuredErrors.append(new ErrorView(@packageManager, error))

  displayPackageUpdates: (packagesWithUpdates) ->
    for packageType in ['dev', 'core', 'user', 'deprecated']
      for packageView in @itemViews[packageType].getViews()
        packageCard = packageView.find('.package-card').view()
        if newVersion = packagesWithUpdates[packageCard.pack.name]
          packageCard.displayAvailableUpdate(newVersion)

  createPackageCard: (pack) =>
    packageRow = $$ -> @div class: 'row'
    packView = new PackageCard(pack, @packageManager, {back: 'Packages'})
    packageRow.append(packView)
    packageRow

  filterPackageListByText: (text) ->
    return unless @packages

    for packageType in ['dev', 'core', 'user', 'deprecated']
      allViews = @itemViews[packageType].getViews()
      activeViews = @itemViews[packageType].filterViews (pack) ->
        return true if text is ''
        owner = pack.owner ? @ownerFromRepository(pack.repository)
        filterText = "#{pack.name} #{owner}"
        fuzzaldrin.score(filterText, text) > 0

      for view in allViews
        view.find('.package-card').hide().addClass('hidden')
      for view in activeViews
        view.find('.package-card').show().removeClass('hidden')

    @updateSectionCounts()

  updateSectionCounts: ->
    filterText = @filterEditor.getModel().getText()
    if filterText is ''
      @totalPackages.text(@packages.user.length + @packages.core.length + @packages.dev.length)
      @communityCount.text @packages.user.length
      @coreCount.text @packages.core.length
      @devCount.text @packages.dev.length
      @deprecatedCount.text @packages.deprecated.length
    else
      community = @communityPackages.find('.package-card:not(.hidden)').length
      @communityCount.text "#{community}/#{@packages.user.length}"
      dev = @devPackages.find('.package-card:not(.hidden)').length
      @devCount.text "#{dev}/#{@packages.dev.length}"
      core = @corePackages.find('.package-card:not(.hidden)').length
      @coreCount.text "#{core}/#{@packages.core.length}"
      deprecated = @deprecatedPackages.find('.package-card:not(.hidden)').length
      @deprecatedCount.text "#{deprecated}/#{@packages.deprecated.length}"

      shownPackages = dev + core + community
      totalPackages = @packages.user.length + @packages.core.length + @packages.dev.length
      @totalPackages.text "#{shownPackages}/#{totalPackages}"

  matchPackages: ->
    filterText = @filterEditor.getModel().getText()
    @filterPackageListByText(filterText)
