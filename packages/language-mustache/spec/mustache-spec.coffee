describe 'Mustache grammar', ->
  grammar = null

  beforeEach ->
    waitsForPromise ->
      atom.packages.activatePackage('language-mustache')

    runs ->
      grammar = atom.syntax.grammarForScopeName('text.html.mustache')

  it 'parses the grammar', ->
    expect(grammar).toBeTruthy()
    expect(grammar.scopeName).toBe 'text.html.mustache'

  it 'parses comments', ->
    {tokens} = grammar.tokenizeLine("{{!comment}}")

    expect(tokens[0]).toEqual value: '{{!', scopes: ['text.html.mustache', 'comment.block.mustache']
    expect(tokens[1]).toEqual value: 'comment', scopes: ['text.html.mustache', 'comment.block.mustache']
    expect(tokens[2]).toEqual value: '}}', scopes: ['text.html.mustache', 'comment.block.mustache']

  it 'parses block expression', ->
    {tokens} = grammar.tokenizeLine("{{#each people}}")

    expect(tokens[0]).toEqual value: '{{', scopes: ['text.html.mustache', 'meta.tag.template.mustache', 'entity.name.tag.mustache']
    expect(tokens[1]).toEqual value: '#each', scopes: ['text.html.mustache', 'meta.tag.template.mustache', 'entity.name.tag.mustache', 'entity.name.function.mustache']
    expect(tokens[2]).toEqual value: ' people', scopes: ['text.html.mustache', 'meta.tag.template.mustache']
    expect(tokens[3]).toEqual value: '}}', scopes: ['text.html.mustache', 'meta.tag.template.mustache', 'entity.name.tag.mustache']

    {tokens} = grammar.tokenizeLine("{{^repo}}")

    expect(tokens[0]).toEqual value: '{{', scopes: ['text.html.mustache', 'meta.tag.template.mustache', 'entity.name.tag.mustache']
    expect(tokens[1]).toEqual value: '^repo', scopes: ['text.html.mustache', 'meta.tag.template.mustache', 'entity.name.tag.mustache', 'entity.name.function.mustache']
    expect(tokens[2]).toEqual value: '}}', scopes: ['text.html.mustache', 'meta.tag.template.mustache', 'entity.name.tag.mustache']

    {tokens} = grammar.tokenizeLine("{{/if}}")

    expect(tokens[0]).toEqual value: '{{', scopes: ['text.html.mustache', 'meta.tag.template.mustache', 'entity.name.tag.mustache']
    expect(tokens[1]).toEqual value: '/if', scopes: ['text.html.mustache', 'meta.tag.template.mustache', 'entity.name.tag.mustache', 'entity.name.function.mustache']
    expect(tokens[2]).toEqual value: '}}', scopes: ['text.html.mustache', 'meta.tag.template.mustache', 'entity.name.tag.mustache']
