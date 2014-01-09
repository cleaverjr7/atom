path = require 'path'
{WorkspaceView} = require 'atom'
SelectNext = require '../lib/select-next'

describe "SelectNext", ->
  [editorView] = []

  beforeEach ->
    atom.workspaceView = new WorkspaceView()
    atom.project.setPath(path.join(__dirname, 'fixtures'))
    atom.workspaceView.openSync('sample.js')
    atom.workspaceView.attachToDom()
    editorView = atom.workspaceView.getActiveView()
    atom.packages.activatePackage("find-and-replace", immediate: true)

  describe "find-and-replace:select-next", ->
    describe "when nothing is selected", ->
      it "selects the word under the cursor", ->
        editorView.setCursorBufferPosition([1, 3])
        editorView.trigger 'find-and-replace:select-next'
        expect(editorView.getSelectedBufferRanges()).toEqual [[[1, 2], [1, 5]]]

    describe "when a word is selected", ->
      it "selects the next occurrence of the selected word skipping any non-word matches", ->
        editorView.setText """
          for
          information
          format
          another for
          fork
          a 3rd for is here
        """

        editorView.setSelectedBufferRange([[0, 0], [0, 3]])

        editorView.trigger 'find-and-replace:select-next'
        expect(editorView.getSelectedBufferRanges()).toEqual [
          [[0, 0], [0, 3]]
          [[3, 8], [3, 11]]
        ]

        editorView.trigger 'find-and-replace:select-next'
        expect(editorView.getSelectedBufferRanges()).toEqual [
          [[0, 0], [0, 3]]
          [[3, 8], [3, 11]]
          [[5, 6], [5, 9]]
        ]

        editorView.trigger 'find-and-replace:select-next'
        expect(editorView.getSelectedBufferRanges()).toEqual [
          [[0, 0], [0, 3]]
          [[3, 8], [3, 11]]
          [[5, 6], [5, 9]]
        ]

    describe "when part of a word is selected", ->
      it "selects the next occurrence of the selected text", ->
        editorView.setText """
          for
          information
          format
          another for
          fork
          a 3rd for is here
        """

        editorView.setSelectedBufferRange([[1, 2], [1, 5]])

        editorView.trigger 'find-and-replace:select-next'
        expect(editorView.getSelectedBufferRanges()).toEqual [
          [[1, 2], [1, 5]]
          [[2, 0], [2, 3]]
        ]

        editorView.trigger 'find-and-replace:select-next'
        expect(editorView.getSelectedBufferRanges()).toEqual [
          [[1, 2], [1, 5]]
          [[2, 0], [2, 3]]
          [[3, 8], [3, 11]]
        ]

        editorView.trigger 'find-and-replace:select-next'
        expect(editorView.getSelectedBufferRanges()).toEqual [
          [[1, 2], [1, 5]]
          [[2, 0], [2, 3]]
          [[3, 8], [3, 11]]
          [[4, 0], [4, 3]]
        ]

        editorView.trigger 'find-and-replace:select-next'
        expect(editorView.getSelectedBufferRanges()).toEqual [
          [[1, 2], [1, 5]]
          [[2, 0], [2, 3]]
          [[3, 8], [3, 11]]
          [[4, 0], [4, 3]]
          [[5, 6], [5, 9]]
        ]

        editorView.trigger 'find-and-replace:select-next'
        expect(editorView.getSelectedBufferRanges()).toEqual [
          [[1, 2], [1, 5]]
          [[2, 0], [2, 3]]
          [[3, 8], [3, 11]]
          [[4, 0], [4, 3]]
          [[5, 6], [5, 9]]
        ]
