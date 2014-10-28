fs = require 'fs'
{SelectListView} = require 'atom'
Encodings = require './encodings'


# View to display a list of encodings to use in the current editor.
module.exports =
class EncodingListView extends SelectListView
  initialize: (@editor) ->
    super

    @addClass('encoding-selector from-top overlay')
    @list.addClass('mark-active')

    @currentEncoding = @editor.getEncoding()

    @subscribe this, 'encoding-selector:show', =>
      @cancel()
      false

    encodings = []

    if fs.existsSync(@editor.getPath())
      encodings.push({id: 'detect', name: 'Auto Detect'})

    for id, names of Encodings
      encodings.push({id, name: names.list})
    @setItems(encodings)

  getFilterKey: ->
    'name'

  viewForItem: (encoding) ->
    element = document.createElement('li')
    element.classList.add('active') if encoding.id is @currentEncoding
    element.textContent = encoding.name
    element.dataset.encoding = encoding.id
    element

  detectEncoding: ->
    filePath = @editor.getPath()
    if fs.existsSync(filePath)
      chardet = require 'chardet'
      iconv = require 'iconv-lite'
      chardet.detectFile filePath, (error, encoding) =>
        return if error?
        return unless iconv.encodingExists(encoding)

        encoding = encoding.toLowerCase().replace(/[^0-9a-z]|:\d{4}$/g, '')
        @editor.setEncoding(encoding)

  confirmed: (encoding) ->
    @cancel()

    if encoding.id is 'detect'
      @detectEncoding()
    else
      @editor.setEncoding(encoding.id)

  attach: ->
    @storeFocusedElement()
    atom.workspaceView.append(this)
    @focusFilterEditor()
