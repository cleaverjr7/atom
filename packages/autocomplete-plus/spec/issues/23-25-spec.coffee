require "../spec-helper"
Autocomplete = require '../../lib/autocomplete'

describe "Autocomplete", ->
  [activationPromise, autocomplete, editorView, editor, completionDelay] = []

  describe "Issue 23 and 25", ->
    beforeEach ->
      runs ->
        # Set to live completion
        atom.config.set "autocomplete-plus.enableAutoActivation", true

        # Set the completion delay
        completionDelay = 100
        atom.config.set "autocomplete-plus.autoActivationDelay", completionDelay
        completionDelay += 100 # Rendering delay

        workspaceElement = atom.views.getView(atom.workspace)
        jasmine.attachToDOM(workspaceElement)

      waitsForPromise -> atom.workspace.open("issues/23-25.js").then (e) ->
        editor = e

      # Activate the package
      waitsForPromise -> atom.packages.activatePackage("autocomplete-plus")

      runs ->
        editorView = atom.views.getView(editor)
        autocomplete = new Autocomplete editor

    it "does not show suggestions after a word has been completed", ->
      runs ->
        expect(editorView.querySelector(".autocomplete-plus")).not.toExist()

        # Trigger an autocompletion
        editor.moveToBottom()
        editor.insertText c for c in "red"

        advanceClock completionDelay

        expect(editorView.querySelector(".autocomplete-plus")).toExist()

        # Accept suggestion
        autocompleteView = atom.views.getView(autocomplete)
        atom.commands.dispatch autocompleteView, "autocomplete-plus:confirm"

        expect(editorView.querySelector(".autocomplete-plus")).not.toExist()
