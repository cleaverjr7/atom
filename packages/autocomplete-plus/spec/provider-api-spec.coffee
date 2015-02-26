{waitForAutocomplete, triggerAutocompletion} = require './spec-helper'
_ = require 'underscore-plus'

describe 'Provider API', ->
  [completionDelay, editor, mainModule, autocompleteManager, registration, testProvider] = []

  beforeEach ->
    runs ->
      # Set to live completion
      atom.config.set('autocomplete-plus.enableAutoActivation', true)
      atom.config.set('editor.fontSize', '16')

      # Set the completion delay
      completionDelay = 100
      atom.config.set('autocomplete-plus.autoActivationDelay', completionDelay)
      completionDelay += 100 # Rendering

      workspaceElement = atom.views.getView(atom.workspace)
      jasmine.attachToDOM(workspaceElement)

    waitsForPromise -> atom.workspace.open('sample.js').then (e) ->
      editor = e

    # Activate the package
    waitsForPromise -> atom.packages.activatePackage('autocomplete-plus').then (a) ->
      mainModule = a.mainModule

    waitsFor ->
      mainModule.autocompleteManager?.ready

    runs ->
      autocompleteManager = mainModule.autocompleteManager

  afterEach ->
    registration?.dispose() if registration?.dispose?
    registration = null
    testProvider?.dispose() if testProvider?.dispose?
    testProvider = null

  describe 'When the Editor has a grammar', ->

    beforeEach ->
      waitsForPromise ->
        atom.packages.activatePackage('language-javascript')

    describe 'Provider API v1.1.0', ->
      [registration] = []

      beforeEach -> registration = null
      afterEach -> registration?.dispose()

      it 'registers the provider specified by {providers: [provider]}', ->
        runs ->
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(1)

          testProvider =
            selector: '.source.js,.source.coffee'
            requestHandler: (options) -> [word: 'ohai', prefix: 'ohai']

          registration = atom.packages.serviceHub.provide('autocomplete.provider', '1.1.0', {providers: [testProvider]})

          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(2)

    describe 'Provider API v2.0.0', ->
      [registration] = []

      beforeEach -> registration = null
      afterEach -> registration?.dispose()

      it 'registers the provider specified by [provider]', ->
        testProvider =
          selector: '.source.js,.source.coffee'
          getSuggestions: (options) -> [text: 'ohai', replacementPrefix: 'ohai']

        expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(1)
        registration = atom.packages.serviceHub.provide('autocomplete.provider', '2.0.0', [testProvider])
        expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(2)

      it 'registers the provider specified by the naked provider', ->
        testProvider =
          selector: '.source.js,.source.coffee'
          getSuggestions: (options) -> [text: 'ohai', replacementPrefix: 'ohai']

        expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(1)
        registration = atom.packages.serviceHub.provide('autocomplete.provider', '2.0.0', testProvider)
        expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(2)

      it 'passes the correct parameters to getSuggestions for the version', ->
        testProvider =
          selector: '.source.js,.source.coffee'
          getSuggestions: (options) -> [text: 'ohai', replacementPrefix: 'ohai']

        registration = atom.packages.serviceHub.provide('autocomplete.provider', '2.0.0', testProvider)

        spyOn(testProvider, 'getSuggestions')
        triggerAutocompletion(editor, true, 'o')

        runs ->
          args = testProvider.getSuggestions.mostRecentCall.args[0]
          expect(args.editor).toBeDefined()
          expect(args.position).toBeDefined()
          expect(args.scopeDescriptor).toBeDefined()
          expect(args.prefix).toBeDefined()

          expect(args.scope).not.toBeDefined()
          expect(args.scopeChain).not.toBeDefined()
          expect(args.buffer).not.toBeDefined()
          expect(args.cursor).not.toBeDefined()

      it 'correctly displays the suggestion options', ->
        testProvider =
          selector: '.source.js, .source.coffee'
          getSuggestions: (options) ->
            [
              text: 'ohai',
              replacementPrefix: 'o',
              rightLabelHTML: '<span style="color: red">ohai</span>',
            ]
        registration = atom.packages.serviceHub.provide('autocomplete.provider', '2.0.0', testProvider)

        triggerAutocompletion(editor, true, 'o')

        runs ->
          suggestionListView = atom.views.getView(autocompleteManager.suggestionList)
          expect(suggestionListView.querySelector('li .completion-label')).toHaveHtml('<span style="color: red">ohai</span>')
          expect(suggestionListView.querySelector('span.word')).toHaveText('ohai')

    describe 'Provider API v1.0.0', ->
      [registration1, registration2, registration3] = []

      afterEach ->
        registration1?.dispose()
        registration2?.dispose()
        registration3?.dispose()

      it 'passes the correct parameters to requestHandler', ->
        runs ->
          testProvider =
            selector: '.source.js,.source.coffee'
            requestHandler: (options) -> [ word: 'ohai', prefix: 'ohai' ]
          registration = atom.packages.serviceHub.provide('autocomplete.provider', '1.0.0', {provider: testProvider})

          spyOn(testProvider, 'requestHandler')
          triggerAutocompletion(editor, true, 'o')

          runs ->
            args = testProvider.requestHandler.mostRecentCall.args[0]
            expect(args.editor).toBeDefined()
            expect(args.buffer).toBeDefined()
            expect(args.cursor).toBeDefined()
            expect(args.position).toBeDefined()
            expect(args.scope).toBeDefined()
            expect(args.scopeChain).toBeDefined()
            expect(args.prefix).toBeDefined()

      it 'should allow registration of a provider', ->
        runs ->
          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(1)
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee'))).toEqual(1)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)

          testProvider =
            requestHandler: (options) ->
              [
                word: 'ohai',
                prefix: 'ohai',
                label: '<span style="color: red">ohai</span>',
                renderLabelAsHtml: true,
                className: 'ohai'
              ]
            selector: '.source.js,.source.coffee'
          # Register the test provider
          registration = atom.packages.serviceHub.provide('autocomplete.provider', '1.0.0', {provider: testProvider})

          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(2)
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee'))).toEqual(2)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js')[0]).toEqual(testProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js')[1]).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee')[0]).toEqual(testProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee')[1]).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.go')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)

          triggerAutocompletion(editor, true, 'o')

          runs ->
            suggestionListView = atom.views.getView(autocompleteManager.suggestionList)

            expect(suggestionListView.querySelector('li .completion-label')).toHaveHtml('<span style="color: red">ohai</span>')
            expect(suggestionListView.querySelector('li')).toHaveClass('ohai')

      it 'should dispose a provider registration correctly', ->
        runs ->
          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(1)
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee'))).toEqual(1)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)

          testProvider =
            requestHandler: (options) ->
              [{
                word: 'ohai',
                prefix: 'ohai'
              }]
            selector: '.source.js,.source.coffee'
          # Register the test provider
          registration = atom.packages.serviceHub.provide('autocomplete.provider', '1.0.0', {provider: testProvider})

          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(2)
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee'))).toEqual(2)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js')[0]).toEqual(testProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js')[1]).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee')[0]).toEqual(testProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee')[1]).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.go')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)

          registration.dispose()

          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(1)
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee'))).toEqual(1)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)

          registration.dispose()

          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(1)
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee'))).toEqual(1)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)

      it 'should remove a providers registration if the provider is disposed', ->
        runs ->
          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(1)
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee'))).toEqual(1)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)

          testProvider =
            requestHandler: (options) ->
              [{
                word: 'ohai',
                prefix: 'ohai'
              }]
            selector: '.source.js,.source.coffee'
            dispose: ->
              return
          # Register the test provider
          registration = atom.packages.serviceHub.provide('autocomplete.provider', '1.0.0', {provider: testProvider})

          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(2)
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee'))).toEqual(2)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js')[0]).toEqual(testProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js')[1]).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee')[0]).toEqual(testProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee')[1]).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.go')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)

          testProvider.dispose()

          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js'))).toEqual(1)
          expect(_.size(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee'))).toEqual(1)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.js')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          expect(autocompleteManager.providerManager.providersForScopeDescriptor('.source.coffee')[0]).toEqual(autocompleteManager.providerManager.fuzzyProvider)
