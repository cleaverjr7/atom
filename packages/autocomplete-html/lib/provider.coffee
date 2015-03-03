fs = require 'fs'
path = require 'path'

trailingWhitespace = /\s$/
attributePattern = /\s+([a-zA-Z][-a-zA-Z]*)\s*=\s*$/
tagPattern = /<([a-zA-Z][-a-zA-Z]*)(?:\s|$)/

module.exports =
  selector: '.text.html'
  id: 'autocomplete-html-htmlprovider'

  requestHandler: (request) ->
    if @isAttributeValueStartWithNoPrefix(request)
      @getAllAttributeValueCompletions(request)
    else if @isAttributeValueStartWithPrefix(request)
      @getAttributeValueCompletions(request)
    else if @isAttributeStartWithNoPrefix(request)
      @getAllAttributeNameCompletions(request)
    else if @isAttributeStartWithPrefix(request)
      @getAttributeNameCompletions(request)
    else if @isTagStartWithNoPrefix(request)
      @getAllTagNameCompletions()
    else if @isTagStartTagWithPrefix(request)
      @getTagNameCompletions(request)
    else
      []

  isTagStartWithNoPrefix: ({prefix, scope}) ->
    scopes = scope.getScopesArray()
    prefix is '<' and scopes.length is 1 and scopes[0] is 'text.html.basic'

  isTagStartTagWithPrefix: ({prefix, scope}) ->
    return false unless prefix
    return false if trailingWhitespace.test(prefix)
    @hasTagScope(scope.getScopesArray())

  isAttributeStartWithNoPrefix: ({prefix, scope}) ->
    return false unless trailingWhitespace.test(prefix)
    @hasTagScope(scope.getScopesArray())

  isAttributeStartWithPrefix: ({prefix, scope}) ->
    return false unless prefix
    return false if trailingWhitespace.test(prefix)

    scopes = scope.getScopesArray()
    return true if scopes.indexOf('entity.other.attribute-name.html') isnt -1
    return false unless @hasTagScope(scopes)

    scopes.indexOf('punctuation.definition.tag.html') isnt -1 or
      scopes.indexOf('punctuation.definition.tag.end.html') isnt -1

  isAttributeValueStartWithNoPrefix: ({scope, prefix}) ->
    lastPrefixCharacter = prefix[prefix.length - 1]
    return false unless lastPrefixCharacter in ['"', "'"]
    scopes = scope.getScopesArray()
    @hasStringScope(scopes) and @hasTagScope(scopes)

  isAttributeValueStartWithPrefix: ({scope, prefix}) ->
    lastPrefixCharacter = prefix[prefix.length - 1]
    return false if lastPrefixCharacter in ['"', "'"]
    scopes = scope.getScopesArray()
    @hasStringScope(scopes) and @hasTagScope(scopes)

  hasTagScope: (scopes) ->
    scopes.indexOf('meta.tag.any.html') isnt -1 or
      scopes.indexOf('meta.tag.other.html') isnt -1 or
      scopes.indexOf('meta.tag.block.any.html') isnt -1 or
      scopes.indexOf('meta.tag.inline.any.html') isnt -1 or
      scopes.indexOf('meta.tag.structure.any.html') isnt -1

  hasStringScope: (scopes) ->
    scopes.indexOf('string.quoted.double.html') isnt -1 or
      scopes.indexOf('string.quoted.single.html') isnt -1

  getAllTagNameCompletions: ->
    completions = []
    for tag, attributes of @completions.tags
      completions.push({word: tag, prefix: ''})
    completions

  getTagNameCompletions: ({prefix}) ->
    completions = []
    lowerCasePrefix = prefix.toLowerCase()
    for tag, attributes of @completions.tags when tag.indexOf(lowerCasePrefix) is 0
      completions.push({word: tag, prefix})
    completions

  getAllAttributeNameCompletions: ({editor, position}) ->
    completions = []

    for attribute, options of @completions.attributes
      completions.push({word: attribute, prefix: ''}) if options.global

    tagAttributes = @getTagAttributes(editor, position)
    for attribute in tagAttributes
      completions.push({word: attribute, prefix: ''})

    completions

  getAttributeNameCompletions: ({editor, position, prefix}) ->
    completions = []

    lowerCasePrefix = prefix.toLowerCase()
    for attribute, options of @completions.attributes when attribute.indexOf(lowerCasePrefix) is 0
      completions.push({word: attribute, prefix}) if options.global

    tagAttributes = @getTagAttributes(editor, position)
    for attribute in tagAttributes when attribute.indexOf(prefix) is 0
      completions.push({word: attribute, prefix})

    completions

  getAllAttributeValueCompletions: ({editor, position}) ->
    completions = []
    values = @getAttributeValues(editor, position)
    for value in values
      completions.push({word: value, prefix: ''})
    completions

  getAttributeValueCompletions: ({editor, position, prefix}) ->
    completions = []
    values = @getAttributeValues(editor, position)
    lowerCasePrefix = prefix.toLowerCase()
    for value in values when value.indexOf(lowerCasePrefix) is 0
      completions.push({word: value, prefix})
    completions

  loadCompletions: ->
    @completions = {}
    fs.readFile path.resolve(__dirname, '..', 'completions.json'), (error, content) =>
      @completions = JSON.parse(content) unless error?
      return

  getPreviousTag: (editor, position) ->
    {row} = position
    while row >= 0
      tag = tagPattern.exec(editor.lineTextForBufferRow(row))?[1]
      return tag if tag
      row--
    return

  getPreviousAttribute: (editor, position) ->
    line = editor.getTextInRange([[position.row, 0], position]).trim()

    # Remove everything until the opening quote
    quoteIndex = line.length - 1
    quoteIndex-- while line[quoteIndex] and not (line[quoteIndex] in ['"', "'"])
    line = line.substring(0, quoteIndex)

    attributePattern.exec(line)?[1]

  getAttributeValues: (editor, position) ->
    attribute = @completions.attributes[@getPreviousAttribute(editor, position)]
    attribute?.attribOption ? []

  getTagAttributes: (editor, position) ->
    tag = @getPreviousTag(editor, position)
    @completions.tags[tag]?.attributes ? []
