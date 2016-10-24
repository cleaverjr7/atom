{$} = require 'atom-space-pen-views'

module.exports.buildInternalDragEvents = (dragged, enterTarget, dropTarget) ->
  dataTransfer =
    data: {}
    setData: (key, value) -> @data[key] = "#{value}" # Drag events stringify data values
    getData: (key) -> @data[key]
    setDragImage: (@image) -> return

  dragStartEvent = $.Event()
  dragStartEvent.target = dragged
  dragStartEvent.currentTarget = dragged
  dragStartEvent.originalEvent = {dataTransfer}

  dropEvent = $.Event()
  dropEvent.target = dropTarget
  dropEvent.currentTarget = dropTarget
  dropEvent.originalEvent = {dataTransfer}

  dragEnterEvent = $.Event()
  dragEnterEvent.target = enterTarget
  dragEnterEvent.currentTarget = enterTarget
  dragEnterEvent.originalEvent = {dataTransfer}

  [dragStartEvent, dragEnterEvent, dropEvent]

module.exports.buildExternalDropEvent = (filePaths, dropTarget) ->
  dataTransfer =
    data: {}
    setData: (key, value) -> @data[key] = "#{value}" # Drag events stringify data values
    getData: (key) -> @data[key]
    files: []

  dropEvent = $.Event()
  dropEvent.target = dropTarget
  dropEvent.currentTarget = dropTarget
  dropEvent.originalEvent = {dataTransfer}

  for filePath in filePaths
    dropEvent.originalEvent.dataTransfer.files.push({path: filePath})

  dropEvent

buildElementPositionalDragEvents = (el, dataTransfer) ->
  if not el?
    return {}
  $el = $(el)
  topEvent = $.Event()
  topEvent.target = el
  topEvent.currentTarget = el
  topEvent.originalEvent = {dataTransfer, pageY: $el.offset().top}

  middleEvent = $.Event()
  middleEvent.target = el
  middleEvent.currentTarget = el
  middleEvent.originalEvent = {dataTransfer, pageY: $el.offset().top + $el.height() * 0.5}

  bottomEvent = $.Event()
  bottomEvent.target = el
  bottomEvent.currentTarget = el
  bottomEvent.originalEvent = {dataTransfer, pageY: $el.offset().bottom}

  {top: topEvent, middle: middleEvent, bottom: bottomEvent}


module.exports.buildPositionalDragEvents = (dragged, target) ->
  dataTransfer =
    data: {}
    setData: (key, value) -> @data[key] = "#{value}" # Drag events stringify data values
    getData: (key) -> @data[key]
    setDragImage: (@image) -> return

  dragStartEvent = $.Event()
  dragStartEvent.target = dragged
  dragStartEvent.currentTarget = dragged
  dragStartEvent.originalEvent = {dataTransfer}

  dragEndEvent = $.Event()
  dragEndEvent.target = dragged
  dragEndEvent.currentTarget = dragged
  dragEndEvent.originalEvent = {dataTransfer}

  [dragStartEvent, buildElementPositionalDragEvents(target, dataTransfer), dragEndEvent]
