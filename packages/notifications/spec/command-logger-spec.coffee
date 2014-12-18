# Originally from lee-dohm/bug-report

CommandLogger = require '../lib/command-logger'

describe 'CommandLogger', ->
  [workspaceElement, logger] = []

  dispatch = (command) ->
    atom.commands.dispatch(workspaceElement, command)

  beforeEach ->
    workspaceElement = atom.views.getView(atom.workspace)
    logger = new CommandLogger

  describe 'logging of commands', ->
    it 'catches the name of the command', ->
      dispatch('foo:bar')
      expect(logger.latestEvent().name).toBe 'foo:bar'

    it 'catches the source of the command', ->
      dispatch('foo:bar')

      expect(logger.latestEvent().source).toBeDefined()

    it 'logs repeat commands as one command', ->
      dispatch('foo:bar')
      dispatch('foo:bar')

      expect(logger.latestEvent().name).toBe 'foo:bar'
      expect(logger.latestEvent().count).toBe 2

    it 'ignores show.bs.tooltip commands', ->
      dispatch('show.bs.tooltip')

      expect(logger.latestEvent().name).not.toBe 'show.bs.tooltip'

    it 'ignores editor:display-updated commands', ->
      dispatch('editor:display-updated')

      expect(logger.latestEvent().name).not.toBe 'editor:display-updated'

    it 'ignores mousewheel commands', ->
      dispatch('mousewheel')

      expect(logger.latestEvent().name).not.toBe 'mousewheel'

    it 'only logs up to `logSize` commands', ->
      dispatch(char) for char in ['a'..'z']

      expect(logger.eventLog.length).toBe(logger.logSize)

  describe 'formatting of text log', ->
    it 'does not output empty log items', ->
      expect(logger.getText()).toBe """
        ```
        ```
      """

    it 'formats commands with the time, name and source', ->
      atom.commands.dispatch(workspaceElement, 'foo:bar')

      expect(logger.getText()).toBe """
        ```
             -0:00.0 foo:bar (atom-workspace.workspace.scrollbars-visible-when-scrolling)
        ```
      """

    it 'formats commands in chronological order', ->
      dispatch('foo:first')
      dispatch('foo:second')
      dispatch('foo:third')

      expect(logger.getText()).toBe """
        ```
             -0:00.0 foo:first (atom-workspace.workspace.scrollbars-visible-when-scrolling)
             -0:00.0 foo:second (atom-workspace.workspace.scrollbars-visible-when-scrolling)
             -0:00.0 foo:third (atom-workspace.workspace.scrollbars-visible-when-scrolling)
        ```
      """

    it 'displays a multiplier for repeated commands', ->
      dispatch('foo:bar')
      dispatch('foo:bar')

      expect(logger.getText()).toBe """
        ```
          2x -0:00.0 foo:bar (atom-workspace.workspace.scrollbars-visible-when-scrolling)
        ```
      """

    it 'empties the log after `getText()` is called', ->
      dispatch('foo:bar')
      logger.getText()

      for i in [0...logger.logSize]
        event = logger.eventLog[i]
        expect(event.name).toBeNull()
        expect(event.count).toBe 0
        expect(event.time).toBeNull()

    it 'logs the external data event as the last event', ->
      dispatch('foo:bar')
      event =
        time: Date.now()
        title: 'bummer'

      expect(logger.getText(event)).toBe """
        ```
             -0:00.0 foo:bar (atom-workspace.workspace.scrollbars-visible-when-scrolling)
             -0:00.0 bummer
        ```
      """

    it 'does not report anything after the external data event', ->
      event =
        time: Date.now() - 10 * 1000
        title: 'bummer'
      dispatch('foo:bar')

      expect(logger.getText(event)).toBe """
        ```
             -0:00.0 bummer
        ```
      """

    it 'does not report anything older than ten minutes', ->
      dispatch('foo:bar')
      event =
        time: Date.now() + 11 * 60 * 1000
        title: 'bummer'

      expect(logger.getText(event)).toBe """
        ```
             -0:00.0 bummer
        ```
      """

    it 'does not report commands that have no name', ->
      dispatch('')

      expect(logger.getText()).toBe """
        ```
        ```
      """
