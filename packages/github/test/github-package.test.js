/** @babel */

import fs from 'fs'
import path from 'path'
import temp from 'temp'
import {cloneRepository, buildRepository} from './helpers'
import FilePatch from '../lib/models/file-patch'
import GithubPackage from '../lib/github-package'

describe('GithubPackage', () => {
  let atomEnv, workspace, project, commandRegistry, viewRegistry, notificationManager, githubPackage

  beforeEach(async () => {
    atomEnv = global.buildAtomEnvironment()
    workspace = atomEnv.workspace
    project = atomEnv.project
    commandRegistry = atomEnv.commands
    viewRegistry = atomEnv.views
    notificationManager = atomEnv.notifications
    githubPackage = new GithubPackage(workspace, project, commandRegistry, notificationManager)
  })

  afterEach(() => {
    atomEnv.destroy()
  })

  describe('activate', () => {
    it('updates the active repository', async () => {
      const workdirPath1 = await cloneRepository('three-files')
      const workdirPath2 = await cloneRepository('three-files')
      project.setPaths([workdirPath1, workdirPath2])
      fs.writeFileSync(path.join(workdirPath1, 'a.txt'), 'change 1', 'utf8')
      fs.writeFileSync(path.join(workdirPath1, 'b.txt'), 'change 2', 'utf8')

      await workspace.open(path.join(workdirPath1, 'a.txt'))
      await githubPackage.activate()
      assert.equal(githubPackage.getActiveRepository(), await githubPackage.repositoryForWorkdirPath(workdirPath1))
      assert.equal(githubPackage.gitPanelController.repository, githubPackage.getActiveRepository())
      assert.equal(githubPackage.changedFilesCountController.repository, githubPackage.getActiveRepository())
    })
  })

  describe('didChangeProjectPaths', () => {
    it('updates the active repository', async () => {
      const workdirPath1 = await cloneRepository('three-files')
      const workdirPath2 = await cloneRepository('three-files')
      project.setPaths([workdirPath1, workdirPath2])
      fs.writeFileSync(path.join(workdirPath1, 'a.txt'), 'change 1', 'utf8')

      await workspace.open(path.join(workdirPath1, 'a.txt'))
      await githubPackage.didChangeProjectPaths()
      assert.equal(githubPackage.getActiveRepository(), await githubPackage.repositoryForWorkdirPath(workdirPath1))
      assert.equal(githubPackage.gitPanelController.repository, githubPackage.getActiveRepository())
      assert.equal(githubPackage.changedFilesCountController.repository, githubPackage.getActiveRepository())

      project.setPaths([workdirPath2])
      await githubPackage.didChangeProjectPaths()
      assert.equal(githubPackage.getActiveRepository(), await githubPackage.repositoryForWorkdirPath(workdirPath2))
      assert.equal(githubPackage.gitPanelController.repository, githubPackage.getActiveRepository())
      assert.equal(githubPackage.changedFilesCountController.repository, githubPackage.getActiveRepository())
    })

    it('destroys all the repositories associated with the removed project folders', async () => {
      const workdirPath1 = await cloneRepository('three-files')
      const workdirPath2 = await cloneRepository('three-files')
      const workdirPath3 = await cloneRepository('three-files')
      project.setPaths([workdirPath1, workdirPath2, workdirPath3])

      const repository1 = await githubPackage.repositoryForWorkdirPath(workdirPath1)
      const repository2 = await githubPackage.repositoryForWorkdirPath(workdirPath2)
      const repository3 = await githubPackage.repositoryForWorkdirPath(workdirPath3)
      assert(repository1)
      assert(repository2)
      assert(repository3)

      project.removePath(workdirPath1)
      project.removePath(workdirPath3)
      githubPackage.didChangeProjectPaths()

      assert.notEqual(await githubPackage.repositoryForProjectDirectory(repository1.getWorkingDirectory()), repository1)
      assert.notEqual(await githubPackage.repositoryForProjectDirectory(repository3.getWorkingDirectory()), repository3)
      assert.equal(await githubPackage.repositoryForProjectDirectory(repository2.getWorkingDirectory()), repository2)
    })
  })

  describe('didChangeActivePaneItem', () => {
    it('updates the active repository', async () => {
      const workdirPath1 = await cloneRepository('three-files')
      const workdirPath2 = await cloneRepository('three-files')
      project.setPaths([workdirPath1, workdirPath2])
      fs.writeFileSync(path.join(workdirPath1, 'a.txt'), 'change 1', 'utf8')
      fs.writeFileSync(path.join(workdirPath2, 'b.txt'), 'change 2', 'utf8')

      await workspace.open(path.join(workdirPath1, 'a.txt'))
      await githubPackage.didChangeActivePaneItem()
      assert.equal(githubPackage.getActiveRepository(), await githubPackage.repositoryForWorkdirPath(workdirPath1))
      assert.equal(githubPackage.gitPanelController.repository, githubPackage.getActiveRepository())
      assert.equal(githubPackage.changedFilesCountController.repository, githubPackage.getActiveRepository())

      await workspace.open(path.join(workdirPath2, 'b.txt'))
      await githubPackage.didChangeActivePaneItem()
      assert.equal(githubPackage.getActiveRepository(), await githubPackage.repositoryForWorkdirPath(workdirPath2))
      assert.equal(githubPackage.gitPanelController.repository, githubPackage.getActiveRepository())
      assert.equal(githubPackage.changedFilesCountController.repository, githubPackage.getActiveRepository())
    })
  })

  describe('updateActiveRepository', () => {
    it('updates the active repository based on the most recent active item with a path unless its directory has been removed from the project', async () => {
      const workdirPath1 = await cloneRepository('three-files')
      const workdirPath2 = await cloneRepository('three-files')
      const nonRepositoryPath = temp.mkdirSync()
      fs.writeFileSync(path.join(nonRepositoryPath, 'c.txt'))
      project.setPaths([workdirPath1, workdirPath2, nonRepositoryPath])

      await workspace.open(path.join(workdirPath1, 'a.txt'))
      await workspace.open(path.join(workdirPath2, 'b.txt'))

      await githubPackage.updateActiveRepository()
      assert.equal(githubPackage.getActiveRepository(), await githubPackage.repositoryForWorkdirPath(workdirPath2))

      await workspace.open(path.join(workdirPath1, 'a.txt'))
      await githubPackage.updateActiveRepository()
      assert.equal(githubPackage.getActiveRepository(), await githubPackage.repositoryForWorkdirPath(workdirPath1))

      await workspace.open(path.join(workdirPath2, 'b.txt'))
      await githubPackage.updateActiveRepository()
      assert.equal(githubPackage.getActiveRepository(), await githubPackage.repositoryForWorkdirPath(workdirPath2))

      workspace.getActivePane().activateItem({})
      await githubPackage.updateActiveRepository()
      assert.equal(githubPackage.getActiveRepository(), await githubPackage.repositoryForWorkdirPath(workdirPath2))

      project.removePath(workdirPath2)
      await githubPackage.updateActiveRepository()
      assert.equal(githubPackage.getActiveRepository(), await githubPackage.repositoryForWorkdirPath(workdirPath1))

      project.removePath(workdirPath1)
      await githubPackage.updateActiveRepository()
      assert.isNull(githubPackage.getActiveRepository())

      await workspace.open(path.join(nonRepositoryPath, 'c.txt'))
      await githubPackage.updateActiveRepository()
      assert.isNull(githubPackage.getActiveRepository())
    })
  })

  describe('didSelectMergeConflictFile(filePath)', () => {
    it('opens the file as a pane item if it exsits', async () => {
      const workdirPath = await cloneRepository('merge-conflict')
      const repository = await buildRepository(workdirPath)
      githubPackage.getActiveRepository = function () { return repository }
      await githubPackage.gitPanelController.props.didSelectMergeConflictFile('added-to-both.txt')
      assert.equal(workspace.getActivePaneItem().getPath(), path.join(workdirPath, 'added-to-both.txt'))
    })

    describe('when the file doesn\'t exist', () => {
      it('shows an info notification and does not open the file', async () => {
        const workdirPath = await cloneRepository('merge-conflict')
        const repository = await buildRepository(workdirPath)
        githubPackage.getActiveRepository = function () { return repository }
        fs.unlinkSync(path.join(workdirPath, 'added-to-both.txt'))

        assert.equal(notificationManager.getNotifications().length, 0)
        await githubPackage.gitPanelController.props.didSelectMergeConflictFile('added-to-both.txt')
        assert.isUndefined(workspace.getActivePaneItem())
        assert.equal(notificationManager.getNotifications().length, 1)
      })
    })
  })

  describe('when a FilePatch is selected in the staging panel', () => {
    it('shows a FilePatchView for the selected patch as a pane item', async () => {
      const workdirPath = await cloneRepository('three-files')
      const repository = await buildRepository(workdirPath)

      githubPackage.getActiveRepository = function () { return repository }
      const filePatch1 = new FilePatch('a.txt', 'a.txt', 'modified', [])
      const filePatch2 = new FilePatch('b.txt', 'b.txt', 'modified', [])

      assert.isNull(githubPackage.filePatchController)

      githubPackage.gitPanelController.props.didSelectFilePatch(filePatch1, 'unstaged')
      assert(githubPackage.filePatchController)
      assert.equal(githubPackage.filePatchController.props.filePatch, filePatch1)
      assert.equal(githubPackage.filePatchController.props.repository, repository)
      assert.equal(githubPackage.filePatchController.props.stagingStatus, 'unstaged')
      assert.equal(workspace.getActivePaneItem(), githubPackage.filePatchController)

      const existingFilePatchView = githubPackage.filePatchController
      workspace.getActivePane().splitRight() // activate a different pane
      assert.isUndefined(workspace.getActivePaneItem())

      githubPackage.gitPanelController.props.didSelectFilePatch(filePatch2, 'staged')
      assert.equal(githubPackage.filePatchController, existingFilePatchView)
      assert.equal(githubPackage.filePatchController.props.filePatch, filePatch2)
      assert.equal(githubPackage.filePatchController.props.repository, repository)
      assert.equal(githubPackage.filePatchController.props.stagingStatus, 'staged')
      assert.equal(workspace.getActivePaneItem(), githubPackage.filePatchController)

      workspace.getActivePaneItem().destroy()
      assert.isUndefined(workspace.getActivePaneItem())
      assert.isNull(githubPackage.filePatchController)

      githubPackage.gitPanelController.props.didSelectFilePatch(filePatch2, 'staged')
      assert.notEqual(githubPackage.filePatchController, existingFilePatchView)
      assert.equal(githubPackage.filePatchController.props.filePatch, filePatch2)
      assert.equal(githubPackage.filePatchController.props.repository, repository)
      assert.equal(githubPackage.filePatchController.props.stagingStatus, 'staged')
      assert.equal(workspace.getActivePaneItem(), githubPackage.filePatchController)
    })
  })

  describe('when the changed files label in the status bar is clicked', () => {
    it('shows/hides the git panel', async () => {
      const workdirPath = await cloneRepository('three-files')
      project.setPaths([workdirPath])
      await workspace.open(path.join(workdirPath, 'a.txt'))

      githubPackage.changedFilesCountController.props.didClick()
      assert.equal(workspace.getRightPanels().length, 1)

      githubPackage.changedFilesCountController.props.didClick()
      assert.equal(workspace.getRightPanels().length, 0)

      githubPackage.changedFilesCountController.props.didClick()
      assert.equal(workspace.getRightPanels().length, 1)
    })
  })

  describe('when the git:toggle-git-panel command is dispatched', () => {
    it('shows/hides the git panel', async () => {
      const workspaceElement = viewRegistry.getView(workspace)
      const workdirPath = await cloneRepository('three-files')
      project.setPaths([workdirPath])
      await workspace.open(path.join(workdirPath, 'a.txt'))
      await githubPackage.activate()

      commandRegistry.dispatch(workspaceElement, 'git:toggle-git-panel')
      assert.equal(workspace.getRightPanels().length, 1)

      commandRegistry.dispatch(workspaceElement, 'git:toggle-git-panel')
      assert.equal(workspace.getRightPanels().length, 0)

      commandRegistry.dispatch(workspaceElement, 'git:toggle-git-panel')
      assert.equal(workspace.getRightPanels().length, 1)
    })
  })
})
