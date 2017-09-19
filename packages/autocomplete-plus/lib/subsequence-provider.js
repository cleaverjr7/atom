'use babel'

import _ from 'underscore-plus'
import { CompositeDisposable, TextBuffer } from 'atom'
import { UnicodeLetters } from './unicode-helpers'
import { selectorsMatchScopeChain, buildScopeChainString } from './scope-helpers'
import ProviderConfig from './provider-config'

export default class SubsequenceProvider {
  constructor(options = {}) {
    this.defaults()

    this.subscriptions = new CompositeDisposable()
    this.watchedBuffers = new Map()

    if (options.atomConfig) {
      this.atomConfig = options.atomConfig
    }

    if (options.atomWorkspace) {
      this.atomWorkspace = options.atomWorkspace
    }

    this.providerConfig = new ProviderConfig({
      atomConfig: this.atomConfig
    })

    // make this.X available where X is the autocomplete-plus.X setting
    const settings = ['autocomplete-plus.enableExtendedUnicodeSupport' // TODO
    , 'autocomplete-plus.minimumWordLength'
    , 'autocomplete-plus.includeCompletionsFromAllBuffers'
    , 'autocomplete-plus.useLocalityBonus' // TODO
    , 'autocomplete-plus.strictMatching' // TODO
    ]
    settings.forEach(property => {
      this.subscriptions.add(this.atomConfig.observe(property, val => {
        this[property.split('.')[1]] = val
      }))
    })

    this.subscriptions.add(this.atomWorkspace.observeTextEditors((e) => {
      this.watchBuffer(e)
    }))

    this.configSuggestionsBuffer = new TextBuffer()
  }

  defaults() {
    this.atomConfig = atom.config
    this.atomWorkspace = atom.workspace

    this.additionalWordChars = "_"
    this.enableExtendedUnicodeSupport = false
    this.maxSuggestions = 20
    this.maxResultsPerBuffer = 100

    this.labels = ['workspace-center', 'default', 'subsequence-provider']
    this.scopeSelector = '*'
    this.inclusionPriority = 0
    this.suggestionPriority = 0

    this.watchedBuffers = null
  }

  dispose() {
    return this.subscriptions.dispose()
  }

  watchBuffer(editor) {
    const buffer = editor.getBuffer()

    this.watchedBuffers.set(buffer, editor)

    const bufferSubscriptions = new CompositeDisposable()

    bufferSubscriptions.add(buffer.onDidDestroy(() => {
      bufferSubscriptions.dispose()
      return this.watchedBuffers.delete(buffer)
    }))
  }

  configSuggestionsToSubsequenceMatches(suggestions, prefix) {
    const suggestionText = suggestions
      .map(sug => sug.displayText || sug.snippet || sug.text)
      .join('\n')

    this.configSuggestionsBuffer.setText(suggestionText)

    const assocSuggestion = word => {
      word.configSuggestion = suggestions[word.positions[0].row]
      return word
    }

    return this.configSuggestionsBuffer.findWordsWithSubsequence(
      prefix,
      '(){}[] :;,$@%',
      this.maxResultsPerBuffer
    ).then(words => words.map(assocSuggestion))
  }

  /*
  Section: Suggesting Completions
  */

  getSuggestions({editor, bufferPosition, prefix, scopeDescriptor}) {
    if (!prefix) {
      return
    }

    if (prefix.trim().length < this.minimumWordLength) {
      return
    }

    const buffers = this.includeCompletionsFromAllBuffers
      ? Array.from(this.watchedBuffers.keys())
      : [editor.getBuffer()]
    const configSuggestions = this.providerConfig.getSuggestionsForScopeDescriptor(
      scopeDescriptor
    )
    const configMatches = this.configSuggestionsToSubsequenceMatches(
      configSuggestions,
      prefix
    )

    const subsequenceMatchToType = (word) => {
      const editor = this.watchedBuffers.get(word.buffer)
      const scopeDescriptor = editor.scopeDescriptorForBufferPosition(word.positions[0])
      return this.providerConfig.scopeDescriptorToType(scopeDescriptor)
    }

    const bufferToSubsequenceMatches = (buffer) => {
      const assocBuffer = word => { word.buffer = buffer; return word}

      return buffer.findWordsWithSubsequence(
        prefix,
        this.additionalWordChars,
        this.maxResultsPerBuffer,
      ).then(words => words.map(assocBuffer))
    }

    const sortByScore = words => words.sort((a,b) => b.score - a.score)

    const head = words => _.head(words, this.maxSuggestions)

    const subsequenceMatchesToSuggestions = words => words.map(w => {
      return w.configSuggestion || {
        text: w.word,
        type: subsequenceMatchToType(w),
      }
    })

    const uniqueByWord = words => _.uniq(words, false, w => w.word)

    // when thinking about this, go from the bottom (flatten) up
    const transformToSuggestions = _.compose(
      subsequenceMatchesToSuggestions,
      head,
      uniqueByWord,
      sortByScore,
      _.flatten
    )

    return Promise
      .all(buffers.map(bufferToSubsequenceMatches).concat(configMatches))
      .then(transformToSuggestions)
  }
}
