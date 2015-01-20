TestProvider = require('./lib/test-provider')
_ = require 'underscore-plus'

describe "Provider API", ->
  [completionDelay, editor, mainModule, autocompleteManager, consumer] = []

  beforeEach ->
    runs ->
      consumer = null
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
      autocompleteManager = mainModule.autocompleteManager

  afterEach ->
    consumer?.dispose()

  describe "When the Editor has a grammar", ->
    [testProvider, registration, autocomplete] = []

    beforeEach ->
      runs ->
          testProvider = null
          registration = null
          autocomplete = null

      waitsForPromise -> atom.packages.activatePackage('language-javascript')

    afterEach ->
      runs ->
        consumer?.dispose()
        registration?.dispose()

    describe "Legacy Provider API", ->
      it "registers the given provider for the given editor", ->
        runs ->
          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.providersForScopeChain('.source.js'))).toEqual(1)

          testProvider = new TestProvider()
          expect(autocompleteManager.providerManager.isLegacyProvider(testProvider)).toEqual(true)
          mainModule.registerProviderForEditor(testProvider, editor)

          expect(_.size(autocompleteManager.providerManager.providersForScopeChain('.source.js'))).toEqual(2)
          expect(autocompleteManager.providerManager.providers.has(testProvider)).toEqual(true)
          shimProvider = autocompleteManager.providerManager.providers.get(testProvider)
          expect(autocompleteManager.providerManager.providers.has(shimProvider)).toEqual(true)
          expect(_.contains(autocompleteManager.providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(false)
          expect(_.contains(autocompleteManager.providerManager.providersForScopeChain('.source.js'), shimProvider)).toEqual(true)

      it "registers the given provider once when called multiple times for the given editor", ->
        runs ->
          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.providersForScopeChain('.source.js'))).toEqual(1)

          testProvider = new TestProvider()
          expect(autocompleteManager.providerManager.isLegacyProvider(testProvider)).toEqual(true)
          mainModule.registerProviderForEditor(testProvider, editor)

          expect(_.size(autocompleteManager.providerManager.providersForScopeChain('.source.js'))).toEqual(2)
          expect(autocompleteManager.providerManager.providers.has(testProvider)).toEqual(true)
          shimProvider = autocompleteManager.providerManager.providers.get(testProvider)
          expect(autocompleteManager.providerManager.providers.has(shimProvider)).toEqual(true)
          expect(_.contains(autocompleteManager.providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(false)
          expect(_.contains(autocompleteManager.providerManager.providersForScopeChain('.source.js'), shimProvider)).toEqual(true)

          mainModule.registerProviderForEditor(testProvider, editor)

          expect(_.size(autocompleteManager.providerManager.providersForScopeChain('.source.js'))).toEqual(2)
          expect(autocompleteManager.providerManager.providers.has(testProvider)).toEqual(true)
          shimProvider = autocompleteManager.providerManager.providers.get(testProvider)
          expect(autocompleteManager.providerManager.providers.has(shimProvider)).toEqual(true)
          expect(_.contains(autocompleteManager.providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(false)
          expect(_.contains(autocompleteManager.providerManager.providersForScopeChain('.source.js'), shimProvider)).toEqual(true)

          mainModule.registerProviderForEditor(testProvider, editor)

          expect(_.size(autocompleteManager.providerManager.providersForScopeChain('.source.js'))).toEqual(2)
          expect(autocompleteManager.providerManager.providers.has(testProvider)).toEqual(true)
          shimProvider = autocompleteManager.providerManager.providers.get(testProvider)
          expect(autocompleteManager.providerManager.providers.has(shimProvider)).toEqual(true)
          expect(_.contains(autocompleteManager.providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(false)
          expect(_.contains(autocompleteManager.providerManager.providersForScopeChain('.source.js'), shimProvider)).toEqual(true)

      it "unregisters the provider from all editors", ->
        runs ->
          expect(autocompleteManager.providerManager.store).toBeDefined()
          testProvider = new TestProvider()
          testProvider = new TestProvider()
          expect(autocompleteManager.providerManager.isLegacyProvider(testProvider)).toEqual(true)
          mainModule.registerProviderForEditor(testProvider, editor)

          expect(_.size(autocompleteManager.providerManager.providersForScopeChain('.source.js'))).toEqual(2)
          expect(autocompleteManager.providerManager.providers.has(testProvider)).toEqual(true)
          shimProvider = autocompleteManager.providerManager.providers.get(testProvider)
          expect(autocompleteManager.providerManager.providers.has(shimProvider)).toEqual(true)
          expect(_.contains(autocompleteManager.providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(false)
          expect(_.contains(autocompleteManager.providerManager.providersForScopeChain('.source.js'), shimProvider)).toEqual(true)

          mainModule.unregisterProvider(testProvider)
          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.providersForScopeChain('.source.js'))).toEqual(1)
          expect(autocompleteManager.providerManager.providers.has(testProvider)).toEqual(false)
          expect(autocompleteManager.providerManager.providers.has(shimProvider)).toEqual(false)

      it "buildSuggestions is called for a registered provider", ->
        runs ->
          testProvider = new TestProvider()
          mainModule.registerProviderForEditor(testProvider, editor)

          spyOn(testProvider, "buildSuggestions").andCallThrough()

          # Trigger an autocompletion
          editor.moveToBottom()
          editor.moveToBeginningOfLine()
          editor.insertText('f')
          advanceClock completionDelay

          expect(testProvider.buildSuggestions).toHaveBeenCalled()

    describe "Provider API v0.1.0", ->
      [testProvider, autocomplete, registration] = []

      it "should allow registration of a provider", ->
        runs ->
          # Register the test provider
          consumer = atom.services.consume "autocomplete.provider-api", "0.1.0", (a) ->
            autocomplete = a
            testProvider =
              requestHandler: (options) ->
                [{
                  provider: testProvider,
                  word: "ohai",
                  prefix: "ohai",
                  label: "<span style=\"color: red\">ohai</span>",
                  renderLabelAsHtml: true,
                  className: 'ohai'
                }]
              selector: '.source.js,.source.coffee'
              dispose: ->
            registration = a.registerProvider(testProvider)

          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.store.propertySets)).toEqual(3)
          expect(autocompleteManager.providerManager.store.propertySets[0].properties.provider).toEqual(testProvider)
          expect(autocompleteManager.providerManager.store.propertySets[0].selector.selector[0].classList[0]).toEqual('coffee')
          expect(autocompleteManager.providerManager.store.propertySets[0].selector.selector[0].classList[1]).toEqual('source')
          expect(autocompleteManager.providerManager.store.propertySets[1].properties.provider).toEqual(testProvider)
          expect(autocompleteManager.providerManager.store.propertySets[1].selector.selector[0].classList[0]).toEqual('js')
          expect(autocompleteManager.providerManager.store.propertySets[1].selector.selector[0].classList[1]).toEqual('source')
          expect(autocompleteManager.providerManager.store.propertySets[2].properties.provider).toEqual(autocompleteManager.providerManager.fuzzyProvider)

          editor.moveToBottom()
          editor.insertText('o')

          advanceClock(completionDelay)

          suggestionListView = atom.views.getView(autocompleteManager.suggestionList)

          expect(suggestionListView.querySelector('li .label')).toHaveHtml('<span style="color: red">ohai</span>')
          expect(suggestionListView.querySelector('li')).toHaveClass('ohai')

      xit "registers the given provider once when called multiple times", ->
        runs ->
          # Register the test provider
          consumer = atom.services.consume "autocomplete.provider-api", "0.1.0", (a) ->
            autocomplete = a
            testProvider =
              requestHandler: (options) ->
                [{
                  provider: testProvider,
                  word: "ohai",
                  prefix: "ohai",
                  label: "<span style=\"color: red\">ohai</span>",
                  renderLabelAsHtml: true,
                  className: 'ohai'
                }]
              selector: '.source.js,.source.coffee'
              dispose: ->
            registration = a.registerProvider(testProvider)

          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.providersForScopeChain('.source.js'))).toEqual(1)
          
          editor.moveToBottom()
          editor.insertText('o')

          advanceClock(completionDelay)

          suggestionListView = atom.views.getView(autocompleteManager.suggestionList)

          expect(suggestionListView.querySelector('li .label')).toHaveHtml('<span style="color: red">ohai</span>')
          expect(suggestionListView.querySelector('li')).toHaveClass('ohai')

      it "should allow disposal of the registration multiple times without error", ->
        runs ->
          testProvider =
            requestHandler: (options) ->
              [{
                provider: testProvider,
                word: "ohai",
                prefix: "ohai",
                label: "<span style=\"color: red\">ohai</span>",
                renderLabelAsHtml: true,
                className: 'ohai'
              }]
            selector: '.source.js,.source.coffee'
            dispose: ->
          expect(_.contains(autocompleteManager.providerManager.subscriptions.disposables, testProvider)).toBe(false)

          # Register the test provider
          consumer = atom.services.consume "autocomplete.provider-api", "0.1.0", (a) ->
            autocomplete = a
            registration = a.registerProvider(testProvider)

          expect(_.contains(autocompleteManager.providerManager.subscriptions.disposables, testProvider)).toBe(true)
          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.store.propertySets)).toEqual(3)
          expect(autocompleteManager.providerManager.store.propertySets[0].properties.provider).toEqual(testProvider)
          expect(autocompleteManager.providerManager.store.propertySets[0].selector.selector[0].classList[0]).toEqual('coffee')
          expect(autocompleteManager.providerManager.store.propertySets[0].selector.selector[0].classList[1]).toEqual('source')
          expect(autocompleteManager.providerManager.store.propertySets[1].properties.provider).toEqual(testProvider)
          expect(autocompleteManager.providerManager.store.propertySets[1].selector.selector[0].classList[0]).toEqual('js')
          expect(autocompleteManager.providerManager.store.propertySets[1].selector.selector[0].classList[1]).toEqual('source')
          expect(autocompleteManager.providerManager.store.propertySets[2].properties.provider).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          registration.dispose()
          expect(_.contains(autocompleteManager.providerManager.subscriptions.disposables, testProvider)).toBe(false)
          expect(_.size(autocompleteManager.providerManager.store.propertySets)).toEqual(1)
          expect(autocompleteManager.providerManager.store.propertySets[0].properties.provider).toEqual(autocompleteManager.providerManager.fuzzyProvider)
          registration.dispose()
          expect(_.contains(autocompleteManager.providerManager.subscriptions.disposables, testProvider)).toBe(false)
          expect(_.size(autocompleteManager.providerManager.store.propertySets)).toEqual(1)
          expect(autocompleteManager.providerManager.store.propertySets[0].properties.provider).toEqual(autocompleteManager.providerManager.fuzzyProvider)

      it "should dispose a provider registration correctly", ->
        runs ->
          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.store.propertySets)).toEqual(1)
          expect(autocompleteManager.providerManager.store.propertySets[0].properties.provider).toEqual(autocompleteManager.providerManager.fuzzyProvider)

          testProvider =
            requestHandler: (options) ->
              [{
                provider: testProvider,
                word: "ohai",
                prefix: "ohai",
                label: "<span style=\"color: red\">ohai</span>",
                renderLabelAsHtml: true,
                className: 'ohai'
              }]
            selector: '.source.js'
            dispose: ->

          # Register the test provider
          consumer = atom.services.consume "autocomplete.provider-api", "0.1.0", (a) ->
            autocomplete = a
            registration = a.registerProvider(testProvider)

          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.store.propertySets)).toEqual(2)
          expect(autocompleteManager.providerManager.store.propertySets[0].properties.provider).toEqual(testProvider)
          expect(autocompleteManager.providerManager.store.propertySets[0].selector.selector[0].classList[0]).toEqual('js')
          expect(autocompleteManager.providerManager.store.propertySets[0].selector.selector[0].classList[1]).toEqual('source')
          expect(autocompleteManager.providerManager.store.propertySets[1].properties.provider).toEqual(autocompleteManager.providerManager.fuzzyProvider)

          registration.dispose()
          expect(autocompleteManager.providerManager.store).toBeDefined()
          expect(_.size(autocompleteManager.providerManager.store.propertySets)).toEqual(1)
          expect(autocompleteManager.providerManager.store.propertySets[0].properties.provider).toEqual(autocompleteManager.providerManager.fuzzyProvider)
