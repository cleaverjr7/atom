_ = require 'underscore-plus'
{$$, EditorView, View} = require 'atom'

AvailablePackageView = require './available-package-view'
ErrorView = require './error-view'
PackageManager = require './package-manager'

module.exports =
class ThemesPanel extends View
  @content: ->
    @div =>
      @div class: 'section packages', =>
        @div class: 'section-heading theme-heading icon icon-device-desktop', 'Choose a Theme'

        @div class: 'text padded', =>
          @span class: 'icon icon-question', 'You can also style Atom by editing '
          @a class: 'link', outlet: 'openUserStysheet', 'your stylesheet'

        @form class: 'form-horizontal theme-chooser', =>
          @div class: 'form-group', =>
            @label class: 'col-sm-2 col-lg-2 control-label themes-label text', 'UI Theme'
            @div class: 'col-sm-10 col-lg-4 col-md-4', =>
              @select outlet: 'uiMenu', class: 'form-control'
              @div class: 'text theme-description', 'This styles the tabs, status bar, tree view, and dropdowns'

          @div class: 'form-group', =>
            @label class: 'col-sm-2 col-lg-2 control-label themes-label text', 'Syntax Theme'
            @div class: 'col-sm-10 col-lg-4 col-md-4', =>
              @select outlet: 'syntaxMenu', class: 'form-control'
              @div class: 'text theme-description', 'This styles the text inside the editor'

      @div class: 'section packages', =>
        @div class: 'section-heading theme-heading icon icon-cloud-download', 'Install Themes'

        @div class: 'editor-container padded', =>
          @subview 'searchEditorView', new EditorView(mini: true)

        @div outlet: 'errors'

        @div outlet: 'results', =>
          @div outlet: 'searchMessage', class: 'icon icon-search text'
          @div outlet: 'resultsContainer', class: 'container package-container'

        @div outlet: 'featured', =>
          @div class: 'icon icon-star text', 'Featured Themes'
          @div outlet: 'loadingMessage', class: 'padded text icon icon-hourglass', 'Loading featured themes\u2026'
          @div outlet: 'emptyMessage', class: 'padded text icon icon-heart', 'You have every featured theme installed already!'
          @div outlet: 'featuredContainer', class: 'container package-container'

  initialize: (@packageManager) ->
    @results.hide()
    @emptyMessage.hide()

    @searchEditorView.setPlaceholderText('Search themes')
    @searchEditorView.on 'core:confirm', =>
      if query = @searchEditorView.getText().trim()
        @search(query)

    @subscribe @packageManager, 'theme-install-failed', (pack, error) =>
      @errors.append(new ErrorView(error))

    @openUserStysheet.on 'click', =>
      atom.workspaceView.trigger('application:open-your-stylesheet')
      false

    @subscribe @packageManager, 'theme-installed', =>
      @populateThemeMenus()

    @subscribe atom.themes, 'reloaded', => @updateActiveThemes()
    @updateActiveThemes()

    @syntaxMenu.change =>
      @activeSyntaxTheme = @syntaxMenu.val()
      @updateThemeConfig()

    @uiMenu.change =>
      @activeUiTheme = @uiMenu.val()
      @updateThemeConfig()

    @loadAvailableThemes()

  # Update the active UI and syntax themes and populate the menu
  updateActiveThemes: ->
    @activeUiTheme = @getActiveUiTheme()
    @activeSyntaxTheme = @getActiveSyntaxTheme()
    @populateThemeMenus()

  # Populate the theme menus from the theme manager's active themes
  populateThemeMenus: ->
    @uiMenu.empty()
    @syntaxMenu.empty()
    availableThemes = _.sortBy(atom.themes.getLoadedThemes(), 'name')
    for {name, metadata} in availableThemes
      switch metadata.theme
        when 'ui'
          themeItem = @createThemeMenuItem(name)
          themeItem.prop('selected', true) if name is @activeUiTheme
          @uiMenu.append(themeItem)
        when 'syntax'
          themeItem = @createThemeMenuItem(name)
          themeItem.prop('selected', true) if name is @activeSyntaxTheme
          @syntaxMenu.append(themeItem)

  # Get the name of the active ui theme.
  getActiveUiTheme: ->
    for {name, metadata} in atom.themes.getActiveThemes()
      return name if metadata.theme is 'ui'
    null

  # Get the name of the active syntax theme.
  getActiveSyntaxTheme: ->
    for {name, metadata} in atom.themes.getActiveThemes()
      return name if metadata.theme is 'syntax'
    null

  # Update the config with the selected themes
  updateThemeConfig: ->
    setTimeout =>
      themes = []
      themes.push(@activeUiTheme) if @activeUiTheme
      themes.push(@activeSyntaxTheme) if @activeSyntaxTheme
      atom.themes.setEnabledThemes(themes) if themes.length > 0
    , 100

  # Create a menu item for the given theme name.
  createThemeMenuItem: (themeName) ->
    title = @getThemeTitle(themeName)
    $$ -> @option value: themeName, title

  # Get a human readable title for the given theme name.
  getThemeTitle: (themeName='') ->
    title = themeName.replace(/-(ui|syntax)/g, '')
    _.undasherize(_.uncamelcase(title))

  addThemeViews: (container, themes) ->
    container.empty()

    for theme, index in themes
      if index % 4 is 0
        themeRow = $$ -> @div class: 'row'
        container.append(themeRow)
      themeRow.append(new AvailablePackageView(theme, @packageManager))

  filterThemes: (themes) ->
    themes.filter ({theme}) -> theme

  filterInstalledThemes: (themes) ->
    installedThemes = atom.themes.getAvailableNames()
    @filterThemes(themes).filter ({name}) ->
      not (name in installedThemes)

  # Load and display themes available to install.
  loadAvailableThemes: ->
    @loadingMessage.show()
    @emptyMessage.hide()

    @packageManager.getFeatured()
      .then (themes) =>
        themes = @filterThemes(themes)
        if themes.length is 0
          @loadingMessage.hide()
          @emptyMessage.removeClass('icon-heart').addClass('icon-rocket')
          @emptyMessage.text('No featured themes, create and publish one!')
          @emptyMessage.show()
        else
          themes = @filterInstalledThemes(themes)
          @loadingMessage.hide()
          @addThemeViews(@featuredContainer, themes)
          @emptyMessage.show() if themes.length is 0
      .catch (error) =>
        @loadingMessage.hide()
        @errors.append(new ErrorView(error))

  search: (query) ->
    @results.show()
    @searchMessage.text("Searching for '#{query}'\u2026").show()

    @packageManager.search(query)
      .then (themes) =>
        themes = @filterInstalledThemes(themes)
        if themes.length is 0
          @searchMessage.text("No theme results for '#{query}'")
        else
          @searchMessage.text("Theme results for '#{query}'")
        @results.show()
        @addThemeViews(@resultsContainer, themes)
      .catch (error) =>
        @errors.append(new ErrorView(error))
