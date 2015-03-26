{Point} = require 'atom'
{triggerAutocompletion, buildIMECompositionEvent, buildTextInputEvent} = require './spec-helper'
_ = require 'underscore-plus'

suggestionForWord = (suggestionList, word) ->
  suggestionList.getToken(word)

describe 'SymbolProvider', ->
  [completionDelay, editorView, editor, mainModule, autocompleteManager] = []

  beforeEach ->
    runs ->
      # Set to live completion
      atom.config.set('autocomplete-plus.enableAutoActivation', true)
      atom.config.set('autocomplete-plus.defaultProvider', 'Symbol')

      # Set the completion delay
      completionDelay = 100
      atom.config.set('autocomplete-plus.autoActivationDelay', completionDelay)
      completionDelay += 100 # Rendering delaya\

      workspaceElement = atom.views.getView(atom.workspace)
      jasmine.attachToDOM(workspaceElement)

  afterEach ->
    atom.config.set('autocomplete-plus.defaultProvider', 'Fuzzy')

  describe "when completing with the default configuration", ->
    beforeEach ->
      runs -> atom.config.set "autocomplete-plus.enableAutoActivation", true

      waitsForPromise -> atom.workspace.open("sample.coffee").then (e) ->
        editor = e

      # Activate the package
      waitsForPromise ->
        atom.packages.activatePackage("language-coffee-script").then ->
          atom.packages.activatePackage("autocomplete-plus").then (a) ->
            mainModule = a.mainModule

      runs ->
        autocompleteManager = mainModule.autocompleteManager
        advanceClock 1
        editorView = atom.views.getView(editor)

    it "properly swaps a lower priority type for a higher priority type", ->
      provider = autocompleteManager.providerManager.fuzzyProvider
      suggestion = suggestionForWord(provider.symbolList, 'SomeModule')
      expect(suggestion.type).toEqual 'class'

    it "does not output suggestions from the other buffer", ->
      provider = autocompleteManager.providerManager.fuzzyProvider
      results = null
      waitsForPromise ->
        promise = provider.getSuggestions({editor, prefix: 'item', bufferPosition: new Point(7, 0)})
        advanceClock 1
        promise.then (r) -> results = r

      runs ->
        expect(results).toHaveLength 0

  describe "when auto-activation is enabled", ->
    beforeEach ->
      runs ->
        atom.config.set('autocomplete-plus.enableAutoActivation', true)

      waitsForPromise -> atom.workspace.open('sample.js').then (e) ->
        editor = e

      # Activate the package
      waitsForPromise ->
        atom.packages.activatePackage("language-javascript").then ->
          atom.packages.activatePackage("autocomplete-plus").then (a) ->
            mainModule = a.mainModule

      runs ->
        autocompleteManager = mainModule.autocompleteManager
        advanceClock 1
        editorView = atom.views.getView(editor)

    it "runs a completion ", ->
      provider = autocompleteManager.providerManager.fuzzyProvider
      expect(suggestionForWord(provider.symbolList, 'quicksort')).toBeTruthy()

    it "adds words to the symbol list after they have been written", ->
      provider = autocompleteManager.providerManager.fuzzyProvider

      expect(suggestionForWord(provider.symbolList, 'aNewFunction')).toBeFalsy()
      editor.insertText('function aNewFunction(){};')
      editor.insertText(' ')
      advanceClock provider.changeUpdateDelay
      expect(suggestionForWord(provider.symbolList, 'aNewFunction')).toBeTruthy()

    it "removes words from the symbol list when they do not exist in the buffer", ->
      editor.moveToBottom()
      editor.moveToBeginningOfLine()
      provider = autocompleteManager.providerManager.fuzzyProvider

      expect(suggestionForWord(provider.symbolList, 'aNewFunction')).toBeFalsy()
      editor.insertText('function aNewFunction(){};')
      expect(suggestionForWord(provider.symbolList, 'aNewFunction')).toBeTruthy()

      editor.setCursorBufferPosition([13, 21])
      editor.backspace()

      expect(suggestionForWord(provider.symbolList, 'aNewFunctio')).toBeTruthy()
      expect(suggestionForWord(provider.symbolList, 'aNewFunction')).toBeFalsy()

    describe "when includeCompletionsFromAllBuffers is enabled", ->
      beforeEach ->
        atom.config.set('autocomplete-plus.includeCompletionsFromAllBuffers', true)

        waitsForPromise ->
          atom.packages.activatePackage("language-coffee-script").then ->
            atom.workspace.open("sample.coffee").then (e) ->
              editor = e

      afterEach ->
        atom.config.set('autocomplete-plus.includeCompletionsFromAllBuffers', false)

      it "outputs unique suggestions", ->
        provider = autocompleteManager.providerManager.fuzzyProvider
        results = null
        waitsForPromise ->
          promise = provider.getSuggestions({editor, prefix: 'qu', bufferPosition: new Point(7, 0)})
          advanceClock 1
          promise.then (r) -> results = r

        runs ->
          expect(results).toHaveLength 1

      it "outputs suggestions from the other buffer", ->
        provider = autocompleteManager.providerManager.fuzzyProvider
        results = null
        waitsForPromise ->
          promise = provider.getSuggestions({editor, prefix: 'item', bufferPosition: new Point(7, 0)})
          advanceClock 1
          promise.then (r) -> results = r

        runs ->
          expect(results[0].text).toBe 'items'

    # Fixing This Fixes #76
    xit 'adds words to the wordlist with unicode characters', ->
      provider = autocompleteManager.providerManager.fuzzyProvider

      expect(provider.symbolList.indexOf('somēthingNew')).toBeFalsy()
      editor.insertText('somēthingNew')
      editor.insertText(' ')
      expect(provider.symbolList.indexOf('somēthingNew')).toBeTruthy()
