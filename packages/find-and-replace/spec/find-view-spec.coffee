{_, $, RootView} = require 'atom'

shell = require 'shell'
path = require 'path'

describe 'FindView', ->
  [editor, findView] = []

  beforeEach ->
    spyOn(shell, 'beep')
    window.rootView = new RootView()
    project.setPath(path.join(__dirname, 'fixtures'))
    rootView.openSync('sample.js')
    rootView.attachToDom()
    editor = rootView.getActiveView()
    pack = atom.activatePackage("find-and-replace", immediate: true)
    findView = pack.mainModule.findView

  describe "when find-and-replace:show is triggered", ->
    it "attaches FindView to the root view", ->
      editor.trigger 'find-and-replace:show'
      expect(rootView.find('.find-and-replace')).toExist()

  describe "when core:cancel is triggered", ->
    beforeEach ->
      editor.trigger 'find-and-replace:show'
      findView.findEditor.setText 'items'
      findView.findEditor.trigger 'core:confirm'
      findView.focus()

    it "detaches from the root view", ->
      $(document.activeElement).trigger 'core:cancel'
      expect(rootView.find('.find-and-replace')).not.toExist()

    it "removes highlighted matches", ->
      findResultsView = editor.find('.search-results')

      $(document.activeElement).trigger 'core:cancel'
      expect(findResultsView.parent()).not.toExist()

  describe "serialization", ->
    it "serializes find and replace history", ->
      findView.findEditor.setText("items")
      findView.replaceEditor.setText("cat")
      findView.replaceAll()

      findView.findEditor.setText("sort")
      findView.replaceEditor.setText("dog")
      findView.replaceAll()

      atom.deactivatePackage("find-and-replace")
      pack = atom.activatePackage("find-and-replace", immediate: true)
      findView = pack.mainModule.findView

      findView.findEditor.trigger('core:move-up')
      expect(findView.findEditor.getText()).toBe 'sort'

      findView.replaceEditor.trigger('core:move-up')
      expect(findView.replaceEditor.getText()).toBe 'dog'

    it "serializes find options ", ->
      expect(findView.caseOptionButton).not.toHaveClass 'selected'
      expect(findView.regexOptionButton).not.toHaveClass 'selected'
      expect(findView.selectionOptionButton).not.toHaveClass 'selected'

      findView.caseOptionButton.click()
      findView.regexOptionButton.click()
      findView.selectionOptionButton.click()

      expect(findView.caseOptionButton).toHaveClass 'selected'
      expect(findView.regexOptionButton).toHaveClass 'selected'
      expect(findView.selectionOptionButton).toHaveClass 'selected'

      atom.deactivatePackage("find-and-replace")
      pack = atom.activatePackage("find-and-replace", immediate: true)
      findView = pack.mainModule.findView

      expect(findView.caseOptionButton).toHaveClass 'selected'
      expect(findView.regexOptionButton).toHaveClass 'selected'
      expect(findView.selectionOptionButton).toHaveClass 'selected'

  describe "finding", ->
    beforeEach ->
      editor.setCursorBufferPosition([2,0])
      editor.trigger 'find-and-replace:show'
      findView.findEditor.setText 'items'
      findView.findEditor.trigger 'core:confirm'

    it "doesn't change the selection, beeps if there are no matches and keeps focus on the find view", ->
      editor.setCursorBufferPosition([2,0])
      findView.findEditor.setText 'notinthefilebro'
      findView.findEditor.focus()

      findView.findEditor.trigger 'core:confirm'
      expect(editor.getCursorBufferPosition()).toEqual [2,0]
      expect(shell.beep).toHaveBeenCalled()
      expect(findView.find(':focus')).toExist()

    it "selects the first match following the cursor", ->
      expect(findView.resultCounter.text()).toEqual('2 of 6')
      expect(editor.getSelectedBufferRange()).toEqual [[2, 8], [2, 13]]

      findView.findEditor.trigger 'core:confirm'
      expect(findView.resultCounter.text()).toEqual('3 of 6')
      expect(editor.getSelectedBufferRange()).toEqual [[2, 34], [2, 39]]
      expect(editor.find(':focus')).toExist()

    it "selects the next match when the next match button is pressed", ->
      findView.nextButton.click()
      expect(findView.resultCounter.text()).toEqual('3 of 6')
      expect(editor.getSelectedBufferRange()).toEqual [[2, 34], [2, 39]]

    it "selects the next match when the 'find-and-replace:find-next' event is triggered", ->
      editor.trigger('find-and-replace:find-next')
      expect(findView.resultCounter.text()).toEqual('3 of 6')
      expect(editor.getSelectedBufferRange()).toEqual [[2, 34], [2, 39]]

    it "will re-run search if 'find-and-replace:find-next' is triggered after changing the findEditor's text", ->
      findView.findEditor.setText 'sort'
      findView.findEditor.trigger 'find-and-replace:find-next'

      expect(findView.resultCounter.text()).toEqual('3 of 5')
      expect(editor.getSelectedBufferRange()).toEqual [[8, 11], [8, 15]]

    it "selects the previous match when the previous match button is pressed", ->
      findView.previousButton.click()
      expect(findView.resultCounter.text()).toEqual('1 of 6')
      expect(editor.getSelectedBufferRange()).toEqual [[1, 27], [1, 22]]

    it "selects the previous match when the 'find-and-replace:find-previous' event is triggered", ->
      editor.trigger('find-and-replace:find-previous')
      expect(findView.resultCounter.text()).toEqual('1 of 6')
      expect(editor.getSelectedBufferRange()).toEqual [[1, 27], [1, 22]]

    it "will re-run search if 'find-and-replace:find-previous' is triggered after changing the findEditor's text", ->
      findView.findEditor.setText 'sort'
      findView.findEditor.trigger 'find-and-replace:find-previous'

      expect(findView.resultCounter.text()).toEqual('2 of 5')
      expect(editor.getSelectedBufferRange()).toEqual [[1, 6], [1, 10]]

    it "replaces results counter with number of results found when user moves the cursor", ->
      editor.moveCursorDown()
      expect(findView.resultCounter.text()).toBe '6 found'

    it "replaces results counter x of y text when user selects a marked range", ->
      editor.moveCursorDown()
      editor.setSelectedBufferRange([[2, 34], [2, 39]])
      expect(findView.resultCounter.text()).toEqual('3 of 6')

    it "places the selected text into the find editor when find-and-replace:set-find-pattern is triggered", ->
      editor.setSelectedBufferRange([[1,6],[1,10]])
      rootView.trigger 'find-and-replace:use-selection-as-find-pattern'

      expect(findView.findEditor.getText()).toBe 'sort'
      expect(editor.getSelectedBufferRange()).toEqual [[1,6],[1,10]]

      rootView.trigger 'find-and-replace:find-next'
      expect(editor.getSelectedBufferRange()).toEqual [[8,11],[8,15]]

    it "does not highlight the found text when the find view is hidden", ->
      findView.findEditor.trigger 'core:cancel'
      findView.findEditor.trigger 'find-and-replace:find-next'

      findResultsView = editor.find('.search-results')
      expect(findResultsView.parent()).not.toExist()

    describe "when the active pane item changes", ->
      describe "when a new edit session is activated", ->
        it "reruns the search on the new edit session", ->
          rootView.openSync('sample.coffee')
          editor = rootView.getActiveView()
          expect(findView.resultCounter.text()).toEqual('7 found')
          expect(editor.getSelectedBufferRange()).toEqual [[0, 0], [0, 0]]

        it "initially highlights the found text in the new edit session", ->
          findResultsView = editor.find('.search-results')

          rootView.openSync('sample.coffee')
          expect(findResultsView.children()).toHaveLength 7

        it "highlights the found text in the new edit session when find next is triggered", ->
          findResultsView = editor.find('.search-results')
          rootView.openSync('sample.coffee')
          editor = rootView.getActiveView()

          findView.findEditor.trigger 'find-and-replace:find-next'
          expect(findResultsView.children()).toHaveLength 7
          expect(findResultsView.parent()[0]).toBe editor.underlayer[0]

      describe "when all active pane items are closed", ->
        it "updates the result count", ->
          editor.trigger 'core:close'
          expect(findView.resultCounter.text()).toEqual('no results')

        it "removes all highlights", ->
          findResultsView = editor.find('.search-results')

          editor.trigger 'core:close'
          expect(findResultsView.children()).toHaveLength 0

      describe "when the active pane item is not an edit session", ->
        [anotherOpener] = []

        beforeEach ->
          anotherOpener = (pathToOpen, options) -> $('another')
          project.registerOpener(anotherOpener)

        afterEach ->
          project.unregisterOpener(anotherOpener)

        it "updates the result view", ->
          rootView.openSync "another"
          expect(findView.resultCounter.text()).toEqual('no results')

        it "removes all highlights", ->
          findResultsView = editor.find('.search-results')

          rootView.openSync "another"
          expect(findResultsView.children()).toHaveLength 0

      describe "when a new edit session is activated on a different pane", ->
        it "reruns the search on the new editSession", ->
          newEditor = editor.getPane().splitRight(project.openSync('sample.coffee')).activeView
          expect(findView.resultCounter.text()).toEqual('7 found')
          expect(newEditor.getSelectedBufferRange()).toEqual [[0, 0], [0, 0]]

          findView.findEditor.trigger 'find-and-replace:find-next'
          expect(findView.resultCounter.text()).toEqual('1 of 7')
          expect(newEditor.getSelectedBufferRange()).toEqual [[1, 9], [1, 14]]

        it "highlights the found text in the new edit session (and removes the highlights from the other)", ->
          findResultsView = editor.find('.search-results')

          expect(findResultsView.children()).toHaveLength 6
          editor.getPane().splitRight(project.openSync('sample.coffee'))
          expect(findResultsView.children()).toHaveLength 7

    describe "when the buffer contents change", ->
      it "re-runs the search", ->
        findResultsView = editor.find('.search-results')
        editor.setSelectedBufferRange([[1, 26], [1, 27]])
        editor.insertText("")

        window.advanceClock(1000)
        expect(findResultsView.children()).toHaveLength 5
        expect(findView.resultCounter.text()).toEqual('5 found')

        editor.insertText("s")
        window.advanceClock(1000)
        expect(findResultsView.children()).toHaveLength 6
        expect(findView.resultCounter.text()).toEqual('6 found')

      it "does not beep if no matches were found", ->
        editor.setCursorBufferPosition([2,0])
        findView.findEditor.setText 'notinthefilebro'
        findView.findEditor.trigger 'core:confirm'
        shell.beep.reset()

        editor.insertText("blah blah")
        expect(shell.beep).not.toHaveBeenCalled()

    describe "when finding within a selection", ->
      beforeEach ->
        editor.setSelectedBufferRange [[2, 0], [4, 0]]

      it "toggles find within a selction via and event and only finds matches within the selection", ->
        findView.findEditor.setText 'items'
        findView.findEditor.trigger 'find-and-replace:toggle-selection-option'
        expect(editor.getSelectedBufferRange()).toEqual [[2, 8], [2, 13]]
        expect(findView.resultCounter.text()).toEqual('1 of 3')

      it "toggles find within a selction via and button and only finds matches within the selection", ->
        findView.findEditor.setText 'items'
        findView.selectionOptionButton.click()
        expect(editor.getSelectedBufferRange()).toEqual [[2, 8], [2, 13]]
        expect(findView.resultCounter.text()).toEqual('1 of 3')

    describe "when regex is toggled", ->
      it "toggles regex via an event and finds text matching the pattern", ->
        editor.setCursorBufferPosition([2,0])
        findView.findEditor.trigger 'find-and-replace:toggle-regex-option'
        findView.findEditor.setText 'i[t]em+s'
        expect(editor.getSelectedBufferRange()).toEqual [[2, 8], [2, 13]]

      it "toggles regex via a button and finds text matching the pattern", ->
        editor.setCursorBufferPosition([2,0])
        findView.regexOptionButton.click()
        findView.findEditor.setText 'i[t]em+s'
        expect(editor.getSelectedBufferRange()).toEqual [[2, 8], [2, 13]]

      it "re-runs the search using the new find text when toggled", ->
        editor.setCursorBufferPosition([1,0])
        findView.findEditor.setText 's(o)rt'
        findView.findEditor.trigger 'find-and-replace:toggle-regex-option'
        expect(editor.getSelectedBufferRange()).toEqual [[1, 6], [1, 10]]

      describe "when an invalid regex is entered", ->
        it "displays an error", ->
          editor.setCursorBufferPosition([2,0])
          findView.findEditor.trigger 'find-and-replace:toggle-regex-option'
          findView.findEditor.setText 'i[t'
          findView.findEditor.trigger 'core:confirm'
          expect(findView.errorMessages.children()).toHaveLength 1
          expect(findView.infoMessages.children()).toHaveLength 0

    describe "when case sensitivity is toggled", ->
      beforeEach ->
        editor.setText "-----\nwords\nWORDs\n"
        editor.setCursorBufferPosition([0,0])

      it "toggles case sensitivity via an event and finds text matching the pattern", ->
        findView.findEditor.setText 'WORDs'
        findView.findEditor.trigger 'core:confirm'
        expect(editor.getSelectedBufferRange()).toEqual [[1, 0], [1, 5]]

        editor.setCursorBufferPosition([0,0])
        findView.findEditor.trigger 'find-and-replace:toggle-case-option'
        expect(editor.getSelectedBufferRange()).toEqual [[2, 0], [2, 5]]

      it "toggles case sensitivity via a button and finds text matching the pattern", ->
        findView.findEditor.setText 'WORDs'
        findView.findEditor.trigger 'core:confirm'
        expect(editor.getSelectedBufferRange()).toEqual [[1, 0], [1, 5]]

        editor.setCursorBufferPosition([0,0])
        findView.caseOptionButton.click()
        expect(editor.getSelectedBufferRange()).toEqual [[2, 0], [2, 5]]

    describe "highlighting search results", ->
      [findResultsView] = []
      beforeEach ->
        findResultsView = editor.find('.search-results')

      it "only highlights matches", ->
        expect(findResultsView.parent()[0]).toBe editor.underlayer[0]
        expect(findResultsView.children()).toHaveLength 6

        findView.findEditor.setText 'notinthefilebro'
        findView.findEditor.trigger 'core:confirm'

        expect(findResultsView.children()).toHaveLength 0

    describe "when another find is called", ->
      previousMarkers = null

      beforeEach ->
        previousMarkers = _.clone(editor.activeEditSession.getMarkers())

      it "clears existing markers for another search", ->
        findView.findEditor.setText('notinthefile')
        findView.findEditor.trigger 'core:confirm'
        expect(editor.activeEditSession.getMarkers().length).toEqual 1

      it "clears existing markers for an empty search", ->
        findView.findEditor.setText('')
        findView.findEditor.trigger 'core:confirm'
        expect(editor.activeEditSession.getMarkers().length).toEqual 1

  describe "replacing", ->
    beforeEach ->
      editor.setCursorBufferPosition([2,0])
      editor.trigger 'find-and-replace:show-replace'
      findView.findEditor.setText('items')
      findView.replaceEditor.setText('cats')

    describe "replace next", ->
      describe "when core:confirm is triggered", ->
        it "replaces the match after the cursor and selects the next match", ->
          findView.replaceEditor.trigger 'core:confirm'
          expect(findView.resultCounter.text()).toEqual('2 of 5')
          expect(editor.lineForBufferRow(2)).toBe "    if (cats.length <= 1) return items;"
          expect(editor.getSelectedBufferRange()).toEqual [[2, 33], [2, 38]]

        it "replaces the _current_ match and selects the next match", ->
          findView.findEditor.trigger 'core:confirm'
          editor.setSelectedBufferRange([[2, 8], [2, 13]])
          expect(findView.resultCounter.text()).toEqual('2 of 6')

          findView.replaceEditor.trigger 'core:confirm'
          expect(findView.resultCounter.text()).toEqual('2 of 5')
          expect(editor.lineForBufferRow(2)).toBe "    if (cats.length <= 1) return items;"
          expect(editor.getSelectedBufferRange()).toEqual [[2, 33], [2, 38]]

          findView.replaceEditor.trigger 'core:confirm'
          expect(findView.resultCounter.text()).toEqual('2 of 4')
          expect(editor.lineForBufferRow(2)).toBe "    if (cats.length <= 1) return cats;"
          expect(editor.getSelectedBufferRange()).toEqual [[3, 16], [3, 21]]

      describe "when the replace next button is pressed", ->
        it "replaces the match after the cursor and selects the next match", ->
          $('.find-and-replace .btn-next').click()
          expect(findView.resultCounter.text()).toEqual('2 of 5')
          expect(editor.lineForBufferRow(2)).toBe "    if (cats.length <= 1) return items;"
          expect(editor.getSelectedBufferRange()).toEqual [[2, 33], [2, 38]]

      describe "when the 'find-and-replace:replace-next' event is triggered", ->
        it "replaces the match after the cursor and selects the next match", ->
          editor.trigger 'find-and-replace:replace-next'
          expect(findView.resultCounter.text()).toEqual('2 of 5')
          expect(editor.lineForBufferRow(2)).toBe "    if (cats.length <= 1) return items;"
          expect(editor.getSelectedBufferRange()).toEqual [[2, 33], [2, 38]]

    describe "replace all", ->
      describe "when the replace all button is pressed", ->
        it "replaces all matched text", ->
          $('.find-and-replace .btn-all').click()
          expect(findView.resultCounter.text()).toEqual('no results')
          expect(editor.getText()).not.toMatch /items/
          expect(editor.getText().match(/\bcats\b/g)).toHaveLength 6
          expect(editor.getSelectedBufferRange()).toEqual [[2, 0], [2, 0]]

      describe "when the 'find-and-replace:replace-all' event is triggered", ->
        it "replaces all matched text", ->
          editor.trigger 'find-and-replace:replace-all'
          expect(findView.resultCounter.text()).toEqual('no results')
          expect(editor.getText()).not.toMatch /items/
          expect(editor.getText().match(/\bcats\b/g)).toHaveLength 6
          expect(editor.getSelectedBufferRange()).toEqual [[2, 0], [2, 0]]

    describe "replacement patterns", ->
      describe "when the regex option is true", ->
        it "replaces $1, $2, etc... with substring matches", ->
          findView.findEditor.trigger 'find-and-replace:toggle-regex-option'
          findView.findEditor.setText('i(t)e(m)s')
          findView.replaceEditor.setText('$2i$1$1ens')
          editor.trigger 'find-and-replace:replace-all'
          expect(editor.getText()).not.toMatch /items/
          expect(editor.getText().match(/\bmittens\b/g)).toHaveLength 6

      describe "when the regex option is false", ->
        it "replaces the matches with without any regex subsitions", ->
          findView.findEditor.setText('items')
          findView.replaceEditor.setText('$&cats')
          editor.trigger 'find-and-replace:replace-all'
          expect(editor.getText()).not.toMatch /items/
          expect(editor.getText().match(/\$&cats\b/g)).toHaveLength 6

  describe "history", ->
    describe "when there is no history", ->
      it "retains unsearched text", ->
        text = 'something I want to search for but havent yet'
        findView.findEditor.setText(text)

        findView.findEditor.trigger 'core:move-up'
        expect(findView.findEditor.getText()).toEqual ''

        findView.findEditor.trigger 'core:move-down'
        expect(findView.findEditor.getText()).toEqual text

    describe "when there is history", ->
      [oneRange, twoRange, threeRange] = []

      beforeEach ->
        editor.trigger 'find-and-replace:show'
        editor.setText("zero\none\ntwo\nthree\n")
        findView.findEditor.setText('one')
        findView.findEditor.trigger 'core:confirm'
        findView.findEditor.setText('two')
        findView.findEditor.trigger 'core:confirm'
        findView.findEditor.setText('three')
        findView.findEditor.trigger 'core:confirm'

      it "can navigate the entire history stack", ->
        expect(findView.findEditor.getText()).toEqual 'three'

        findView.findEditor.trigger 'core:move-down'
        expect(findView.findEditor.getText()).toEqual ''

        findView.findEditor.trigger 'core:move-down'
        expect(findView.findEditor.getText()).toEqual ''

        findView.findEditor.trigger 'core:move-up'
        expect(findView.findEditor.getText()).toEqual 'three'

        findView.findEditor.trigger 'core:move-up'
        expect(findView.findEditor.getText()).toEqual 'two'

        findView.findEditor.trigger 'core:move-up'
        expect(findView.findEditor.getText()).toEqual 'one'

        findView.findEditor.trigger 'core:move-up'
        expect(findView.findEditor.getText()).toEqual 'one'

        findView.findEditor.trigger 'core:move-down'
        expect(findView.findEditor.getText()).toEqual 'two'

      it "retains the current unsearched text", ->
        text = 'something I want to search for but havent yet'
        findView.findEditor.setText(text)

        findView.findEditor.trigger 'core:move-up'
        expect(findView.findEditor.getText()).toEqual 'three'

        findView.findEditor.trigger 'core:move-down'
        expect(findView.findEditor.getText()).toEqual text

        findView.findEditor.trigger 'core:move-up'
        expect(findView.findEditor.getText()).toEqual 'three'

        findView.findEditor.trigger 'core:move-down'
        findView.findEditor.trigger 'core:confirm'

        findView.findEditor.trigger 'core:move-down'
        expect(findView.findEditor.getText()).toEqual ''

      it "adds confirmed patterns to the history", ->
        findView.findEditor.setText("cool stuff")
        findView.findEditor.trigger 'core:confirm'

        findView.findEditor.setText("cooler stuff")
        findView.findEditor.trigger 'core:move-up'
        expect(findView.findEditor.getText()).toEqual 'cool stuff'

        findView.findEditor.trigger 'core:move-up'
        expect(findView.findEditor.getText()).toEqual 'three'
