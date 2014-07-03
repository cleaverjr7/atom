describe "less grammar", ->
  grammar = null

  beforeEach ->
    waitsForPromise ->
      atom.packages.activatePackage("language-less")

    runs ->
      grammar = atom.syntax.grammarForScopeName("source.css.less")

  it "parses the grammar", ->
    expect(grammar).toBeDefined()
    expect(grammar.scopeName).toBe "source.css.less"

  it "parses constant.numeric.css", ->
    {tokens} = grammar.tokenizeLine(" 10")
    expect(tokens).toHaveLength 2
    expect(tokens[0]).toEqual value: " ", scopes: ['source.css.less']
    expect(tokens[1]).toEqual value: "10", scopes: ['source.css.less', 'constant.numeric.css']

    {tokens} = grammar.tokenizeLine("-.1")
    expect(tokens).toHaveLength 1
    expect(tokens[0]).toEqual value: "-.1", scopes: ['source.css.less', 'constant.numeric.css']

  it "parses property names distinctly from property values with the same text", ->
    {tokens} = grammar.tokenizeLine("left: left;")

    expect(tokens).toHaveLength 4
    expect(tokens[0]).toEqual value: "left", scopes: ['source.css.less', 'support.type.property-name.css']
    expect(tokens[1]).toEqual value: ": ", scopes: ['source.css.less']
    expect(tokens[2]).toEqual value: "left", scopes: ['source.css.less', 'support.constant.property-value.css']
    expect(tokens[3]).toEqual value: ";", scopes: ['source.css.less']

    {tokens} = grammar.tokenizeLine("left:left;")

    expect(tokens).toHaveLength 4
    expect(tokens[0]).toEqual value: "left", scopes: ['source.css.less', 'support.type.property-name.css']
    expect(tokens[1]).toEqual value: ":", scopes: ['source.css.less']
    expect(tokens[2]).toEqual value: "left", scopes: ['source.css.less', 'support.constant.property-value.css']
    expect(tokens[3]).toEqual value: ";", scopes: ['source.css.less']
