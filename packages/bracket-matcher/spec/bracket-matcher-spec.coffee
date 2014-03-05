{WorkspaceView} = require 'atom'

path = require 'path'

describe "bracket matching", ->
  [editorView, editor, buffer] = []

  beforeEach ->
    atom.workspaceView = new WorkspaceView
    atom.workspaceView.attachToDom()

    atom.workspaceView.openSync('sample.js')

    waitsForPromise ->
      atom.packages.activatePackage('bracket-matcher')

    runs ->
      editorView = atom.workspaceView.getActiveView()
      {editor} = editorView
      {buffer} = editor

  describe "matching bracket highlighting", ->
    describe "when the cursor is before a starting pair", ->
      it "highlights the starting pair and ending pair", ->
        editor.moveCursorToEndOfLine()
        editor.moveCursorLeft()
        expect(editorView.underlayer.find('.bracket-matcher:visible').length).toBe 2
        expect(editorView.underlayer.find('.bracket-matcher:first').position()).toEqual editorView.pixelPositionForBufferPosition([0,28])
        expect(editorView.underlayer.find('.bracket-matcher:last').position()).toEqual editorView.pixelPositionForBufferPosition([12,0])

        expect(editorView.underlayer.find('.bracket-matcher:first').width()).toBeGreaterThan 0
        expect(editorView.underlayer.find('.bracket-matcher:last').width()).toBeGreaterThan 0
        expect(editorView.underlayer.find('.bracket-matcher:first').height()).toBeGreaterThan 0
        expect(editorView.underlayer.find('.bracket-matcher:last').height()).toBeGreaterThan 0

    describe "when the cursor is after a starting pair", ->
      it "highlights the starting pair and ending pair", ->
        editor.moveCursorToEndOfLine()
        expect(editorView.underlayer.find('.bracket-matcher:visible').length).toBe 2
        expect(editorView.underlayer.find('.bracket-matcher:first').position()).toEqual editorView.pixelPositionForBufferPosition([0,28])
        expect(editorView.underlayer.find('.bracket-matcher:last').position()).toEqual editorView.pixelPositionForBufferPosition([12,0])

    describe "when the cursor is before an ending pair", ->
      it "highlights the starting pair and ending pair", ->
        editor.moveCursorToBottom()
        editor.moveCursorLeft()
        editor.moveCursorLeft()
        expect(editorView.underlayer.find('.bracket-matcher:visible').length).toBe 2
        expect(editorView.underlayer.find('.bracket-matcher:last').position()).toEqual editorView.pixelPositionForBufferPosition([12,0])
        expect(editorView.underlayer.find('.bracket-matcher:first').position()).toEqual editorView.pixelPositionForBufferPosition([0,28])

    describe "when the cursor is after an ending pair", ->
      it "highlights the starting pair and ending pair", ->
        editor.moveCursorToBottom()
        editor.moveCursorLeft()
        expect(editorView.underlayer.find('.bracket-matcher:visible').length).toBe 2
        expect(editorView.underlayer.find('.bracket-matcher:last').position()).toEqual editorView.pixelPositionForBufferPosition([12,0])
        expect(editorView.underlayer.find('.bracket-matcher:first').position()).toEqual editorView.pixelPositionForBufferPosition([0,28])

    describe "when the cursor is moved off a pair", ->
      it "removes the starting pair and ending pair highlights", ->
        editor.moveCursorToEndOfLine()
        expect(editorView.underlayer.find('.bracket-matcher:visible').length).toBe 2
        editor.moveCursorToBeginningOfLine()
        expect(editorView.underlayer.find('.bracket-matcher:visible').length).toBe 0

    describe "when the font size changes", ->
      it "repositions the highlights", ->
        editor.moveCursorToBottom()
        editor.moveCursorLeft()
        atom.config.set('editor.fontSize', editorView.getFontSize() + 10)
        expect(editorView.underlayer.find('.bracket-matcher:visible').length).toBe 2
        expect(editorView.underlayer.find('.bracket-matcher:last').position()).toEqual editorView.pixelPositionForBufferPosition([12,0])
        expect(editorView.underlayer.find('.bracket-matcher:first').position()).toEqual editorView.pixelPositionForBufferPosition([0,28])

    describe "pair balancing", ->
      describe "when a second starting pair preceeds the first ending pair", ->
        it "advances to the second ending pair", ->
          editor.setCursorBufferPosition([8,42])
          expect(editorView.underlayer.find('.bracket-matcher:visible').length).toBe 2
          expect(editorView.underlayer.find('.bracket-matcher:first').position()).toEqual editorView.pixelPositionForBufferPosition([8,42])
          expect(editorView.underlayer.find('.bracket-matcher:last').position()).toEqual editorView.pixelPositionForBufferPosition([8,54])

  describe "when bracket-matcher:go-to-matching-bracket is triggered", ->
    describe "when the cursor is before the starting pair", ->
      it "moves the cursor to after the ending pair", ->
        editor.moveCursorToEndOfLine()
        editor.moveCursorLeft()
        editorView.trigger "bracket-matcher:go-to-matching-bracket"
        expect(editor.getCursorBufferPosition()).toEqual [12, 1]

    describe "when the cursor is after the starting pair", ->
      it "moves the cursor to before the ending pair", ->
        editor.moveCursorToEndOfLine()
        editorView.trigger "bracket-matcher:go-to-matching-bracket"
        expect(editor.getCursorBufferPosition()).toEqual [12, 0]

    describe "when the cursor is before the ending pair", ->
      it "moves the cursor to after the starting pair", ->
        editor.setCursorBufferPosition([12, 0])
        editorView.trigger "bracket-matcher:go-to-matching-bracket"
        expect(editor.getCursorBufferPosition()).toEqual [0, 29]

    describe "when the cursor is after the ending pair", ->
      it "moves the cursor to before the starting pair", ->
        editor.setCursorBufferPosition([12, 1])
        editorView.trigger "bracket-matcher:go-to-matching-bracket"
        expect(editor.getCursorBufferPosition()).toEqual [0, 28]

    describe "when the cursor is not adjacent to a pair", ->
      describe "when within a `{}` pair", ->
        it "moves the cursor to before the enclosing brace", ->
          editor.setCursorBufferPosition([11, 2])
          editorView.trigger "bracket-matcher:go-to-matching-bracket"
          expect(editor.getCursorBufferPosition()).toEqual [0, 28]

      describe "when within a `()` pair", ->
        it "moves the cursor to before the enclosing brace", ->
          editor.setCursorBufferPosition([2, 14])
          editorView.trigger "bracket-matcher:go-to-matching-bracket"
          expect(editor.getCursorBufferPosition()).toEqual [2, 7]

  describe "when bracket-matcher:go-to-enclosing-bracket is triggered", ->
    describe "when within a `{}` pair", ->
      it "moves the cursor to before the enclosing brace", ->
        editor.setCursorBufferPosition([11, 2])
        editorView.trigger "bracket-matcher:go-to-enclosing-bracket"
        expect(editor.getCursorBufferPosition()).toEqual [0, 28]

    describe "when within a `()` pair", ->
      it "moves the cursor to before the enclosing brace", ->
        editor.setCursorBufferPosition([2, 14])
        editorView.trigger "bracket-matcher:go-to-enclosing-bracket"
        expect(editor.getCursorBufferPosition()).toEqual [2, 7]

  describe "matching bracket insertion", ->
    beforeEach ->
      editor.buffer.setText("")

    describe "when more than one character is inserted", ->
      it "does not insert a matching bracket", ->
        editor.insertText("woah(")
        expect(editor.buffer.getText()).toBe "woah("

    describe "when there is a word character after the cursor", ->
      it "does not insert a matching bracket", ->
        editor.buffer.setText("ab")
        editor.setCursorBufferPosition([0, 1])
        editor.insertText("(")

        expect(editor.buffer.getText()).toBe "a(b"

    describe "when there are multiple cursors", ->
      it "inserts ) at each cursor", ->
        editor.buffer.setText("()\nab\n[]\n12")
        editor.setCursorBufferPosition([3, 1])
        editor.addCursorAtBufferPosition([2, 1])
        editor.addCursorAtBufferPosition([1, 1])
        editor.addCursorAtBufferPosition([0, 1])
        editor.insertText ')'

        expect(editor.buffer.getText()).toBe "())\na)b\n[)]\n1)2"

    describe "when there is a non-word character after the cursor", ->
      it "inserts a closing bracket after an opening bracket is inserted", ->
        editor.buffer.setText("}")
        editor.setCursorBufferPosition([0, 0])
        editor.insertText '{'
        expect(buffer.lineForRow(0)).toBe "{}}"
        expect(editor.getCursorBufferPosition()).toEqual([0,1])

    describe "when the cursor is at the end of the line", ->
      it "inserts a closing bracket after an opening bracket is inserted", ->
        editor.buffer.setText("")
        editor.insertText '{'
        expect(buffer.lineForRow(0)).toBe "{}"
        expect(editor.getCursorBufferPosition()).toEqual([0,1])

        editor.buffer.setText("")
        editor.insertText '('
        expect(buffer.lineForRow(0)).toBe "()"
        expect(editor.getCursorBufferPosition()).toEqual([0,1])

        editor.buffer.setText("")
        editor.insertText '['
        expect(buffer.lineForRow(0)).toBe "[]"
        expect(editor.getCursorBufferPosition()).toEqual([0,1])

        editor.buffer.setText("")
        editor.insertText '"'
        expect(buffer.lineForRow(0)).toBe '""'
        expect(editor.getCursorBufferPosition()).toEqual([0,1])

        editor.buffer.setText("")
        editor.insertText "'"
        expect(buffer.lineForRow(0)).toBe "''"
        expect(editor.getCursorBufferPosition()).toEqual([0,1])

    describe "when the cursor is on a closing bracket and a closing bracket is inserted", ->
      describe "when the closing bracket was there previously", ->
        it "inserts a closing bracket", ->
          editor.insertText '()x'
          editor.setCursorBufferPosition([0, 1])
          editor.insertText ')'
          expect(buffer.lineForRow(0)).toBe "())x"
          expect(editor.getCursorBufferPosition().column).toBe 2

      describe "when the closing bracket was automatically inserted from inserting an opening bracket", ->
        it "only moves cursor over the closing bracket one time", ->
          editor.insertText '('
          expect(buffer.lineForRow(0)).toBe "()"
          editor.setCursorBufferPosition([0, 1])
          editor.insertText ')'
          expect(buffer.lineForRow(0)).toBe "()"
          expect(editor.getCursorBufferPosition()).toEqual [0, 2]

          editor.setCursorBufferPosition([0, 1])
          editor.insertText ')'
          expect(buffer.lineForRow(0)).toBe "())"
          expect(editor.getCursorBufferPosition()).toEqual [0, 2]

        it "moves cursor over the closing bracket after other text is inserted", ->
          editor.insertText '('
          editor.insertText 'ok cool'
          expect(buffer.lineForRow(0)).toBe "(ok cool)"
          editor.setCursorBufferPosition([0, 8])
          editor.insertText ')'
          expect(buffer.lineForRow(0)).toBe "(ok cool)"
          expect(editor.getCursorBufferPosition()).toEqual [0, 9]

        it "works with nested brackets", ->
          editor.insertText '('
          editor.insertText '1'
          editor.insertText '('
          editor.insertText '2'
          expect(buffer.lineForRow(0)).toBe "(1(2))"
          editor.setCursorBufferPosition([0, 4])
          editor.insertText ')'
          expect(buffer.lineForRow(0)).toBe "(1(2))"
          expect(editor.getCursorBufferPosition()).toEqual [0, 5]
          editor.insertText ')'
          expect(buffer.lineForRow(0)).toBe "(1(2))"
          expect(editor.getCursorBufferPosition()).toEqual [0, 6]

        it "works with mixed brackets", ->
          editor.insertText '('
          editor.insertText '}'
          expect(buffer.lineForRow(0)).toBe "(})"
          editor.insertText ')'
          expect(buffer.lineForRow(0)).toBe "(})"
          expect(editor.getCursorBufferPosition()).toEqual [0, 3]

        it "closes brackets with the same begin/end character correctly", ->
          editor.insertText '"'
          editor.insertText 'ok'
          expect(buffer.lineForRow(0)).toBe '"ok"'
          expect(editor.getCursorBufferPosition()).toEqual [0, 3]
          editor.insertText '"'
          expect(buffer.lineForRow(0)).toBe '"ok"'
          expect(editor.getCursorBufferPosition()).toEqual [0, 4]

    describe "when there is text selected on a single line", ->
      it "wraps the selection with brackets", ->
        editor.insertText 'text'
        editor.moveCursorToBottom()
        editor.selectToTop()
        editor.selectAll()
        editor.insertText '('
        expect('(text)').toBe buffer.getText()
        expect(editor.getSelectedBufferRange()).toEqual [[0, 1], [0, 5]]
        expect(editor.getSelection().isReversed()).toBeTruthy()

    describe "when there is text selected on multiple lines", ->
      it "wraps the selection with brackets", ->
        editor.insertText 'text\nabcd'
        editor.moveCursorToBottom()
        editor.selectToTop()
        editor.selectAll()
        editor.insertText '('
        expect('(text\nabcd)').toBe buffer.getText()
        expect(editor.getSelectedBufferRange()).toEqual [[0, 1], [1, 4]]
        expect(editor.getSelection().isReversed()).toBeTruthy()

    describe "when inserting a quote", ->
      describe "when a word character is before the cursor", ->
        it "does not automatically insert the closing quote", ->
          editor.buffer.setText("abc")
          editor.setCursorBufferPosition([0, 3])
          editor.insertText '"'
          expect(buffer.lineForRow(0)).toBe "abc\""

          editor.buffer.setText("abc")
          editor.setCursorBufferPosition([0, 3])
          editor.insertText '\''
          expect(buffer.lineForRow(0)).toBe "abc\'"

      describe "when a quote is before the cursor", ->
        it "does not automatically insert the closing quote", ->
          editor.buffer.setText("''")
          editor.setCursorBufferPosition([0, 3])
          editor.insertText "'"
          expect(buffer.lineForRow(0)).toBe "'''"

          editor.buffer.setText('""')
          editor.setCursorBufferPosition([0, 3])
          editor.insertText '"'
          expect(buffer.lineForRow(0)).toBe '"""'

          editor.buffer.setText("''")
          editor.setCursorBufferPosition([0, 3])
          editor.insertText '"'
          expect(buffer.lineForRow(0)).toBe "''\"\""

      describe "when a non word character is before the cursor", ->
        it "automatically inserts the closing quote", ->
          editor.buffer.setText("ab@")
          editor.setCursorBufferPosition([0, 3])
          editor.insertText '"'
          expect(buffer.lineForRow(0)).toBe "ab@\"\""
          expect(editor.getCursorBufferPosition()).toEqual [0, 4]

      describe "when the cursor is on an empty line", ->
        it "automatically inserts the closing quote", ->
          editor.buffer.setText("")
          editor.setCursorBufferPosition([0, 0])
          editor.insertText '"'
          expect(buffer.lineForRow(0)).toBe "\"\""
          expect(editor.getCursorBufferPosition()).toEqual [0, 1]

  describe "matching bracket deletion", ->
    it "deletes the end bracket when it directly proceeds a begin bracket that is being backspaced", ->
      buffer.setText("")
      editor.setCursorBufferPosition([0, 0])
      editor.insertText '{'
      expect(buffer.lineForRow(0)).toBe "{}"
      editor.backspace()
      expect(buffer.lineForRow(0)).toBe ""
