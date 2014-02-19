{fs, WorkspaceView} = require 'atom'

describe "Archive viewer", ->
  archiveView = null

  beforeEach ->
    atom.workspaceView = new WorkspaceView
    atom.workspace = atom.workspaceView.model

    waitsForPromise ->
      atom.packages.activatePackage('archive-view')

    waitsForPromise ->
      atom.workspaceView.open('nested.tar')

    runs ->
      archiveView = atom.workspaceView.find('.archive-editor').view()

  describe ".initialize()", ->
    it "displays the files and folders in the archive file", ->
      expect(archiveView).toExist()

      waitsFor -> archiveView.find('.entry').length > 0

      runs ->
        expect(archiveView.find('.directory').length).toBe 6
        expect(archiveView.find('.directory:eq(0)').text()).toBe 'd1'
        expect(archiveView.find('.directory:eq(1)').text()).toBe 'd2'
        expect(archiveView.find('.directory:eq(2)').text()).toBe 'd3'
        expect(archiveView.find('.directory:eq(3)').text()).toBe 'd4'
        expect(archiveView.find('.directory:eq(4)').text()).toBe 'da'
        expect(archiveView.find('.directory:eq(5)').text()).toBe 'db'

        expect(archiveView.find('.file').length).toBe 3
        expect(archiveView.find('.file:eq(0)').text()).toBe 'f1.txt'
        expect(archiveView.find('.file:eq(1)').text()).toBe 'f2.txt'
        expect(archiveView.find('.file:eq(2)').text()).toBe 'fa.txt'

    it "selects the first file", ->
      waitsFor -> archiveView.find('.entry').length > 0
      runs -> expect(archiveView.find('.selected').text()).toBe 'f1.txt'

  describe "when core:move-up/core:move-down is triggered", ->
    it "selects the next/previous file", ->
      waitsFor -> archiveView.find('.entry').length > 0

      runs ->
        archiveView.find('.selected').trigger 'core:move-up'
        expect(archiveView.find('.selected').text()).toBe 'f1.txt'
        archiveView.find('.selected').trigger 'core:move-down'
        expect(archiveView.find('.selected').text()).toBe 'f2.txt'
        archiveView.find('.selected').trigger 'core:move-down'
        expect(archiveView.find('.selected').text()).toBe 'fa.txt'
        archiveView.find('.selected').trigger 'core:move-down'
        expect(archiveView.find('.selected').text()).toBe 'fa.txt'
        archiveView.find('.selected').trigger 'core:move-up'
        expect(archiveView.find('.selected').text()).toBe 'f2.txt'
        archiveView.find('.selected').trigger 'core:move-up'
        expect(archiveView.find('.selected').text()).toBe 'f1.txt'

  describe "when a file is clicked", ->
    it "copies the contents to a temp file and opens it in a new editor", ->
      waitsFor ->
        archiveView.find('.entry').length > 0

      runs ->
        archiveView.find('.file:eq(2)').trigger 'click'

      waitsFor ->
        atom.workspaceView.getActivePane().getItems().length > 1

      runs ->
        expect(atom.workspaceView.getActiveView().getText()).toBe 'hey there\n'
        expect(atom.workspaceView.getActivePaneItem().getTitle()).toBe 'fa.txt'

  describe "when core:confirm is triggered", ->
    it "copies the contents to a temp file and opens it in a new editor", ->
      waitsFor ->
        archiveView.find('.entry').length > 0

      runs ->
        archiveView.find('.file:eq(0)').trigger 'core:confirm'

      waitsFor ->
        atom.workspaceView.getActivePane().getItems().length > 1

      runs ->
        expect(atom.workspaceView.getActiveView().getText()).toBe ''
        expect(atom.workspaceView.getActivePaneItem().getTitle()).toBe 'f1.txt'

  describe "when the file is removed", ->
    it "destroys the view", ->
      waitsFor ->
        archiveView.find('.entry').length > 0

      runs ->
        expect(atom.workspaceView.getActivePane().getItems().length).toBe 1
        atom.workspaceView.getActivePaneItem().file.emit('removed')
        expect(atom.workspaceView.getActivePaneItem()).toBeUndefined()

  describe "when the file is modified", ->
    it "refreshes the view", ->
      waitsFor ->
        archiveView.find('.entry').length > 0

      runs ->
        spyOn(archiveView, 'refresh')
        atom.workspaceView.getActivePaneItem().file.emit('contents-changed')
        expect(archiveView.refresh).toHaveBeenCalled()
