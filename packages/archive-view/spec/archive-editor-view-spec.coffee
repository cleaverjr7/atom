{Disposable, File} = require 'atom'

IconServices = require '../lib/icon-services'

describe "Archive viewer", ->
  [archiveEditor, onDidDeleteCallback, onDidChangeCallback] = []

  beforeEach ->
    spyOn(File::, 'onDidDelete').andCallFake (callback) ->
      onDidDeleteCallback = callback if @getPath().match /\.tar$/
      new Disposable

    spyOn(File::, 'onDidChange').andCallFake (callback) ->
      onDidChangeCallback = callback if @getPath().match /\.tar$/
      new Disposable

    waitsForPromise ->
      atom.packages.activatePackage('archive-view')

    waitsForPromise ->
      atom.workspace.open('nested.tar')

    runs ->
      archiveEditor = atom.workspace.getActivePaneItem()

  describe ".constructor()", ->
    it "displays the files and folders in the archive file", ->
      expect(archiveEditor.element).toExist()

      waitsFor -> archiveEditor.element.querySelectorAll('.entry').length > 0

      runs ->
        expect(archiveEditor.element.querySelectorAll('.directory').length).toBe 6
        expect(archiveEditor.element.querySelectorAll('.directory')[0].textContent).toBe 'd1'
        expect(archiveEditor.element.querySelectorAll('.directory')[1].textContent).toBe 'd2'
        expect(archiveEditor.element.querySelectorAll('.directory')[2].textContent).toBe 'd3'
        expect(archiveEditor.element.querySelectorAll('.directory')[3].textContent).toBe 'd4'
        expect(archiveEditor.element.querySelectorAll('.directory')[4].textContent).toBe 'da'
        expect(archiveEditor.element.querySelectorAll('.directory')[5].textContent).toBe 'db'

        expect(archiveEditor.element.querySelectorAll('.file').length).toBe 3
        expect(archiveEditor.element.querySelectorAll('.file')[0].textContent).toBe 'f1.txt'
        expect(archiveEditor.element.querySelectorAll('.file')[1].textContent).toBe 'f2.txt'
        expect(archiveEditor.element.querySelectorAll('.file')[2].textContent).toBe 'fa.txt'

    it "selects the first file", ->
      waitsFor -> archiveEditor.element.querySelectorAll('.entry').length > 0
      runs -> expect(archiveEditor.element.querySelector('.selected').textContent).toBe 'f1.txt'

  describe "when core:move-up/core:move-down is triggered", ->
    it "selects the next/previous file", ->
      waitsFor ->
        archiveEditor.element.querySelectorAll('.entry').length > 0

      runs ->
        atom.commands.dispatch archiveEditor.element.querySelector('.selected'), 'core:move-up'
        expect(archiveEditor.element.querySelector('.selected').textContent).toBe 'f1.txt'
        atom.commands.dispatch archiveEditor.element.querySelector('.selected'), 'core:move-down'
        expect(archiveEditor.element.querySelector('.selected').textContent).toBe 'f2.txt'
        atom.commands.dispatch archiveEditor.element.querySelector('.selected'), 'core:move-down'
        expect(archiveEditor.element.querySelector('.selected').textContent).toBe 'fa.txt'
        atom.commands.dispatch archiveEditor.element.querySelector('.selected'), 'core:move-down'
        expect(archiveEditor.element.querySelector('.selected').textContent).toBe 'fa.txt'
        atom.commands.dispatch archiveEditor.element.querySelector('.selected'), 'core:move-up'
        expect(archiveEditor.element.querySelector('.selected').textContent).toBe 'f2.txt'
        atom.commands.dispatch archiveEditor.element.querySelector('.selected'), 'core:move-up'
        expect(archiveEditor.element.querySelector('.selected').textContent).toBe 'f1.txt'

  describe "when a file is clicked", ->
    it "copies the contents to a temp file and opens it in a new editor", ->
      waitsFor ->
        archiveEditor.element.querySelectorAll('.entry').length > 0

      runs ->
        archiveEditor.element.querySelectorAll('.file')[2].click()

      waitsFor ->
        atom.workspace.getActivePane().getItems().length > 1

      runs ->
        expect(atom.workspace.getActivePaneItem().getText()).toBe 'hey there\n'
        expect(atom.workspace.getActivePaneItem().getTitle()).toBe 'fa.txt'

  describe "when core:confirm is triggered", ->
    it "copies the contents to a temp file and opens it in a new editor", ->
      waitsFor ->
        archiveEditor.element.querySelectorAll('.entry').length > 0

      runs ->
        atom.commands.dispatch archiveEditor.element.querySelector('.file'), 'core:confirm'

      waitsFor ->
        atom.workspace.getActivePane().getItems().length > 1

      runs ->
        expect(atom.workspace.getActivePaneItem().getText()).toBe ''
        expect(atom.workspace.getActivePaneItem().getTitle()).toBe 'f1.txt'

  describe "when the file is removed", ->
    it "destroys the view", ->
      waitsFor ->
        archiveEditor.element.querySelectorAll('.entry').length > 0

      runs ->
        expect(atom.workspace.getActivePane().getItems().length).toBe 1
        onDidDeleteCallback()
        expect(atom.workspace.getActivePaneItem()).toBeUndefined()

  describe "when the file is modified", ->
    it "refreshes the view", ->
      waitsFor ->
        archiveEditor.element.querySelectorAll('.entry').length > 0

      runs ->
        spyOn(archiveEditor.view, 'refresh')
        onDidChangeCallback()
        expect(archiveEditor.view.refresh).toHaveBeenCalled()

  describe "when the file is invalid", ->
    beforeEach ->
      waitsForPromise ->
        atom.workspace.open('invalid.zip')

      runs ->
        archiveEditor = atom.workspace.getActivePaneItem()
        jasmine.attachToDOM(atom.views.getView(atom.workspace))

    it "shows the error", ->
      waitsFor ->
        archiveEditor.view.refs.errorMessage.offsetHeight > 0

      runs ->
        expect(archiveEditor.view.refs.errorMessage.textContent.length).toBeGreaterThan 0

  describe "FileIcons", ->
    openFile = ->
      waitsForPromise ->
        atom.workspace.open('file-icons.zip')

      runs ->
        archiveEditor = atom.workspace.getActivePaneItem()
        jasmine.attachToDOM(atom.views.getView(atom.workspace))

    describe "Icon service", ->
      beforeEach -> openFile()

      it "provides a default service", ->
        expect(IconServices.get 'file-icons').toBeDefined()
        expect(IconServices.get 'file-icons').not.toBeNull()

      it "allows the default to be overridden", ->
        service = iconClassForPath: ->
        IconServices.set 'file-icons', service
        expect(IconServices.get 'file-icons').toBe(service)

      it "allows service to be reset without hassle", ->
        service = iconClassForPath: ->
        IconServices.set 'file-icons', service
        IconServices.reset 'file-icons'
        expect(IconServices.get 'file-icons').not.toBe(service)

    describe "Class handling", ->
      findEntryContainingText = (text) ->
        for entry in archiveEditor.element.querySelectorAll('.list-item.entry')
          if entry.textContent.includes(text)
            return entry
        return null

      checkMultiClass = ->
        expect(findEntryContainingText('adobe.pdf').querySelector('.file.icon').className).toBe("file icon text pdf-icon document")
        expect(findEntryContainingText('spacer.gif').querySelector('.file.icon').className).toBe("file icon binary gif-icon image")
        expect(findEntryContainingText('font.ttf').querySelector('.file.icon').className).toBe("file icon binary ttf-icon font")

      it "displays default file-icons", ->
        openFile()

        waitsFor ->
          archiveEditor.element.querySelectorAll('.entry').length > 0

        runs ->
          expect(findEntryContainingText('adobe.pdf').querySelector('.file.icon.icon-file-pdf').length).not.toBe(0)
          expect(findEntryContainingText('spacer.gif').querySelector('.file.icon.icon-file-media').length).not.toBe(0)
          expect(findEntryContainingText('sunn.o').querySelector('.file.icon.icon-file-binary').length).not.toBe(0)

      it "allows multiple classes to be passed", ->
        IconServices.set 'file-icons',
          iconClassForPath: (path) ->
            switch path.match(/\w*$/)[0]
              when "pdf" then "text pdf-icon document"
              when "ttf" then "binary ttf-icon font"
              when "gif" then "binary gif-icon image"

        openFile()

        waitsFor ->
          archiveEditor.element.querySelectorAll('.entry').length > 0

        runs ->
          checkMultiClass()

      it "allows an array of classes to be passed", ->
        IconServices.set 'file-icons',
          iconClassForPath: (path) ->
            switch path.match(/\w*$/)[0]
              when "pdf" then ["text", "pdf-icon", "document"]
              when "ttf" then ["binary", "ttf-icon", "font"]
              when "gif" then ["binary", "gif-icon", "image"]

        openFile()

        waitsFor ->
          archiveEditor.element.querySelectorAll('.entry').length > 0

        runs ->
          checkMultiClass()

      it "identifies context to icon-service providers", ->
        IconServices.set 'file-icons',
          iconClassForPath: (path, context) -> "icon-" + context

        openFile()

        waitsFor ->
          archiveEditor.element.querySelectorAll('.entry').length > 0

        runs ->
          expect(findEntryContainingText('adobe.pdf').querySelectorAll('.file.icon-archive-view').length).not.toBe(0)
