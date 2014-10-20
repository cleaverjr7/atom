path = require 'path'
_ = require 'underscore-plus'
{$$$, View} = require 'atom'
SettingsPanel = require './settings-panel'

# View to display the grammars that a package has registered.
module.exports =
class PackageGrammarsView extends View
  @content: ->
    @section =>
      @div outlet: 'grammarSettings'

  initialize: (packagePath) ->
    @packagePath = path.join(packagePath, path.sep)
    @addGrammars()
    @subscribe atom.syntax, 'grammar-added grammar-updated', => @addGrammars()

  getPackageGrammars: ->
    packageGrammars = []
    grammars = atom.syntax.grammars ? []
    for grammar in grammars when grammar.path
      packageGrammars.push(grammar) if grammar.path.indexOf(@packagePath) is 0
    packageGrammars.sort (grammar1, grammar2) ->
      name1 = grammar1.name ? grammar1.scopeName ? ''
      name2 = grammar2.name ? grammar2.scopeName ? ''
      name1.localeCompare(name2)

  addGrammarHeading: (grammar, panel) ->
    panel.find('.section-body').prepend $$$ ->
      @table class: 'package-grammars-table table native-key-bindings text', tabindex: -1, =>
        @thead =>
          @tr =>
            @th 'Scope'
            @th 'File Types'
        @tbody =>
          @tr =>
            @td grammar.scopeName ? ''
            @td class: 'grammar-table-filetypes', grammar.fileTypes?.join(', ') ? ''

  addGrammars: ->
    @grammarSettings.empty()

    for grammar in @getPackageGrammars()
      continue unless grammar.scopeName
      scopeName = ".#{grammar.scopeName}" unless grammar.scopeName[0] is '.'
      title = "#{grammar.name} Grammar Settings"
      panel = new SettingsPanel(null, {title, scopeName, icon: 'puzzle'})
      @addGrammarHeading(grammar, panel)
      @grammarSettings.append(panel)
