TestProvider = require('./lib/test-provider')

describe "HTML labels", ->
  [completionDelay, editorView, editor, autocompleteManager, mainModule, consumer] = []

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

    waitsForPromise -> atom.packages.activatePackage('language-javascript')

    # Activate the package
    waitsForPromise -> atom.packages.activatePackage('autocomplete-plus').then (a) ->
      mainModule = a.mainModule
      autocompleteManager = mainModule.autocompleteManager

  afterEach ->
    consumer?.dispose()

  it "should allow HTML in labels for suggestions in the suggestion list", ->
    runs ->
      consumer = atom.services.consume "autocomplete.provider-api", "0.1.0", (a) ->
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
        a.registerProvider(testProvider)

      editor.moveToBottom()
      editor.insertText('o')

      advanceClock(completionDelay)

      suggestionListView = atom.views.getView(autocompleteManager.suggestionList)
      expect(suggestionListView.querySelector('li .label')).toHaveHtml('<span style="color: red">ohai</span>')
      expect(suggestionListView.querySelector('li')).toHaveClass('ohai')
