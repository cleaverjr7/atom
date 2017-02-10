path = require 'path'
KeybindingsPanel = require '../lib/keybindings-panel'

describe "KeybindingsPanel", ->
  [keyBindings, panel] = []

  beforeEach ->
    expect(atom.keymaps).toBeDefined()
    keyBindings = [
      {
        source: "#{atom.getLoadSettings().resourcePath}#{path.sep}keymaps"
        keystrokes: 'ctrl-a'
        command: 'core:select-all'
        selector: '.editor, .platform-test'
      }
      {
        source: "#{atom.getLoadSettings().resourcePath}#{path.sep}keymaps"
        keystrokes: 'ctrl-u'
        command: 'core:undo'
        selector: ".platform-test"
      }
      {
        source: "#{atom.getLoadSettings().resourcePath}#{path.sep}keymaps"
        keystrokes: 'ctrl-u'
        command: 'core:undo'
        selector: ".platform-a, .platform-b"
      }
    ]
    spyOn(atom.keymaps, 'getKeyBindings').andReturn(keyBindings)
    panel = new KeybindingsPanel

  it "loads and displays core key bindings", ->
    expect(panel.refs.keybindingRows.children.length).toBe 1

    row = panel.refs.keybindingRows.children[0]
    expect(row.querySelector('.keystroke').textContent).toBe 'ctrl-a'
    expect(row.querySelector('.command').textContent).toBe 'core:select-all'
    expect(row.querySelector('.source').textContent).toBe 'Core'
    expect(row.querySelector('.selector').textContent).toBe '.editor, .platform-test'

  describe "when a keybinding is copied", ->
    describe "when the keybinding file ends in .cson", ->
      it "writes a CSON snippet to the clipboard", ->
        spyOn(atom.keymaps, 'getUserKeymapPath').andReturn 'keymap.cson'
        panel.element.querySelector('.copy-icon').click()
        expect(atom.clipboard.read()).toBe """
          '.editor, .platform-test':
            'ctrl-a': 'core:select-all'
        """

    describe "when the keybinding file ends in .json", ->
      it "writes a JSON snippet to the clipboard", ->
        spyOn(atom.keymaps, 'getUserKeymapPath').andReturn 'keymap.json'
        panel.element.querySelector('.copy-icon').click()
        expect(atom.clipboard.read()).toBe """
          ".editor, .platform-test": {
            "ctrl-a": "core:select-all"
          }
        """

  describe "when the key bindings change", ->
    it "reloads the key bindings", ->
      keyBindings.push
        source: atom.keymaps.getUserKeymapPath(), keystrokes: 'ctrl-b', command: 'core:undo', selector: '.editor'
      atom.keymaps.emitter.emit 'did-reload-keymap'

      waitsFor ->
        panel.refs.keybindingRows.children.length is 2

      runs ->
        row = panel.refs.keybindingRows.children[panel.refs.keybindingRows.children.length - 1]
        expect(row.querySelector('.keystroke').textContent).toBe 'ctrl-b'
        expect(row.querySelector('.command').textContent).toBe 'core:undo'
        expect(row.querySelector('.source').textContent).toBe 'User'
        expect(row.querySelector('.selector').textContent).toBe '.editor'

  describe "when searching key bindings", ->
    it "find case-insensitive results", ->
      keyBindings.push
        source: "#{atom.getLoadSettings().resourcePath}#{path.sep}keymaps", keystrokes: 'F11', command: 'window:toggle-full-screen', selector: 'body'
      atom.keymaps.emitter.emit 'did-reload-keymap'

      panel.filterKeyBindings keyBindings, 'f11'

      expect(panel.refs.keybindingRows.children.length).toBe 1

      row = panel.refs.keybindingRows.children[0]
      expect(row.querySelector('.keystroke').textContent).toBe 'F11'
      expect(row.querySelector('.command').textContent).toBe 'window:toggle-full-screen'
      expect(row.querySelector('.source').textContent).toBe 'Core'
      expect(row.querySelector('.selector').textContent).toBe 'body'

    it "perform a fuzzy match for each keyword", ->
      panel.filterKeyBindings keyBindings, 'core ctrl-a'

      expect(panel.refs.keybindingRows.children.length).toBe 1

      row = panel.refs.keybindingRows.children[0]
      expect(row.querySelector('.keystroke').textContent).toBe 'ctrl-a'
      expect(row.querySelector('.command').textContent).toBe 'core:select-all'
      expect(row.querySelector('.source').textContent).toBe 'Core'
      expect(row.querySelector('.selector').textContent).toBe '.editor, .platform-test'
