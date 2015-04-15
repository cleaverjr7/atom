path = require 'path'
{$, $$} = require 'atom-space-pen-views'
SettingsView = require '../lib/settings-view'

describe "SettingsView", ->
  settingsView = null

  beforeEach ->
    settingsView = new SettingsView
    spyOn(settingsView, "initializePanels").andCallThrough()
    window.advanceClock(10000)
    waitsFor ->
      settingsView.initializePanels.callCount > 0

  describe "serialization", ->
    it "remembers which panel was visible", ->
      settingsView.showPanel('Themes')
      newSettingsView = new SettingsView(settingsView.serialize())
      settingsView.remove()
      jasmine.attachToDOM(newSettingsView.element)
      newSettingsView.initializePanels()
      expect(newSettingsView.activePanelName).toBe 'Themes'

    it "shows the previously active panel if it is added after deserialization", ->
      settingsView.addCorePanel('Panel 1', 'panel1', -> $$ -> @div id: 'panel-1')
      settingsView.showPanel('Panel 1')
      newSettingsView = new SettingsView(settingsView.serialize())
      newSettingsView.addPanel('Panel 1', 'panel1', -> $$ -> @div id: 'panel-1')
      newSettingsView.initializePanels()
      jasmine.attachToDOM(newSettingsView.element)
      expect(newSettingsView.activePanelName).toBe 'Panel 1'

    it "shows the Settings panel if the last saved active panel name no longer exists", ->
      settingsView.addCorePanel('Panel 1', 'panel1', -> $$ -> @div id: 'panel-1')
      settingsView.showPanel('Panel 1')
      newSettingsView = new SettingsView(settingsView.serialize())
      settingsView.remove()
      jasmine.attachToDOM(newSettingsView.element)
      newSettingsView.initializePanels()
      expect(newSettingsView.activePanelName).toBe 'Settings'

    it "serializes the active panel name even when the panels were never initialized", ->
      settingsView.showPanel('Themes')
      settingsView2 = new SettingsView(settingsView.serialize())
      settingsView3 = new SettingsView(settingsView2.serialize())
      jasmine.attachToDOM(settingsView3.element)
      settingsView3.initializePanels()
      expect(settingsView3.activePanelName).toBe 'Themes'

  describe ".addCorePanel(name, iconName, view)", ->
    it "adds a menu entry to the left and a panel that can be activated by clicking it", ->
      settingsView.addCorePanel('Panel 1', 'panel1', -> $$ -> @div id: 'panel-1')
      settingsView.addCorePanel('Panel 2', 'panel2', -> $$ -> @div id: 'panel-2')

      expect(settingsView.panelMenu.find('li a:contains(Panel 1)')).toExist()
      expect(settingsView.panelMenu.find('li a:contains(Panel 2)')).toExist()
      expect(settingsView.panelMenu.children(':first')).toHaveClass 'active'

      jasmine.attachToDOM(settingsView.element)
      settingsView.panelMenu.find('li a:contains(Panel 1)').click()
      expect(settingsView.panelMenu.children('.active').length).toBe 1
      expect(settingsView.panelMenu.find('li:contains(Panel 1)')).toHaveClass('active')
      expect(settingsView.panels.find('#panel-1')).toBeVisible()
      expect(settingsView.panels.find('#panel-2')).not.toExist()
      settingsView.panelMenu.find('li a:contains(Panel 2)').click()
      expect(settingsView.panelMenu.children('.active').length).toBe 1
      expect(settingsView.panelMenu.find('li:contains(Panel 2)')).toHaveClass('active')
      expect(settingsView.panels.find('#panel-1')).toBeHidden()
      expect(settingsView.panels.find('#panel-2')).toBeVisible()

  describe "when the package is activated", ->
    [mainModule] = []
    beforeEach ->
      jasmine.attachToDOM(atom.views.getView(atom.workspace))
      waitsForPromise ->
        atom.packages.activatePackage('settings-view')

    describe "when the settings view is opened with a settings-view:* command", ->
      openWithCommand = (command) ->
        atom.commands.dispatch(atom.views.getView(atom.workspace), command)
        waitsFor ->
          atom.workspace.getActivePaneItem()?

      beforeEach ->
        settingsView = null

      describe "settings-view:open", ->
        it "opens the settings view", ->
          openWithCommand('settings-view:open')
          runs ->
            expect(atom.workspace.getActivePaneItem().activePanelName).toBe 'Settings'

      describe "settings-view:show-keybindings", ->
        it "opens the settings view to the keybindings page", ->
          openWithCommand('settings-view:show-keybindings')
          runs ->
            expect(atom.workspace.getActivePaneItem().activePanelName).toBe 'Keybindings'

      describe "settings-view:change-themes", ->
        it "opens the settings view to the themes page", ->
          openWithCommand('settings-view:change-themes')
          runs ->
            expect(atom.workspace.getActivePaneItem().activePanelName).toBe 'Themes'

      describe "settings-view:uninstall-themes", ->
        it "opens the settings view to the themes page", ->
          openWithCommand('settings-view:uninstall-themes')
          runs ->
            expect(atom.workspace.getActivePaneItem().activePanelName).toBe 'Themes'

      describe "settings-view:uninstall-packages", ->
        it "opens the settings view to the install page", ->
          openWithCommand('settings-view:uninstall-packages')
          runs ->
            expect(atom.workspace.getActivePaneItem().activePanelName).toBe 'Packages'

      describe "settings-view:install-packages-and-themes", ->
        it "opens the settings view to the install page", ->
          openWithCommand('settings-view:install-packages-and-themes')
          runs ->
            expect(atom.workspace.getActivePaneItem().activePanelName).toBe 'Install'

      describe "settings-view:check-for-package-updates", ->
        it "opens the settings view to the install page", ->
          openWithCommand('settings-view:check-for-package-updates')
          runs ->
            expect(atom.workspace.getActivePaneItem().activePanelName).toBe 'Updates'

    describe "when atom.workspace.open() is used with a config URI", ->
      focusIsWithinActivePanel = ->
        activePanel = settingsView.panelsByName[settingsView.activePanelName]
        # Return true if the element that has the focus, or its ancestors, is the activePanel
        $(document.activeElement).parents().addBack().toArray().indexOf(activePanel.element) != -1

      beforeEach ->
        settingsView = null

      it "opens and focuses the settings to the correct panel with atom://config/<panel-name>", ->
        waitsForPromise ->
          atom.workspace.open('atom://config').then (s) -> settingsView = s

        waits 1
        runs ->
          expect(settingsView.activePanelName).toBe 'Settings'
          expect(focusIsWithinActivePanel()).toBe true

        waitsForPromise ->
          atom.workspace.open('atom://config/themes').then (s) -> settingsView = s

        waits 1
        runs ->
          expect(settingsView.activePanelName).toBe 'Themes'
          expect(focusIsWithinActivePanel()).toBe true

        waitsForPromise ->
          atom.workspace.open('atom://config/install').then (s) -> settingsView = s

        waits 1
        runs ->
          expect(settingsView.activePanelName).toBe 'Install'
          expect(focusIsWithinActivePanel()).toBe true

    describe "when scrolling with core:page-up and core:page-down", ->
      panels = null
      activePanel = null
      settingsView = null
      beforeEach ->
        panels = null
        activePanel = null
        settingsView = null

      it "handles core:page-down", ->
        waitsForPromise ->
          atom.workspace.open('atom://config').then (s) -> settingsView = s
        waits 1
        runs ->
          panels = settingsView.panels
          activePanel = settingsView.panelsByName[settingsView.activePanelName]
          spyOn(panels, 'pageDown')
          atom.commands.dispatch(activePanel.element, 'core:page-down')
          expect(panels.pageDown).toHaveBeenCalled()

      it "handles core:page-up", ->
        waitsForPromise ->
          atom.workspace.open('atom://config').then (s) -> settingsView = s
        waits 1
        runs ->
          panels = settingsView.panels
          activePanel = settingsView.panelsByName[settingsView.activePanelName]
          spyOn(panels, 'pageUp')
          atom.commands.dispatch(activePanel.element, 'core:page-up')
          expect(panels.pageUp).toHaveBeenCalled()
