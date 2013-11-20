{_, $, RootView} = require 'atom'
CommandPalette = require '../lib/command-palette-view'

describe "CommandPalette", ->
  [palette] = []

  beforeEach ->
    atom.rootView = new RootView
    atom.rootView.openSync('sample.js')
    atom.packages.activatePackage("command-palette")
    atom.rootView.attachToDom().focus()
    atom.rootView.trigger 'command-palette:toggle'
    palette = atom.rootView.find('.command-palette').view()

  afterEach ->
    atom.rootView.remove()

  describe "when command-palette:toggle is triggered on the root view", ->
    it "shows a list of all valid command descriptions, names, and keybindings for the previously focused element", ->
      keyBindings = atom.keymap.keyBindingsMatchingElement(atom.rootView.getActiveView())
      for eventName, description of atom.rootView.getActiveView().events()
        eventLi = palette.list.children("[data-event-name='#{eventName}']")
        if description
          expect(eventLi).toExist()
          expect(eventLi.find('span')).toHaveText(description)
          expect(eventLi.find('span').attr('title')).toBe(eventName)
          for binding in keyBindings when binding.command == eventName
            expect(eventLi.find(".key-binding:contains(#{binding.keystroke})")).toExist()
        else
          expect(eventLi).not.toExist()

    it "displays all commands registerd on the window", ->
      editorEvents = atom.rootView.getActiveView().events()
      windowEvents = $(window).events()
      expect(_.isEmpty(windowEvents)).toBeFalsy()
      for eventName, description of windowEvents
        eventLi = palette.list.children("[data-event-name='#{eventName}']")
        description = editorEvents[eventName] unless description
        if description
          expect(eventLi).toExist()
          expect(eventLi.find('span')).toHaveText(description)
          expect(eventLi.find('span').attr('title')).toBe(eventName)
        else
          expect(eventLi).not.toExist()

    it "focuses the mini-editor and selects the first command", ->
      expect(palette.miniEditor.isFocused).toBeTruthy()
      expect(palette.find('.event:first')).toHaveClass 'selected'

    it "clears the previous mini editor text", ->
      palette.miniEditor.setText('hello')
      palette.trigger 'command-palette:toggle'
      atom.rootView.trigger 'command-palette:toggle'
      expect(palette.miniEditor.getText()).toBe ''

  describe "when command-palette:toggle is triggered on the open command palette", ->
    it "focus the root view and detaches the command palette", ->
      expect(palette.hasParent()).toBeTruthy()
      palette.trigger 'command-palette:toggle'
      expect(palette.hasParent()).toBeFalsy()
      expect(atom.rootView.getActiveView().isFocused).toBeTruthy()

  describe "when the command palette is cancelled", ->
    it "focuses the root view and detaches the command palette", ->
      expect(palette.hasParent()).toBeTruthy()
      palette.cancel()
      expect(palette.hasParent()).toBeFalsy()
      expect(atom.rootView.getActiveView().isFocused).toBeTruthy()

  describe "when an command selection is confirmed", ->
    it "detaches the palette, then focuses the previously focused element and emits the selected command on it", ->
      eventHandler = jasmine.createSpy 'eventHandler'
      activeEditor = atom.rootView.getActiveView()
      {eventName} = palette.array[5]
      activeEditor.preempt eventName, eventHandler

      palette.confirmed(palette.array[5])

      expect(activeEditor.isFocused).toBeTruthy()
      expect(eventHandler).toHaveBeenCalled()
      expect(palette.hasParent()).toBeFalsy()

  describe "when no element has focus", ->
    it "uses the root view as the element to display and trigger events for", ->
      atom.rootView.trigger 'command-palette:toggle'
      $(':focus').blur()
      atom.rootView.trigger 'command-palette:toggle'
      keyBindings = atom.keymap.keyBindingsMatchingElement(atom.rootView.getActiveView())
      for eventName, description of atom.rootView.events()
        eventLi = palette.list.children("[data-event-name='#{eventName}']")
        if description
          expect(eventLi).toExist()
          expect(eventLi.find('span')).toHaveText(description)
          expect(eventLi.find('span').attr('title')).toBe(eventName)
          for binding in keyBindings when binding.command is eventName
            expect(eventLi.find(".key-binding:contains(#{binding.keystroke})")).toExist()
        else
          expect(eventLi).not.toExist()

  describe "when the body has focus", ->
    it "uses the root view as the element to display and trigger events for", ->
      atom.rootView.trigger 'command-palette:toggle'
      $(document.body).focus()
      atom.rootView.trigger 'command-palette:toggle'
      keyBindings = atom.keymap.keyBindingsMatchingElement(atom.rootView.getActiveView())
      for eventName, description of atom.rootView.events()
        eventLi = palette.list.children("[data-event-name='#{eventName}']")
        if description
          expect(eventLi).toExist()
          expect(eventLi.find('span')).toHaveText(description)
          expect(eventLi.find('span').attr('title')).toBe(eventName)
          for binding in keyBindings when binding.command is eventName
            expect(eventLi.find(".key-binding:contains(#{binding.keystroke})")).toExist()
        else
          expect(eventLi).not.toExist()
