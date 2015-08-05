{Emitter} = require 'atom'

Params = [
  'findPattern'
  'replacePattern'
  'pathsPattern'
  'useRegex'
  'wholeWord'
  'caseSensitive'
  'inCurrentSelection'
]

module.exports =
class FindOptions
  constructor: (state={}) ->
    @emitter = new Emitter

    @findPattern = state.findPattern ? ''
    @replacePattern = state.replacePattern ? ''
    @pathsPattern = state.pathsPattern ? ''
    @useRegex = state.useRegex ? atom.config.get('find-and-replace.useRegex') ? false
    @caseSensitive = state.caseSensitive ? atom.config.get('find-and-replace.caseSensitive') ? false
    @wholeWord = state.wholeWord ? atom.config.get('find-and-replace.wholeWord') ? false
    @inCurrentSelection = state.inCurrentSelection ? atom.config.get('find-and-replace.inCurrentSelection') ? false

  onDidChange: (callback) ->
    @emitter.on('did-change', callback)

  serialize: ->
    result = {}
    for param in Params
      result[param] = this[param]
    result

  set: (newParams={}) ->
    changed = false
    for key in Params
      if newParams[key]? and newParams[key] isnt this[key]
        this[key] = newParams[key]
        changed = true
    @emitter.emit('did-change') if changed
