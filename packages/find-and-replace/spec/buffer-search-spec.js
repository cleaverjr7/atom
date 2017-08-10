const dedent = require('dedent')
const {TextEditor} = require('atom');
const FindOptions = require('../lib/find-options');
const BufferSearch = require('../lib/buffer-search');

describe("BufferSearch", () => {
  let model, editor, markersListener, currentResultListener;

  beforeEach(() => {
    editor = new TextEditor();
    spyOn(editor, 'scanInBufferRange').andCallThrough();

    editor.setText(dedent`
      -----------
      aaa bbb ccc
      ddd aaa bbb
      ccc ddd aaa
      -----------
      aaa bbb ccc
      ddd aaa bbb
      ccc ddd aaa
      -----------
    `);
    advanceClock(editor.buffer.stoppedChangingDelay);

    const findOptions = new FindOptions({findPattern: "a+"});
    model = new BufferSearch(findOptions);

    markersListener = jasmine.createSpy('markersListener');
    model.onDidUpdate(markersListener);

    currentResultListener = jasmine.createSpy('currentResultListener');
    model.onDidChangeCurrentResult(currentResultListener);

    model.setEditor(editor);
    markersListener.reset();

    model.search("a+", {
      caseSensitive: false,
      useRegex: true,
      wholeWord: false
    });
  });

  afterEach(() => {
    model.destroy();
    editor.destroy();
  });

  function getHighlightedRanges() {
    const ranges = [];
    const decorations = editor.decorationsStateForScreenRowRange(0, editor.getLineCount())
    for (const id in decorations) {
      const decoration = decorations[id];
      if (['find-result', 'current-result'].includes(decoration.properties.class)) {
        ranges.push(decoration.screenRange);
      }
    }
    return ranges
      .sort((a, b) => a.compare(b))
      .map(range => range.serialize());
  };

  function expectUpdateEvent() {
    expect(markersListener.callCount).toBe(1);
    const emittedMarkerRanges = markersListener
      .mostRecentCall.args[0]
      .map(marker => marker.getBufferRange().serialize());
    expect(emittedMarkerRanges).toEqual(getHighlightedRanges());
    markersListener.reset();
  };

  function expectNoUpdateEvent() {
    expect(markersListener).not.toHaveBeenCalled();
  }

  function scannedRanges() {
    return editor.scanInBufferRange.argsForCall.map(args => args[1]);
  }

  it("highlights all the occurrences of the search regexp", () => {
    expectUpdateEvent();
    expect(getHighlightedRanges()).toEqual([
      [[1, 0], [1, 3]],
      [[2, 4], [2, 7]],
      [[3, 8], [3, 11]],
      [[5, 0], [5, 3]],
      [[6, 4], [6, 7]],
      [[7, 8], [7, 11]]
    ]);

    expect(scannedRanges()).toEqual([
      [[0, 0], [Infinity, Infinity]]
    ]);
  });

  describe("when the buffer changes", () => {
    beforeEach(() => {
      markersListener.reset();
      editor.scanInBufferRange.reset();
    });

    describe("when changes occur in the middle of the buffer", () => {
      it("removes any invalidated search results and recreates markers in the changed regions", () => {
        editor.setCursorBufferPosition([2, 5]);
        editor.addCursorAtBufferPosition([6, 5]);
        editor.insertText(".");
        editor.insertText(".");

        expectNoUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[7, 8], [7, 11]]
        ]);

        advanceClock(editor.buffer.stoppedChangingDelay);

        expectUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[2, 4], [2, 5]],
          [[2, 7], [2, 9]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 5]],
          [[6, 7], [6, 9]],
          [[7, 8], [7, 11]]
        ]);

        expect(scannedRanges()).toEqual([
          [[1, 0], [3, 11]],
          [[5, 0], [7, 11]]
        ]);
      })
    });

    describe("when changes occur within the first search result", () => {
      it("rescans the buffer from the beginning to the first valid marker", () => {
        editor.setCursorBufferPosition([1, 2]);
        editor.insertText(".");
        editor.insertText(".");

        expectNoUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[2, 4], [2, 7]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 11]]
        ]);

        advanceClock(editor.buffer.stoppedChangingDelay);

        expectUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 2]],
          [[1, 4], [1, 5]],
          [[2, 4], [2, 7]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 11]]
        ]);

        expect(scannedRanges()).toEqual([
          [[0, 0], [2, 7]]
        ]);
      })
    });

    describe("when changes occur within the last search result", () => {
      it("rescans the buffer from the last valid marker to the end", () => {
        editor.setCursorBufferPosition([7, 9]);
        editor.insertText(".");
        editor.insertText(".");

        expectNoUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[2, 4], [2, 7]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]]
        ]);

        advanceClock(editor.buffer.stoppedChangingDelay);

        expectUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[2, 4], [2, 7]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 9]],
          [[7, 11], [7, 13]]
        ]);

        expect(scannedRanges()).toEqual([
          [[6, 4], [Infinity, Infinity]]
        ]);
      })
    });

    describe("when changes occur within two adjacent markers", () => {
      it("rescans the changed region in a single scan", () => {
        editor.setCursorBufferPosition([2, 5]);
        editor.addCursorAtBufferPosition([3, 9]);
        editor.insertText(".");
        editor.insertText(".");

        expectNoUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 11]]
        ]);

        advanceClock(editor.buffer.stoppedChangingDelay);

        expectUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[2, 4], [2, 5]],
          [[2, 7], [2, 9]],
          [[3, 8], [3, 9]],
          [[3, 11], [3, 13]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 11]]
        ]);

        expect(scannedRanges()).toEqual([
          [[1, 0], [5, 3]]
        ]);
      })
    });

    describe("when changes extend an existing search result", () => {
      it("updates the results with the new extended ranges", () => {
        editor.setCursorBufferPosition([2, 4]);
        editor.addCursorAtBufferPosition([6, 7]);
        editor.insertText("a");
        editor.insertText("a");

        expectNoUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[2, 6], [2, 9]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 11]]
        ]);

        advanceClock(editor.buffer.stoppedChangingDelay);

        expectUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[2, 4], [2, 9]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 9]],
          [[7, 8], [7, 11]]
        ]);
      })
    });

    describe("when the changes are before any marker", () => {
      it("doesn't change the markers", () => {
        editor.setCursorBufferPosition([0, 3]);
        editor.insertText("..");

        expectNoUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[2, 4], [2, 7]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 11]]
        ]);

        advanceClock(editor.buffer.stoppedChangingDelay);

        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[2, 4], [2, 7]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 11]]
        ]);

        expect(scannedRanges()).toEqual([
          [[0, 0], [1, 3]]
        ]);
      })
    });

    describe("when the changes are between markers", () => {
      it("doesn't change the markers", () => {
        editor.setCursorBufferPosition([3, 1]);
        editor.insertText("..");

        expectNoUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[2, 4], [2, 7]],
          [[3, 10], [3, 13]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 11]]
        ]);

        advanceClock(editor.buffer.stoppedChangingDelay);

        expectUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[2, 4], [2, 7]],
          [[3, 10], [3, 13]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 11]]
        ]);

        expect(scannedRanges()).toEqual([
          [[2, 4], [3, 13]]
        ]);
      })
    });

    describe("when the changes are after all the markers", () => {
      it("doesn't change the markers", () => {
        editor.setCursorBufferPosition([8, 3]);
        editor.insertText("..");

        expectNoUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[2, 4], [2, 7]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 11]]
        ]);

        advanceClock(editor.buffer.stoppedChangingDelay);

        expectUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[2, 4], [2, 7]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 11]]
        ]);

        expect(scannedRanges()).toEqual([
          [[7, 8], [Infinity, Infinity]]
        ]);
      })
    });

    describe("when the changes are undone", () => {
      it("recreates any temporarily-invalidated markers", () => {
        editor.setCursorBufferPosition([2, 5]);
        editor.insertText(".");
        editor.insertText(".");
        editor.backspace();
        editor.backspace();

        expectNoUpdateEvent();
        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 11]]
        ]);

        advanceClock(editor.buffer.stoppedChangingDelay);

        expect(getHighlightedRanges()).toEqual([
          [[1, 0], [1, 3]],
          [[2, 4], [2, 7]],
          [[3, 8], [3, 11]],
          [[5, 0], [5, 3]],
          [[6, 4], [6, 7]],
          [[7, 8], [7, 11]]
        ]);

        expect(scannedRanges()).toEqual([]);
      })
    });
  });

  describe("replacing a search result", () => {
    beforeEach(() => {
      editor.scanInBufferRange.reset()
    });

    it("replaces the marked text with the given string", () => {
      const markers = markersListener.mostRecentCall.args[0];
      markersListener.reset();

      editor.setSelectedBufferRange(markers[1].getBufferRange());
      expect(currentResultListener).toHaveBeenCalledWith(markers[1]);
      currentResultListener.reset();

      model.replace([markers[1]], "new-text");

      expect(editor.getText()).toBe(dedent`
        -----------
        aaa bbb ccc
        ddd new-text bbb
        ccc ddd aaa
        -----------
        aaa bbb ccc
        ddd aaa bbb
        ccc ddd aaa
        -----------
      `);

      expectUpdateEvent();
      expect(getHighlightedRanges()).toEqual([
        [[1, 0], [1, 3]],
        [[3, 8], [3, 11]],
        [[5, 0], [5, 3]],
        [[6, 4], [6, 7]],
        [[7, 8], [7, 11]]
      ]);

      const markerToSelect = markers[2];
      const rangeToSelect = markerToSelect.getBufferRange();

      editor.setSelectedBufferRange(rangeToSelect);
      expect(currentResultListener).toHaveBeenCalledWith(markerToSelect);
      currentResultListener.reset();

      advanceClock(editor.buffer.stoppedChangingDelay);

      expectUpdateEvent();
      expect(getHighlightedRanges()).toEqual([
        [[1, 0], [1, 3]],
        [[3, 8], [3, 11]],
        [[5, 0], [5, 3]],
        [[6, 4], [6, 7]],
        [[7, 8], [7, 11]]
      ]);
      expect(scannedRanges()).toEqual([
        [[1, 0], [3, 11]]
      ]);

      expect(currentResultListener).toHaveBeenCalled();
      expect(currentResultListener.mostRecentCall.args[0].getBufferRange()).toEqual(rangeToSelect);
      expect(currentResultListener.mostRecentCall.args[0].isDestroyed()).toBe(false);
    });

    it("replaces the marked text with the given string that contains escaped escape sequence", () => {
      const markers = markersListener.mostRecentCall.args[0];
      markersListener.reset();

      model.replace(markers, "new-text\\\\n");

      expect(editor.getText()).toBe([
        '-----------',
        'new-text\\n bbb ccc',
        'ddd new-text\\n bbb',
        'ccc ddd new-text\\n',
        '-----------',
        'new-text\\n bbb ccc',
        'ddd new-text\\n bbb',
        'ccc ddd new-text\\n',
        '-----------',
      ].join('\n'));
    });
  });

  describe(".prototype.resultsMarkerLayerForTextEditor(editor)", () =>
    it("creates or retrieves the results marker layer for the given editor", () => {
      const layer1 = model.resultsMarkerLayerForTextEditor(editor);

      // basic check that this is the expected results layer
      expect(layer1.findMarkers().length).toBeGreaterThan(0);
      for (const marker of layer1.findMarkers()) {
        expect(editor.getTextInBufferRange(marker.getBufferRange())).toMatch(/a+/);
      }

      const editor2 = new TextEditor();
      model.setEditor(editor2);
      const layer2 = model.resultsMarkerLayerForTextEditor(editor2);

      model.setEditor(editor);
      expect(model.resultsMarkerLayerForTextEditor(editor)).toBe(layer1);
      expect(model.resultsMarkerLayerForTextEditor(editor2)).toBe(layer2);

      model.search("c+", {
        caseSensitive: false,
        useRegex: true,
        wholeWord: false
      });

      expect(layer1.findMarkers().length).toBeGreaterThan(0);
      for (const marker of layer1.findMarkers()) {
        expect(editor.getTextInBufferRange(marker.getBufferRange())).toMatch(/c+/);
      }
    })
  );
});

