path = require 'path'
{$} = require 'atom-space-pen-views'
fs = require 'fs-plus'
temp = require 'temp'
SymbolsView = require '../lib/symbols-view'
TagGenerator = require '../lib/tag-generator'

describe "SymbolsView", ->
  [symbolsView, activationPromise, editor, directory] = []

  getWorkspaceView = -> atom.views.getView(atom.workspace)
  getEditorView = -> atom.views.getView(atom.workspace.getActiveTextEditor())

  beforeEach ->
    atom.project.setPaths([temp.mkdirSync('atom-symbols-view-')])
    directory = atom.project.getDirectories()[0]
    fs.copySync(path.join(__dirname, 'fixtures'), atom.project.getPaths()[0])

    activationPromise = atom.packages.activatePackage("symbols-view")
    jasmine.attachToDOM(getWorkspaceView())

    waitsForPromise ->
      atom.packages.activatePackage('language-ruby')

  describe "when tags can be generated for a file", ->
    it "initially displays all JavaScript functions with line numbers", ->
      waitsForPromise ->
        atom.workspace.open('sample.js')

      runs ->
        atom.commands.dispatch(getEditorView(), "symbols-view:toggle-file-symbols")

      waitsForPromise ->
        activationPromise

      runs ->
        symbolsView = $(getWorkspaceView()).find('.symbols-view').view()
        expect(symbolsView.loading).toBeVisible()

      waitsFor ->
        symbolsView.list.children('li').length > 0

      runs ->
        expect(symbolsView.loading).toBeEmpty()
        expect($(getWorkspaceView()).find('.symbols-view')).toExist()
        expect(symbolsView.list.children('li').length).toBe 2
        expect(symbolsView.list.children('li:first').find('.primary-line')).toHaveText 'quicksort'
        expect(symbolsView.list.children('li:first').find('.secondary-line')).toHaveText 'Line 1'
        expect(symbolsView.list.children('li:last').find('.primary-line')).toHaveText 'quicksort.sort'
        expect(symbolsView.list.children('li:last').find('.secondary-line')).toHaveText 'Line 2'
        expect(symbolsView.error).not.toBeVisible()

    it "caches tags until the editor changes", ->
      waitsForPromise ->
        atom.workspace.open('sample.js')

      runs ->
        editor = atom.workspace.getActiveTextEditor()
        atom.commands.dispatch(getEditorView(), "symbols-view:toggle-file-symbols")

      waitsForPromise ->
        activationPromise

      runs ->
        symbolsView = $(getWorkspaceView()).find('.symbols-view').view()

      waitsFor ->
        symbolsView.list.children('li').length > 0

      runs ->
        symbolsView.cancel()
        spyOn(symbolsView, 'generateTags').andCallThrough()
        atom.commands.dispatch(getEditorView(), "symbols-view:toggle-file-symbols")

      waitsFor ->
        symbolsView.list.children('li').length > 0

      runs ->
        expect(symbolsView.loading).toBeEmpty()
        expect(symbolsView.list.children('li').length).toBe 2
        expect(symbolsView.generateTags).not.toHaveBeenCalled()
        editor.save()
        symbolsView.cancel()
        atom.commands.dispatch(getEditorView(), "symbols-view:toggle-file-symbols")

      waitsFor ->
        symbolsView.list.children('li').length > 0

      runs ->
        expect(symbolsView.loading).toBeEmpty()
        expect(symbolsView.list.children('li').length).toBe 2
        expect(symbolsView.generateTags).toHaveBeenCalled()
        editor.destroy()
        expect(symbolsView.cachedTags).toEqual {}

    it "displays an error when no tags match text in mini-editor", ->
      waitsForPromise ->
        atom.workspace.open('sample.js')

      runs ->
        atom.commands.dispatch(getEditorView(), "symbols-view:toggle-file-symbols")

      waitsForPromise ->
        activationPromise

      runs ->
        symbolsView = $(getWorkspaceView()).find('.symbols-view').view()

      waitsFor ->
        symbolsView.list.children('li').length > 0

      runs ->
        symbolsView.filterEditorView.setText("nothing will match this")
        window.advanceClock(symbolsView.inputThrottle)

        expect($(getWorkspaceView()).find('.symbols-view')).toExist()
        expect(symbolsView.list.children('li').length).toBe 0
        expect(symbolsView.error).toBeVisible()
        expect(symbolsView.error.text().length).toBeGreaterThan 0

        # Should remove error
        symbolsView.filterEditorView.setText("")
        window.advanceClock(symbolsView.inputThrottle)

        expect(symbolsView.list.children('li').length).toBe 2
        expect(symbolsView.error).not.toBeVisible()

  describe "when tags can't be generated for a file", ->
    it "shows an error message when no matching tags are found", ->
      waitsForPromise ->
        atom.workspace.open('sample.txt')

      runs ->
        atom.commands.dispatch(getEditorView(), "symbols-view:toggle-file-symbols")

      waitsForPromise ->
        activationPromise

      runs ->
        symbolsView = $(getWorkspaceView()).find('.symbols-view').view()

      waitsFor ->
        symbolsView.error.isVisible()

      runs ->
        expect(symbolsView).toExist()
        expect(symbolsView.list.children('li').length).toBe 0
        expect(symbolsView.error).toBeVisible()
        expect(symbolsView.error.text().length).toBeGreaterThan 0
        expect(symbolsView.loadingArea).not.toBeVisible()

  it "moves the cursor to the selected function", ->
    waitsForPromise ->
      atom.workspace.open('sample.js')

    runs ->
      expect(atom.workspace.getActiveTextEditor().getCursorBufferPosition()).toEqual [0,0]
      expect($(getWorkspaceView()).find('.symbols-view')).not.toExist()
      atom.commands.dispatch(getEditorView(), "symbols-view:toggle-file-symbols")

    waitsFor ->
      $(getWorkspaceView()).find('.symbols-view').find('li').length

    runs ->
      $(getWorkspaceView()).find('.symbols-view').find('li:eq(1)').mousedown().mouseup()
      expect(atom.workspace.getActiveTextEditor().getCursorBufferPosition()).toEqual [1,2]

  describe "TagGenerator", ->
    it "generates tags for all JavaScript functions", ->
      tags = []

      waitsForPromise ->
        sampleJsPath = directory.resolve('sample.js')
        new TagGenerator(sampleJsPath).generate().then (o) -> tags = o

      runs ->
        expect(tags.length).toBe 2
        expect(tags[0].name).toBe "quicksort"
        expect(tags[0].position.row).toBe 0
        expect(tags[1].name).toBe "quicksort.sort"
        expect(tags[1].position.row).toBe 1

    it "generates no tags for text file", ->
      tags = []

      waitsForPromise ->
        sampleJsPath = directory.resolve('sample.txt')
        new TagGenerator(sampleJsPath).generate().then (o) -> tags = o

      runs ->
        expect(tags.length).toBe 0

  describe "go to declaration", ->
    it "doesn't move the cursor when no declaration is found", ->
      waitsForPromise ->
        atom.workspace.open("tagged.js")

      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([0,2])
        atom.commands.dispatch(getEditorView(), 'symbols-view:go-to-declaration')

      waitsForPromise ->
        activationPromise

      runs ->
        expect(editor.getCursorBufferPosition()).toEqual [0,2]

    it "moves the cursor to the declaration there is a single matching declaration", ->
      waitsForPromise ->
        atom.workspace.open("tagged.js")

      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([6,24])
        spyOn(SymbolsView.prototype, "moveToPosition").andCallThrough()
        atom.commands.dispatch(getEditorView(), 'symbols-view:go-to-declaration')

      waitsFor ->
        SymbolsView::moveToPosition.callCount is 1

      runs ->
        expect(editor.getCursorBufferPosition()).toEqual [2,0]

    it "displays matches when more than one exists and opens the selected match", ->
      waitsForPromise ->
        atom.workspace.open("tagged.js")

      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([8,14])
        atom.commands.dispatch(getEditorView(), 'symbols-view:go-to-declaration')

      waitsFor ->
        $(getWorkspaceView()).find('.symbols-view').find('li').length > 0

      runs ->
        symbolsView = $(getWorkspaceView()).find('.symbols-view').view()
        expect(symbolsView.list.children('li').length).toBe 2
        expect(symbolsView).toBeVisible()
        spyOn(SymbolsView.prototype, "moveToPosition").andCallThrough()
        symbolsView.confirmed(symbolsView.items[0])

      waitsFor ->
        SymbolsView::moveToPosition.callCount is 1

      runs ->
        expect(atom.workspace.getActiveTextEditor().getPath()).toBe directory.resolve("tagged-duplicate.js")
        expect(atom.workspace.getActiveTextEditor().getCursorBufferPosition()).toEqual [0,4]

    it "includes ? and ! characters in ruby symbols", ->
      atom.project.setPaths([path.join(atom.project.getPaths()[0], 'ruby')])

      waitsForPromise ->
        atom.workspace.open 'file1.rb'

      runs ->
        spyOn(SymbolsView.prototype, "moveToPosition").andCallThrough()
        atom.workspace.getActiveTextEditor().setCursorBufferPosition([13,4])
        atom.commands.dispatch(getEditorView(), 'symbols-view:go-to-declaration')

      waitsForPromise ->
        activationPromise

      waitsFor ->
        SymbolsView::moveToPosition.callCount is 1

      runs ->
        expect(atom.workspace.getActiveTextEditor().getCursorBufferPosition()).toEqual [5,2]
        SymbolsView::moveToPosition.reset()
        atom.workspace.getActiveTextEditor().setCursorBufferPosition([14,2])
        atom.commands.dispatch(getEditorView(), 'symbols-view:go-to-declaration')

      waitsFor ->
        SymbolsView::moveToPosition.callCount is 1

      runs ->
        expect(atom.workspace.getActiveTextEditor().getCursorBufferPosition()).toEqual [9,2]
        SymbolsView::moveToPosition.reset()
        atom.workspace.getActiveTextEditor().setCursorBufferPosition([15,5])
        atom.commands.dispatch(getEditorView(), 'symbols-view:go-to-declaration')

      waitsFor ->
        SymbolsView::moveToPosition.callCount is 1

      runs ->
        expect(atom.workspace.getActiveTextEditor().getCursorBufferPosition()).toEqual [1,2]

    describe "return from declaration", ->
      it "doesn't do anything when no go-to have been triggered", ->
        waitsForPromise ->
          atom.workspace.open("tagged.js")

        runs ->
          editor = atom.workspace.getActiveTextEditor()
          editor.setCursorBufferPosition([6,0])
          atom.commands.dispatch(getEditorView(), 'symbols-view:return-from-declaration')

        waitsForPromise ->
          activationPromise

        runs ->
          expect(editor.getCursorBufferPosition()).toEqual [6,0]

      it "returns to previous row and column", ->
        waitsForPromise ->
          atom.workspace.open("tagged.js")

        runs ->
          editor = atom.workspace.getActiveTextEditor()
          editor.setCursorBufferPosition([6,24])
          spyOn(SymbolsView.prototype, "moveToPosition").andCallThrough()
          atom.commands.dispatch(getEditorView(), 'symbols-view:go-to-declaration')

        waitsForPromise ->
          activationPromise

        waitsFor ->
          SymbolsView::moveToPosition.callCount is 1

        runs ->
          expect(editor.getCursorBufferPosition()).toEqual [2,0]
          atom.commands.dispatch(getEditorView(), 'symbols-view:return-from-declaration')

        waitsFor ->
          SymbolsView::moveToPosition.callCount is 2

        runs ->
          expect(editor.getCursorBufferPosition()).toEqual [6,24]

    describe "when the tag is in a file that doesn't exist", ->
      it "doesn't display the tag", ->
        fs.removeSync(directory.resolve("tagged-duplicate.js"))

        waitsForPromise ->
          atom.workspace.open("tagged.js")

        runs ->
          editor = atom.workspace.getActiveTextEditor()
          editor.setCursorBufferPosition([8,14])
          spyOn(SymbolsView.prototype, "moveToPosition").andCallThrough()
          atom.commands.dispatch(getEditorView(), 'symbols-view:go-to-declaration')

        waitsFor ->
          SymbolsView::moveToPosition.callCount is 1

        runs ->
          expect(editor.getCursorBufferPosition()).toEqual [8,0]

  describe "project symbols", ->
    it "displays all tags", ->
      jasmine.unspy(window, 'setTimeout')

      waitsForPromise ->
        atom.workspace.open("tagged.js")

      runs ->
        expect($(getWorkspaceView()).find('.symbols-view')).not.toExist()
        atom.commands.dispatch(getWorkspaceView(), "symbols-view:toggle-project-symbols")

      waitsForPromise ->
        activationPromise

      runs ->
        symbolsView = $(getWorkspaceView()).find('.symbols-view').view()
        expect(symbolsView.loading).toBeVisible()

      waitsFor ->
        symbolsView.list.children('li').length > 0

      runs ->
        expect(symbolsView.loading).toBeEmpty()
        expect($(getWorkspaceView()).find('.symbols-view')).toExist()
        expect(symbolsView.list.children('li').length).toBe 4
        expect(symbolsView.list.children('li:first').find('.primary-line')).toHaveText 'callMeMaybe'
        expect(symbolsView.list.children('li:first').find('.secondary-line')).toHaveText 'tagged.js'
        expect(symbolsView.list.children('li:last').find('.primary-line')).toHaveText 'thisIsCrazy'
        expect(symbolsView.list.children('li:last').find('.secondary-line')).toHaveText 'tagged.js'
        expect(symbolsView.error).not.toBeVisible()
        atom.commands.dispatch(getWorkspaceView(), "symbols-view:toggle-project-symbols")

        fs.removeSync(directory.resolve('tags'))

      waitsFor ->
        symbolsView.reloadTags

      runs ->
        atom.commands.dispatch(getWorkspaceView(), "symbols-view:toggle-project-symbols")

      waitsFor ->
        symbolsView.error.text().length > 0

      runs ->
        expect(symbolsView.list.children('li').length).toBe 0

    describe "when selecting a tag", ->
      describe "when the file doesn't exist", ->
        beforeEach ->
          fs.removeSync(directory.resolve("tagged.js"))

        it "doesn't open the editor", ->
          atom.commands.dispatch(getWorkspaceView(), "symbols-view:toggle-project-symbols")

          waitsForPromise ->
            activationPromise

          runs ->
            symbolsView = $(getWorkspaceView()).find('.symbols-view').view()

          waitsFor ->
            symbolsView.list.children('li').length > 0

          runs ->
            spyOn(atom.workspace, 'open').andCallThrough()
            symbolsView.list.children('li:first').mousedown().mouseup()
            expect(atom.workspace.open).not.toHaveBeenCalled()
            expect(symbolsView.error.text().length).toBeGreaterThan 0

  describe "when useEditorGrammarAsCtagsLanguage is set to true", ->
    it "uses the language associated with the editor's grammar", ->
      atom.config.set('symbols-view.useEditorGrammarAsCtagsLanguage', true)

      waitsForPromise ->
        atom.packages.activatePackage('language-javascript')

      waitsForPromise ->
        atom.workspace.open('sample.javascript')

      runs ->
        atom.workspace.getActiveTextEditor().setText("var test = function() {}")
        atom.workspace.getActiveTextEditor().save()
        atom.commands.dispatch(getEditorView(), "symbols-view:toggle-file-symbols")

      waitsForPromise ->
        activationPromise

      waitsFor ->
        $(getWorkspaceView()).find('.symbols-view').view().error.isVisible()

      runs ->
        atom.commands.dispatch(getEditorView(), "symbols-view:toggle-file-symbols")
        atom.workspace.getActiveTextEditor().setGrammar(atom.grammars.grammarForScopeName('source.js'))
        atom.commands.dispatch(getEditorView(), "symbols-view:toggle-file-symbols")
        symbolsView = $(getWorkspaceView()).find('.symbols-view').view()
        expect(symbolsView.loading).toBeVisible()

      waitsFor ->
        symbolsView.list.children('li').length is 1

      runs ->
        expect(symbolsView.loading).toBeEmpty()
        expect($(getWorkspaceView()).find('.symbols-view')).toExist()
        expect(symbolsView.list.children('li:first').find('.primary-line')).toHaveText 'test'
        expect(symbolsView.list.children('li:first').find('.secondary-line')).toHaveText 'Line 1'
