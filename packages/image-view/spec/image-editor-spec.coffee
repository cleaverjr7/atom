path = require 'path'
ImageEditor = require '../lib/image-editor'
ImageEditorView = require '../lib/image-editor-view'

describe "ImageEditor", ->
  describe ".deserialize(state)", ->
    it "returns undefined if no file exists at the given path", ->
      spyOn(console, 'warn') # suppress logging in spec
      editor = new ImageEditor(path.join(__dirname, 'fixtures', 'binary-file.png'))
      state = editor.serialize()
      expect(ImageEditor.deserialize(state)).toBeDefined()
      state.filePath = 'bogus'
      expect(ImageEditor.deserialize(state)).toBeUndefined()

  describe ".activate()", ->
    it "registers a project opener that handles image file extension", ->
      waitsForPromise ->
        atom.packages.activatePackage('image-view')

      runs ->
        atom.workspace.open(path.join(__dirname, 'fixtures', 'binary-file.png'))

      waitsFor ->
        atom.workspace.getActivePaneItem() instanceof ImageEditor

      runs ->
        expect(atom.workspace.getActivePaneItem().getTitle()).toBe 'binary-file.png'
        atom.workspace.destroyActivePaneItem()
        atom.packages.deactivatePackage('image-view')

        atom.workspace.open(path.join(__dirname, 'fixtures', 'binary-file.png'))

      waitsFor ->
        atom.workspace.getActivePaneItem()?

      runs ->
        expect(atom.workspace.getActivePaneItem() instanceof ImageEditor).toBe false

  describe "::onDidTerminatePendingState", ->
    item = null
    pendingSpy = null

    beforeEach ->
      pendingSpy = jasmine.createSpy("onDidTerminatePendingState")

      waitsForPromise ->
        atom.packages.activatePackage('image-view')

    it "is called when pending state gets terminated for the active ImageEditor", ->
      runs ->
        atom.workspace.open(path.join(__dirname, 'fixtures', 'binary-file.png'), pending: true)

      waitsFor ->
        atom.workspace.getActivePane().getPendingItem() instanceof ImageEditor

      runs ->
        item = atom.workspace.getActivePane().getPendingItem()
        expect(item.getTitle()).toBe 'binary-file.png'
        item.onDidTerminatePendingState pendingSpy
        item.terminatePendingState()
        expect(pendingSpy).toHaveBeenCalled()

    it "is not called when the ImageEditor is not pending", ->
      runs ->
        atom.workspace.open(path.join(__dirname, 'fixtures', 'binary-file.png'), pending: false)

      waitsFor ->
        atom.workspace.getActivePaneItem() instanceof ImageEditor

      runs ->
        item = atom.workspace.getActivePaneItem()
        expect(item.getTitle()).toBe 'binary-file.png'
        item.onDidTerminatePendingState pendingSpy
        item.terminatePendingState()
        expect(pendingSpy).not.toHaveBeenCalled()

  describe "when the image gets reopened", ->
    beforeEach ->
      waitsForPromise ->
        atom.packages.activatePackage('image-view')

    it "should not change the URI between each reopen", ->
      uri = null

      runs ->
        atom.workspace.open(path.join(__dirname, 'fixtures', 'binary-file.png'))

      waitsFor ->
        atom.workspace.getActivePaneItem() instanceof ImageEditor

      runs ->
        uri = atom.workspace.getActivePaneItem().getURI()
        atom.workspace.destroyActivePaneItem()
        atom.workspace.reopenItem()

      waitsFor ->
        atom.workspace.getActivePaneItem() instanceof ImageEditor

      runs ->
        expect(atom.workspace.getActivePaneItem().getURI()).toBe uri
