###
 * A provider provides an interface to the autocomplete+ package. Third-party
 * packages can register providers which will then be used to generate the
 * suggestions list.
###

module.exports =
class Provider
  constructor: (@editorView) ->
    @initialize.apply this, arguments

  ###
   * An an initializer for subclasses
   * @private
  ###
  initialize: ->
    return

  ###
   * Defines whether the words returned at #buildWordList() should be added to
   * the default suggestions or should be displayed exclusively
   * @type {Boolean}
  ###
  exclusive: false

  ###
   * Builds an array of suggestions for the given prefix string. If `exclusive`
   * is set to true and this method does not return an empty array or a falsy
   * value, the returned suggestions will be the only ones that are displayed.
   * @return {Array}
   * @public
  ###
  buildSuggestions: ->
    throw new Error "Subclass must implement a buildWordList(prefix) method"

  ###
   * Gets called when a suggestion has been confirmed by the user. Return true
   * to replace the word with the suggestion. Return false if you want to handle
   * the behavior yourself.
   * @param  {Suggestion} suggestion
   * @return {Boolean}
   * @public
  ###
  confirm: (suggestion) ->
    return true
