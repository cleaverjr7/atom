{$$, View} = require 'atom-space-pen-views'

module.exports =
class PackagePanelView extends View
  @content: (title) ->
    @div class: 'tool-panel padded package-panel', =>
      @div class: 'inset-panel', =>
        @div class: 'panel-heading', title
        @div class: 'panel-body padded', =>
          @div class: 'text-info', outlet: 'summary'
          @ul class: 'list-group', outlet: 'list'

  addPackages: (packages, timeKey) ->
    @addPackage(pack, timeKey) for pack in packages

  addPackage: (pack, timeKey) ->
    @list.append $$ ->
      @li class: 'list-item', =>
        homepage = pack.metadata?.homepage
        homepage ?= "https://atom.io/packages/#{pack.name}"
        @a class: 'inline-block', href: homepage, pack.name
        highlightClass = 'highlight-warning'
        highlightClass = 'highlight-error' if pack[timeKey] > 25
        @span class: "inline-block #{highlightClass}", "#{pack[timeKey]}ms"
