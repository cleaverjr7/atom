ProviderManager = require('../lib/provider-manager')
TestProvider = require('./lib/test-provider')
_ = require 'underscore-plus'

describe "Provider Manager", ->
  [providerManager, testProvider, legacyTestProvider, registration] = []

  beforeEach ->
    runs ->
      providerManager = new ProviderManager()
      testProvider =
        requestHandler: (options) ->
          [new Suggestion(this,
            word: "ohai",
            prefix: "ohai",
            label: "<span style=\"color: red\">ohai</span>",
            renderLabelAsHtml: true,
            className: 'ohai'
          )]
        selector: '.source.js'
        dispose: ->
          # No-op

      legacyTestProvider = new TestProvider()

  afterEach ->
    runs ->
      registration?.dispose() if registration?.dispose?
      registration = null
      legacyTestProvider?.dispose() if legacyTestProvider?.dispose?
      legacyTestProvider = null
      testProvider?.dispose() if testProvider?.dispose?
      testProvider = null
      providerManager?.dispose()
      providerManager = null

  describe "when no providers have been registered", ->

    it "is constructed correctly", ->
      expect(providerManager.providers).toBeDefined()
      expect(providerManager.subscriptions).toBeDefined()
      expect(providerManager.store).toBeDefined()
      expect(providerManager.fuzzyProvider).toBeDefined()

    it "disposes correctly", ->
      providerManager.dispose()
      expect(providerManager.providers).toBeNull()
      expect(providerManager.subscriptions).toBeNull()
      expect(providerManager.store).toBeNull()
      expect(providerManager.fuzzyProvider).toBeNull()

    it "registers FuzzyProvider for all scopes", ->
      expect(_.size(providerManager.providersForScopeChain('*'))).toBe(1)
      expect(providerManager.providersForScopeChain('*')[0]).toBe(providerManager.fuzzyProvider)

    it "adds providers", ->
      expect(providerManager.providers.has(testProvider)).toEqual(false)
      expect(_.contains(providerManager.subscriptions?.disposables, testProvider)).toEqual(false)

      providerManager.addProvider(testProvider)
      expect(providerManager.providers.has(testProvider)).toEqual(true)
      uuid = providerManager.providers.get(testProvider)
      expect(uuid).toBeDefined()
      expect(uuid).not.toEqual('')
      expect(_.contains(providerManager.subscriptions?.disposables, testProvider)).toEqual(true)

      providerManager.addProvider(testProvider)
      expect(providerManager.providers.has(testProvider)).toEqual(true)
      uuid2 = providerManager.providers.get(testProvider)
      expect(uuid2).toBeDefined()
      expect(uuid2).not.toEqual('')
      expect(uuid).toEqual(uuid2)
      expect(_.contains(providerManager.subscriptions?.disposables, testProvider)).toEqual(true)
      providerManager.removeProvider(testProvider)

    it "removes providers", ->
      expect(providerManager.providers.has(testProvider)).toEqual(false)
      expect(_.contains(providerManager.subscriptions?.disposables, testProvider)).toEqual(false)

      providerManager.addProvider(testProvider)
      expect(providerManager.providers.has(testProvider)).toEqual(true)
      expect(providerManager.providers.get(testProvider)).toBeDefined()
      expect(providerManager.providers.get(testProvider)).not.toEqual('')
      expect(_.contains(providerManager.subscriptions?.disposables, testProvider)).toEqual(true)

      providerManager.removeProvider(testProvider)
      expect(providerManager.providers.has(testProvider)).toEqual(false)
      expect(_.contains(providerManager.subscriptions?.disposables, testProvider)).toEqual(false)

    it "can identify a legacy provider", ->
      expect(providerManager.isLegacyProvider(testProvider)).toEqual(false)
      expect(providerManager.isLegacyProvider(legacyTestProvider)).toEqual(true)

    it "can identify a provider with a missing requestHandler", ->
      bogusProvider =
        badRequestHandler: (options) ->
          return []
        selector: '.source.js'
        dispose: ->
          # No-op
      expect(providerManager.isValidProvider({})).toEqual(false)
      expect(providerManager.isValidProvider(bogusProvider)).toEqual(false)
      expect(providerManager.isValidProvider(testProvider)).toEqual(true)

    it "can identify a provider with an invalid requestHandler", ->
      bogusProvider =
        requestHandler: 'yo, this is a bad handler'
        selector: '.source.js'
        dispose: ->
          # No-op
      expect(providerManager.isValidProvider({})).toEqual(false)
      expect(providerManager.isValidProvider(bogusProvider)).toEqual(false)
      expect(providerManager.isValidProvider(testProvider)).toEqual(true)

    it "can identify a provider with a missing selector", ->
      bogusProvider =
        requestHandler: (options) ->
          return []
        aSelector: '.source.js'
        dispose: ->
          # No-op
      expect(providerManager.isValidProvider(bogusProvider)).toEqual(false)
      expect(providerManager.isValidProvider(testProvider)).toEqual(true)

    it "can identify a provider with an invalid selector", ->
      bogusProvider =
        requestHandler: (options) ->
          return []
        selector: ''
        dispose: ->
          # No-op
      expect(providerManager.isValidProvider(bogusProvider)).toEqual(false)
      expect(providerManager.isValidProvider(testProvider)).toEqual(true)

      bogusProvider =
        requestHandler: (options) ->
          return []
        selector: false
        dispose: ->
      expect(providerManager.isValidProvider(bogusProvider)).toEqual(false)

    it "registers a valid provider", ->
      expect(_.size(providerManager.providersForScopeChain('.source.js'))).toEqual(1)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(false)
      expect(providerManager.providers.has(testProvider)).toEqual(false)

      registration = providerManager.registerProvider(testProvider)
      expect(_.size(providerManager.providersForScopeChain('.source.js'))).toEqual(2)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(true)
      expect(providerManager.providers.has(testProvider)).toEqual(true)

    it "removes a registration", ->
      expect(_.size(providerManager.providersForScopeChain('.source.js'))).toEqual(1)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(false)
      expect(providerManager.providers.has(testProvider)).toEqual(false)

      registration = providerManager.registerProvider(testProvider)
      expect(_.size(providerManager.providersForScopeChain('.source.js'))).toEqual(2)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(true)
      expect(providerManager.providers.has(testProvider)).toEqual(true)
      registration.dispose()

      expect(_.size(providerManager.providersForScopeChain('.source.js'))).toEqual(1)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(false)
      expect(providerManager.providers.has(testProvider)).toEqual(false)

    it "does not create duplicate registrations for the same scope", ->
      expect(_.size(providerManager.providersForScopeChain('.source.js'))).toEqual(1)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(false)
      expect(providerManager.providers.has(testProvider)).toEqual(false)

      registration = providerManager.registerProvider(testProvider)
      expect(_.size(providerManager.providersForScopeChain('.source.js'))).toEqual(2)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(true)
      expect(providerManager.providers.has(testProvider)).toEqual(true)

      registration = providerManager.registerProvider(testProvider)
      expect(_.size(providerManager.providersForScopeChain('.source.js'))).toEqual(2)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(true)
      expect(providerManager.providers.has(testProvider)).toEqual(true)

      registration = providerManager.registerProvider(testProvider)
      expect(_.size(providerManager.providersForScopeChain('.source.js'))).toEqual(2)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), testProvider)).toEqual(true)
      expect(providerManager.providers.has(testProvider)).toEqual(true)

    it "does not register an invalid provider", ->
      bogusProvider =
        requestHandler: 'yo, this is a bad handler'
        selector: '.source.js'
        dispose: ->
      expect(_.size(providerManager.providersForScopeChain('.source.js'))).toEqual(1)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), bogusProvider)).toEqual(false)
      expect(providerManager.providers.has(bogusProvider)).toEqual(false)

      registration = providerManager.registerProvider(bogusProvider)
      expect(_.size(providerManager.providersForScopeChain('.source.js'))).toEqual(1)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), bogusProvider)).toEqual(false)
      expect(providerManager.providers.has(bogusProvider)).toEqual(false)

    it "shims a legacy provider during registration", ->
      expect(_.size(providerManager.providersForScopeChain('.source.js'))).toEqual(1)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), providerManager.fuzzyProvider)).toEqual(true)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), legacyTestProvider)).toEqual(false)
      expect(providerManager.providers.has(legacyTestProvider)).toEqual(false)

      expect(providerManager.isLegacyProvider(legacyTestProvider)).toEqual(true)
      registration = providerManager.registerLegacyProvider(legacyTestProvider, '.source.js')
      expect(_.size(providerManager.providersForScopeChain('.source.js'))).toEqual(2)
      expect(providerManager.legacyProviderRegistrations.has(legacyTestProvider.constructor)).toEqual(true)
      legacyProviderRegistration = providerManager.legacyProviderRegistrations.get(legacyTestProvider.constructor)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), legacyTestProvider)).toEqual(false)
      expect(_.contains(providerManager.providersForScopeChain('.source.js'), legacyProviderRegistration.shim)).toEqual(true)

    # it "registers a provider with a blacklist", ->
    #   testProvider =
    #     requestHandler: (options) ->
    #       [new Suggestion(this,
    #         word: "ohai",
    #         prefix: "ohai",
    #         label: "<span style=\"color: red\">ohai</span>",
    #         renderLabelAsHtml: true,
    #         className: 'ohai'
    #       )]
    #     selector: '.source.js'
    #     blacklist: '.source.js '
    #     dispose: ->
    #       # No-op
    #
    #   expect(true).toEqual(false)
