describe "perl grammar", ->
  grammar = null

  beforeEach ->
    waitsForPromise ->
      atom.packages.activatePackage("language-perl")

    runs ->
      grammar = atom.grammars.grammarForScopeName("source.perl")

  it "parses the grammar", ->
    expect(grammar).toBeDefined()
    expect(grammar.scopeName).toBe "source.perl"

  it "tokenizes regexp replace", ->
    {tokens} = grammar.tokenizeLine('s/text/test/')
    expect(tokens[0]).toEqual value: "s", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl", "punctuation.definition.string.perl", "support.function.perl"], bufferDelta: 1, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 1
    expect(tokens[1]).toEqual value: "/", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl", "punctuation.definition.string.perl"], bufferDelta: 1, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 1
    expect(tokens[2]).toEqual value: "text", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl"], bufferDelta: 4, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 4
    expect(tokens[3]).toEqual value: "/", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl", "punctuation.definition.string.perl"], bufferDelta: 1, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 1
    expect(tokens[4]).toEqual value: "test", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl"], bufferDelta: 4, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 4
    expect(tokens[5]).toEqual value: "/", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl", "punctuation.definition.string.perl"], bufferDelta: 1, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 1

    {tokens} = grammar.tokenizeLine('s_text_test_')
    expect(tokens[0]).toEqual value: "s", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl", "punctuation.definition.string.perl", "support.function.perl"], bufferDelta: 1, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 1
    expect(tokens[1]).toEqual value: "_", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl", "punctuation.definition.string.perl"], bufferDelta: 1, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 1
    expect(tokens[2]).toEqual value: "text", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl"], bufferDelta: 4, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 4
    expect(tokens[3]).toEqual value: "_", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl", "punctuation.definition.string.perl"], bufferDelta: 1, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 1
    expect(tokens[4]).toEqual value: "test", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl"], bufferDelta: 4, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 4
    expect(tokens[5]).toEqual value: "_", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl", "punctuation.definition.string.perl"], bufferDelta: 1, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 1

    {tokens} = grammar.tokenizeLine('s/text/test/gxr')
    expect(tokens[0]).toEqual value: "s", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl", "punctuation.definition.string.perl", "support.function.perl"], bufferDelta: 1, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 1
    expect(tokens[1]).toEqual value: "/", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl", "punctuation.definition.string.perl"], bufferDelta: 1, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 1
    expect(tokens[2]).toEqual value: "text", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl"], bufferDelta: 4, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 4
    expect(tokens[3]).toEqual value: "/", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl", "punctuation.definition.string.perl"], bufferDelta: 1, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 1
    expect(tokens[4]).toEqual value: "test", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl"], bufferDelta: 4, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 4
    expect(tokens[5]).toEqual value: "/", scopes: ["source.perl", "string.regexp.replaceXXX.simple_delimiter.perl", "punctuation.definition.string.perl"], bufferDelta: 1, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 1
    expect(tokens[6]).toEqual value: "gxr", scopes: ["source.perl", "string.regexp.replace.perl", "punctuation.definition.string.perl", "keyword.control.regexp-option.perl"], bufferDelta: 3, hasPairedCharacter: false, isAtomic: undefined, isHardTab: undefined, isSoftWrapIndentation: undefined, screenDelta: 3