describe("BufferSearch", () => {
  let model, editor, markersListener, currentResultListener;

  beforeEach(() => {
    editor = new TextEditor();
    spyOn(editor, 'scanInBufferRange').andCallThrough();

    editor.setText(dedent`
      -----------
      aaa bbb ccc
      ddd Aaa bbb
      CCC DDD aaa
      -----------
      AAA Bbb cCc
      Ddd Aaa Bbb
      ccc DDD Aaa
      -----------
    `);
    advanceClock(editor.buffer.stoppedChangingDelay);

    const findOptions = new FindOptions({findPattern: "aaa"});
    model = new BufferSearch(findOptions);

    markersListener = jasmine.createSpy('markersListener');
    model.onDidUpdate(markersListener);

    currentResultListener = jasmine.createSpy('currentResultListener');
    model.onDidChangeCurrentResult(currentResultListener);

    model.setEditor(editor);
    markersListener.reset();
  });

  afterEach(() => {
    model.destroy();
    editor.destroy();
  });


  describe("when replacing text with preserve case on", () => {
    beforeEach(() => {
      atom.config.set('find-and-replace.preserveCaseOnReplace', true)
    });

    it("preserves case.", () => {
      model.search("aaa", {
        caseSensitive: false,
        useRegex: false,
        wholeWord: false
      });
      const markers = markersListener.mostRecentCall.args[0];
      markersListener.reset();

      model.replace(markers, "foo");

      expect(editor.getText()).toBe(dedent`
        -----------
        foo bbb ccc
        ddd Foo bbb
        CCC DDD foo
        -----------
        FOO Bbb cCc
        Ddd Foo Bbb
        ccc DDD Foo
        -----------
      `);
    });

    it("preserves case using regex search.", () => {
      model.search("a+", {
        caseSensitive: false,
        useRegex: true,
        wholeWord: false
      });
      const markers = markersListener.mostRecentCall.args[0];
      markersListener.reset();

      model.replace(markers, "foo");

      expect(editor.getText()).toBe(dedent`
        -----------
        foo bbb ccc
        ddd Foo bbb
        CCC DDD foo
        -----------
        FOO Bbb cCc
        Ddd Foo Bbb
        ccc DDD Foo
        -----------
      `);
    });

    it("preserves case across words.", () => {
      model.search("aaa", {
        caseSensitive: false,
        useRegex: false,
        wholeWord: false
      });
      const markers = markersListener.mostRecentCall.args[0];
      markersListener.reset();

      model.replace(markers, "foo bar");

      expect(editor.getText()).toBe(dedent`
        -----------
        foo bar bbb ccc
        ddd Foo Bar bbb
        CCC DDD foo bar
        -----------
        FOO BAR Bbb cCc
        Ddd Foo Bar Bbb
        ccc DDD Foo Bar
        -----------
      `);
    });

    it("preserves case only when it's consistent between searched words.", () => {
      model.search("aaa bbb", {
        caseSensitive: false,
        useRegex: false,
        wholeWord: false
      });
      const markers = markersListener.mostRecentCall.args[0];
      markersListener.reset();

      model.replace(markers, "foo");

      expect(editor.getText()).toBe(dedent`
        -----------
        foo ccc
        ddd foo
        CCC DDD aaa
        -----------
        foo cCc
        Ddd Foo
        ccc DDD Aaa
        -----------
      `);
    });
    it("preserves case and honors caseSensitive option.", () => {
      model.search("Aaa", {
        caseSensitive: true,
        useRegex: false,
        wholeWord: false
      });
      const markers = markersListener.mostRecentCall.args[0];
      markersListener.reset();

      model.replace(markers, "foo");

      expect(editor.getText()).toBe(dedent`
        -----------
        aaa bbb ccc
        ddd Foo bbb
        CCC DDD aaa
        -----------
        AAA Bbb cCc
        Ddd Foo Bbb
        ccc DDD Foo
        -----------
      `);
    });
    it("preserves case of original replacement when capitalized.", () => {
      model.search("aaa", {
        caseSensitive: false,
        useRegex: false,
        wholeWord: false
      });
      const markers = markersListener.mostRecentCall.args[0];
      markersListener.reset();

      model.replace(markers, "FoO");

      expect(editor.getText()).toBe(dedent`
        -----------
        FoO bbb ccc
        ddd FoO bbb
        CCC DDD FoO
        -----------
        FOO Bbb cCc
        Ddd FoO Bbb
        ccc DDD FoO
        -----------
      `);
    });
  });
});
