/** @babel */

import path from 'path'
import fs from 'fs-plus'
import DiffSelection from '../lib/diff-selection'
import DiffViewModel from '../lib/diff-view-model'
import {it, beforeEach} from './async-spec-helpers'
import {createDiffViewModel, createFileListViewModel} from './helpers'

function createDiffs () {
  return createDiffViewModel('src/config.coffee', 'dummy-atom')
}

function expectHunkToBeSelected (isSelected, viewModel, fileDiffIndex, diffHunkIndex) {
  let lines = viewModel.getFileDiffs()[fileDiffIndex].getHunks()[diffHunkIndex].getLines()
  for (var i = 0; i < lines.length; i++) {
    expect(viewModel.isLineSelected(fileDiffIndex, diffHunkIndex, i)).toBe(isSelected)
  }
}

function expectLineToBeSelected (isSelected, viewModel, fileDiffIndex, diffHunkIndex, hunkLineIndex) {
  expect(viewModel.isLineSelected(fileDiffIndex, diffHunkIndex, hunkLineIndex)).toBe(isSelected)
}

describe('DiffViewModel', function () {
  let viewModel

  describe('selecting diffs', function () {
    beforeEach(async () => {
      viewModel = await createDiffs()
    })

    it('initially selects the first hunk', function () {
      expectHunkToBeSelected(true, viewModel, 0, 0)
      expectHunkToBeSelected(false, viewModel, 0, 1)
      expectHunkToBeSelected(false, viewModel, 0, 2)
    })

    describe('selecting hunks', function () {
      describe('::moveSelectionDown()', function () {
        it('selects the next hunk until the end is reached, then stops', function () {
          viewModel.moveSelectionDown()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectHunkToBeSelected(true, viewModel, 0, 1)
          expectHunkToBeSelected(false, viewModel, 0, 2)

          viewModel.moveSelectionDown()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectHunkToBeSelected(false, viewModel, 0, 1)
          expectHunkToBeSelected(true, viewModel, 0, 2)

          viewModel.moveSelectionDown()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectHunkToBeSelected(false, viewModel, 0, 1)
          expectHunkToBeSelected(true, viewModel, 0, 2)
        })
      })

      describe('::moveSelectionUp()', function () {
        it('selects the previous hunk until the end is reached, then stops', function () {
          viewModel.moveSelectionDown()
          viewModel.moveSelectionDown()
          viewModel.moveSelectionDown()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectHunkToBeSelected(false, viewModel, 0, 1)
          expectHunkToBeSelected(true, viewModel, 0, 2)

          viewModel.moveSelectionUp()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectHunkToBeSelected(true, viewModel, 0, 1)
          expectHunkToBeSelected(false, viewModel, 0, 2)

          viewModel.moveSelectionUp()
          expectHunkToBeSelected(true, viewModel, 0, 0)
          expectHunkToBeSelected(false, viewModel, 0, 1)
          expectHunkToBeSelected(false, viewModel, 0, 2)

          viewModel.moveSelectionUp()
          expectHunkToBeSelected(true, viewModel, 0, 0)
          expectHunkToBeSelected(false, viewModel, 0, 1)
          expectHunkToBeSelected(false, viewModel, 0, 2)
        })
      })

      describe('::expandSelectionUp() and ::expandSelectionDown()', function () {
        it('selects the next hunk until the end is reached, then stops', function () {
          viewModel.moveSelectionDown()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectHunkToBeSelected(true, viewModel, 0, 1)
          expectHunkToBeSelected(false, viewModel, 0, 2)

          viewModel.expandSelectionDown()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectHunkToBeSelected(true, viewModel, 0, 1)
          expectHunkToBeSelected(true, viewModel, 0, 2)

          viewModel.expandSelectionDown()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectHunkToBeSelected(true, viewModel, 0, 1)
          expectHunkToBeSelected(true, viewModel, 0, 2)

          viewModel.expandSelectionUp()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectHunkToBeSelected(true, viewModel, 0, 1)
          expectHunkToBeSelected(false, viewModel, 0, 2)

          viewModel.expandSelectionUp()
          expectHunkToBeSelected(true, viewModel, 0, 0)
          expectHunkToBeSelected(true, viewModel, 0, 1)
          expectHunkToBeSelected(false, viewModel, 0, 2)

          viewModel.expandSelectionUp()
          expectHunkToBeSelected(true, viewModel, 0, 0)
          expectHunkToBeSelected(true, viewModel, 0, 1)
          expectHunkToBeSelected(false, viewModel, 0, 2)

          viewModel.moveSelectionDown()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectHunkToBeSelected(false, viewModel, 0, 1)
          expectHunkToBeSelected(true, viewModel, 0, 2)
        })
      })
    })

    describe('switching between hunk and line selection', function () {
      it('selects the first changed line in a hunk when one hunk is selected', function () {
        expectHunkToBeSelected(true, viewModel, 0, 0)

        viewModel.setSelectionMode('line')
        expectLineToBeSelected(false, viewModel, 0, 0, 0)
        expectLineToBeSelected(false, viewModel, 0, 0, 1)
        expectLineToBeSelected(false, viewModel, 0, 0, 2)
        expectLineToBeSelected(true, viewModel, 0, 0, 3)
        expectLineToBeSelected(false, viewModel, 0, 0, 4)
      })
    })

    describe('selecting lines', function () {
      beforeEach(function () {
        viewModel.setSelectionMode('line')
      })

      describe('::moveSelectionDown()', function () {
        it('selects next changed line in a hunk', function () {
          expectLineToBeSelected(false, viewModel, 0, 0, 2)
          expectLineToBeSelected(true, viewModel, 0, 0, 3)
          expectLineToBeSelected(false, viewModel, 0, 0, 4)

          viewModel.moveSelectionDown()
          expectLineToBeSelected(false, viewModel, 0, 0, 2)
          expectLineToBeSelected(false, viewModel, 0, 0, 3)
          expectLineToBeSelected(true, viewModel, 0, 0, 4)
          expectLineToBeSelected(false, viewModel, 0, 0, 5)
          expectLineToBeSelected(false, viewModel, 0, 0, 6)

          viewModel.moveSelectionDown()
          expectLineToBeSelected(false, viewModel, 0, 0, 2)
          expectLineToBeSelected(false, viewModel, 0, 0, 3)
          expectLineToBeSelected(false, viewModel, 0, 0, 4)
          expectLineToBeSelected(true, viewModel, 0, 0, 5)
          expectLineToBeSelected(false, viewModel, 0, 0, 6)

          viewModel.moveSelectionDown()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectLineToBeSelected(false, viewModel, 0, 1, 0)
          expectLineToBeSelected(false, viewModel, 0, 1, 2)
          expectLineToBeSelected(true, viewModel, 0, 1, 3)
          expectLineToBeSelected(false, viewModel, 0, 1, 4)
          expectLineToBeSelected(false, viewModel, 0, 1, 5)

          viewModel.moveSelectionDown()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectLineToBeSelected(false, viewModel, 0, 1, 0)
          expectLineToBeSelected(false, viewModel, 0, 1, 2)
          expectLineToBeSelected(false, viewModel, 0, 1, 3)
          expectLineToBeSelected(true, viewModel, 0, 1, 4)
          expectLineToBeSelected(false, viewModel, 0, 1, 5)
        })

        it('moves to the bottom of a multi-select', function () {
          viewModel.moveSelectionDown()
          viewModel.expandSelectionUp()
          expectLineToBeSelected(true, viewModel, 0, 0, 3)
          expectLineToBeSelected(true, viewModel, 0, 0, 4)
          expectLineToBeSelected(false, viewModel, 0, 0, 5)

          viewModel.moveSelectionDown()
          expectLineToBeSelected(false, viewModel, 0, 0, 3)
          expectLineToBeSelected(false, viewModel, 0, 0, 4)
          expectLineToBeSelected(true, viewModel, 0, 0, 5)
        })
      })

      describe('::moveSelectionUp()', function () {
        it('selects previous changed line in a hunk', function () {
          expectLineToBeSelected(false, viewModel, 0, 0, 2)
          expectLineToBeSelected(true, viewModel, 0, 0, 3)
          expectLineToBeSelected(false, viewModel, 0, 0, 4)

          viewModel.moveSelectionDown()
          viewModel.moveSelectionDown()
          viewModel.moveSelectionDown()
          viewModel.moveSelectionDown()
          viewModel.moveSelectionDown()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectLineToBeSelected(false, viewModel, 0, 1, 0)
          expectLineToBeSelected(false, viewModel, 0, 1, 2)
          expectLineToBeSelected(false, viewModel, 0, 1, 3)
          expectLineToBeSelected(false, viewModel, 0, 1, 4)
          expectLineToBeSelected(true, viewModel, 0, 1, 5)
          expectLineToBeSelected(false, viewModel, 0, 1, 6)

          viewModel.moveSelectionUp()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectLineToBeSelected(false, viewModel, 0, 1, 0)
          expectLineToBeSelected(false, viewModel, 0, 1, 2)
          expectLineToBeSelected(false, viewModel, 0, 1, 3)
          expectLineToBeSelected(true, viewModel, 0, 1, 4)
          expectLineToBeSelected(false, viewModel, 0, 1, 5)
          expectLineToBeSelected(false, viewModel, 0, 1, 6)

          viewModel.moveSelectionUp()
          expectHunkToBeSelected(false, viewModel, 0, 0)
          expectLineToBeSelected(false, viewModel, 0, 1, 0)
          expectLineToBeSelected(false, viewModel, 0, 1, 2)
          expectLineToBeSelected(true, viewModel, 0, 1, 3)
          expectLineToBeSelected(false, viewModel, 0, 1, 4)
          expectLineToBeSelected(false, viewModel, 0, 1, 5)
          expectLineToBeSelected(false, viewModel, 0, 1, 6)

          viewModel.moveSelectionUp()
          expectLineToBeSelected(false, viewModel, 0, 0, 0)
          expectLineToBeSelected(false, viewModel, 0, 0, 2)
          expectLineToBeSelected(false, viewModel, 0, 0, 3)
          expectLineToBeSelected(false, viewModel, 0, 0, 4)
          expectLineToBeSelected(true, viewModel, 0, 0, 5)
          expectLineToBeSelected(false, viewModel, 0, 0, 6)
          expectHunkToBeSelected(false, viewModel, 0, 1)
        })

        it('moves to the top of a multi-select', function () {
          viewModel.moveSelectionDown()
          viewModel.expandSelectionDown()
          expectLineToBeSelected(false, viewModel, 0, 0, 3)
          expectLineToBeSelected(true, viewModel, 0, 0, 4)
          expectLineToBeSelected(true, viewModel, 0, 0, 5)

          viewModel.moveSelectionUp()
          expectLineToBeSelected(true, viewModel, 0, 0, 3)
          expectLineToBeSelected(false, viewModel, 0, 0, 4)
          expectLineToBeSelected(false, viewModel, 0, 0, 5)
        })
      })

      describe('::expandSelectionDown()', function () {
        it('selects previous changed line in a hunk', function () {
          expectLineToBeSelected(true, viewModel, 0, 0, 3)
          expectLineToBeSelected(false, viewModel, 0, 0, 4)

          viewModel.expandSelectionDown()
          expectLineToBeSelected(true, viewModel, 0, 0, 3)
          expectLineToBeSelected(true, viewModel, 0, 0, 4)
          expectLineToBeSelected(false, viewModel, 0, 0, 5)

          viewModel.expandSelectionDown()
          expectLineToBeSelected(true, viewModel, 0, 0, 3)
          expectLineToBeSelected(true, viewModel, 0, 0, 4)
          expectLineToBeSelected(true, viewModel, 0, 0, 5)

          viewModel.expandSelectionDown()
          viewModel.expandSelectionDown()
          viewModel.expandSelectionDown()
          expectLineToBeSelected(true, viewModel, 0, 0, 3)
          expectLineToBeSelected(true, viewModel, 0, 0, 4)
          expectLineToBeSelected(true, viewModel, 0, 0, 5)
          expectLineToBeSelected(false, viewModel, 0, 0, 6)

          expectLineToBeSelected(false, viewModel, 0, 1, 0)
          expectLineToBeSelected(false, viewModel, 0, 1, 1)
          expectLineToBeSelected(false, viewModel, 0, 1, 2)
          expectLineToBeSelected(true, viewModel, 0, 1, 3)
          expectLineToBeSelected(true, viewModel, 0, 1, 4)
          expectLineToBeSelected(true, viewModel, 0, 1, 5)
          expectLineToBeSelected(false, viewModel, 0, 1, 6)
        })
      })

      describe('::expandSelectionUp()', function () {
        it('selects previous changed line in a hunk', function () {
          viewModel.moveSelectionDown()
          viewModel.moveSelectionDown()
          viewModel.moveSelectionDown()
          viewModel.moveSelectionDown()
          expectLineToBeSelected(false, viewModel, 0, 1, 3)
          expectLineToBeSelected(true, viewModel, 0, 1, 4)
          expectLineToBeSelected(false, viewModel, 0, 1, 5)

          viewModel.expandSelectionUp()
          expectLineToBeSelected(true, viewModel, 0, 1, 3)
          expectLineToBeSelected(true, viewModel, 0, 1, 4)
          expectLineToBeSelected(false, viewModel, 0, 1, 5)

          viewModel.expandSelectionUp()
          expectLineToBeSelected(false, viewModel, 0, 0, 3)
          expectLineToBeSelected(false, viewModel, 0, 0, 4)
          expectLineToBeSelected(true, viewModel, 0, 0, 5)
          expectLineToBeSelected(true, viewModel, 0, 1, 3)
          expectLineToBeSelected(true, viewModel, 0, 1, 4)
          expectLineToBeSelected(false, viewModel, 0, 1, 5)

          viewModel.expandSelectionUp()
          expectLineToBeSelected(false, viewModel, 0, 0, 3)
          expectLineToBeSelected(true, viewModel, 0, 0, 4)
          expectLineToBeSelected(true, viewModel, 0, 0, 5)
          expectLineToBeSelected(true, viewModel, 0, 1, 3)
          expectLineToBeSelected(true, viewModel, 0, 1, 4)
          expectLineToBeSelected(false, viewModel, 0, 1, 5)

          viewModel.expandSelectionUp()
          viewModel.expandSelectionUp()
          viewModel.expandSelectionUp()
          expectLineToBeSelected(false, viewModel, 0, 0, 2)
          expectLineToBeSelected(true, viewModel, 0, 0, 3)
          expectLineToBeSelected(true, viewModel, 0, 0, 4)
          expectLineToBeSelected(true, viewModel, 0, 0, 5)
          expectLineToBeSelected(true, viewModel, 0, 1, 3)
          expectLineToBeSelected(true, viewModel, 0, 1, 4)
          expectLineToBeSelected(false, viewModel, 0, 1, 5)
        })
      })
    })

    describe('::setSelection()', function () {
      it('updates the model when the selection is set', function () {
        let selection = new DiffSelection(viewModel, {
          mode: 'line',
          headPosition: [0, 1, 2],
          tailPosition: [0, 1, 4]
        })
        viewModel.setSelection(selection)

        expect(viewModel.getSelectionMode()).toBe('hunk')
        expectLineToBeSelected(false, viewModel, 0, 0, 3)
        expectLineToBeSelected(false, viewModel, 0, 0, 4)
        expectLineToBeSelected(false, viewModel, 0, 1, 2)
        expectLineToBeSelected(true, viewModel, 0, 1, 3)
        expectLineToBeSelected(true, viewModel, 0, 1, 4)
        expectLineToBeSelected(false, viewModel, 0, 1, 5)
      })
    })

    describe('::addSelection()', function () {
      it('updates the model when the selection is added', function () {
        let selection = new DiffSelection(viewModel, {
          mode: 'line',
          headPosition: [0, 1, 2],
          tailPosition: [0, 1, 4]
        })
        viewModel.setSelection(selection)

        selection = new DiffSelection(viewModel, {
          mode: 'line',
          headPosition: [0, 0, 2],
          tailPosition: [0, 0, 4]
        })
        viewModel.addSelection(selection)

        expect(viewModel.getSelectionMode()).toBe('hunk')
        expectLineToBeSelected(false, viewModel, 0, 0, 2)
        expectLineToBeSelected(true, viewModel, 0, 0, 3)
        expectLineToBeSelected(true, viewModel, 0, 0, 4)
        expectLineToBeSelected(false, viewModel, 0, 0, 5)
        expectLineToBeSelected(false, viewModel, 0, 1, 2)
        expectLineToBeSelected(true, viewModel, 0, 1, 3)
        expectLineToBeSelected(true, viewModel, 0, 1, 4)
        expectLineToBeSelected(false, viewModel, 0, 1, 5)
      })
    })

    describe('modifying the selection after adding custom selections', function () {
      let selection1, selection2
      beforeEach(function () {
        selection1 = new DiffSelection(viewModel, {
          mode: 'line',
          headPosition: [0, 1, 5],
          tailPosition: [0, 1, 4]
        })
        selection2 = new DiffSelection(viewModel, {
          mode: 'line',
          headPosition: [0, 2, 4],
          tailPosition: [0, 2, 5]
        })
      })

      it('stays in hunk mode when ::moveSelectionUp() is called in hunk mode', function () {
        viewModel.setSelectionMode('hunk')
        viewModel.setSelection(selection1)

        viewModel.moveSelectionUp()
        expectHunkToBeSelected(true, viewModel, 0, 0)
        expectHunkToBeSelected(false, viewModel, 0, 1)
        expectHunkToBeSelected(false, viewModel, 0, 2)
      })

      it('selects above the top selection when ::moveSelectionUp() is called in hunk mode', function () {
        viewModel.setSelectionMode('hunk')
        viewModel.setSelection(selection1)
        viewModel.addSelection(selection2)

        viewModel.moveSelectionUp()
        expectHunkToBeSelected(true, viewModel, 0, 0)
        expectHunkToBeSelected(false, viewModel, 0, 1)
        expectHunkToBeSelected(false, viewModel, 0, 2)
      })

      it('selects below the bottom selection when ::moveSelectionDown() is called in hunk mode', function () {
        viewModel.setSelectionMode('hunk')
        viewModel.setSelection(selection1)
        viewModel.addSelection(selection2)

        viewModel.moveSelectionDown()
        expectHunkToBeSelected(false, viewModel, 0, 0)
        expectHunkToBeSelected(false, viewModel, 0, 1)
        expectHunkToBeSelected(true, viewModel, 0, 2)
      })

      it('keeps the last selection when ::toggleSelectionMode() is called', function () {
        viewModel.setSelectionMode('hunk')
        viewModel.setSelection(selection1)
        viewModel.addSelection(selection2)

        viewModel.toggleSelectionMode()
        expect(viewModel.getSelectionMode()).toBe('line')
        expectLineToBeSelected(false, viewModel, 0, 1, 4)
        expectLineToBeSelected(true, viewModel, 0, 2, 4)
      })
    })
  })

  describe('opening the selected file', function () {
    beforeEach(async () => {
      viewModel = await createDiffs()
      spyOn(atom.workspace, 'open')
    })

    it('opens the file to the first line in the selected hunk when in hunk mode and ::openFileAtSelection() is called', function () {
      viewModel.moveSelectionDown()

      viewModel.openFileAtSelection()
      expect(atom.workspace.open).toHaveBeenCalled()
      const args = atom.workspace.open.mostRecentCall.args
      expect(args[0]).toBe('src/config.coffee')
      expect(args[1]).toEqual({initialLine: 440})
    })

    it('opens the file to the first selected line in line mode when ::openFileAtSelection() is called', function () {
      let selection = new DiffSelection(viewModel, {
        mode: 'line',
        headPosition: [0, 2, 4],
        tailPosition: [0, 2, 5]
      })
      viewModel.setSelection(selection)

      viewModel.openFileAtSelection()
      expect(atom.workspace.open).toHaveBeenCalled()
      const args = atom.workspace.open.mostRecentCall.args
      expect(args[0]).toBe('src/config.coffee')
      expect(args[1]).toEqual({initialLine: 554})
    })
  })

  describe('staging', () => {
    let fileListViewModel
    let gitStore
    let filePath
    let repoPath
    let toggleAll
    let refresh
    let expectStatus

    beforeEach(async () => {
      fileListViewModel = await createFileListViewModel('dummy-atom')
      gitStore = fileListViewModel.gitStore

      viewModel = new DiffViewModel({pathName: 'src/config.coffee', fileListViewModel, gitStore})

      repoPath = gitStore.gitService.repoPath
      filePath = path.join(repoPath, 'src/config.coffee')

      toggleAll = async () => {
        let selection = new DiffSelection(viewModel, {
          mode: 'hunk',
          headPosition: [0, 0],
          tailPosition: [0, 0]
        })
        viewModel.setSelection(selection)
        await viewModel.toggleSelectedLinesStageStatus()
      }

      refresh = async () => {
        await viewModel.fileListViewModel.getGitStore().loadFromGit()
      }

      expectStatus = (expectedStatus) => {
        expect(viewModel.getFileDiff().getStageStatus()).toBe(expectedStatus)
      }
    })

    describe('.stage()/.unstage()', () => {
      it('stages/unstages the entirety of a modified file', async () => {
        fs.writeFileSync(filePath, "oh the files, they are a'changin'")

        await refresh()
        expectStatus('unstaged')

        await toggleAll()
        await refresh()
        expectStatus('staged')

        await toggleAll()
        await refresh()
        expectStatus('unstaged')
      })

      it('stages/unstages the entirety of a modified file that ends in a newline', async () => {
        fs.writeFileSync(filePath, "oh the files, they are a'changin'\n")

        await refresh()
        expectStatus('unstaged')

        await toggleAll()
        await refresh()
        expectStatus('staged')

        await toggleAll()
        await refresh()
        expectStatus('unstaged')
      })

      it('stages/unstages the entirety of a deleted file', async () => {
        fs.removeSync(filePath)

        await refresh()
        expectStatus('unstaged')

        await toggleAll()
        await refresh()
        expectStatus('staged')

        await toggleAll()
        await refresh()
        expectStatus('unstaged')
      })

      it('stages/unstages the entirety of a new file', async () => {
        const newFileName = 'REAMDE.md'
        const newFilePath = path.join(repoPath, newFileName)
        fs.writeFileSync(newFilePath, 'a whole new world')

        viewModel = new DiffViewModel({pathName: newFileName, fileListViewModel, gitStore})

        await refresh()
        expectStatus('unstaged')

        await toggleAll()
        await refresh()
        expectStatus('staged')

        await toggleAll()
        await refresh()
        expectStatus('unstaged')
      })

      it('stages/unstages the entirety of a new file that ends in a newline', async () => {
        const newFileName = 'REAMDE.md'
        const newFilePath = path.join(repoPath, newFileName)
        fs.writeFileSync(newFilePath, 'a whole new world\na new fantastic POV\n')

        viewModel = new DiffViewModel({pathName: newFileName, fileListViewModel, gitStore})

        await refresh()
        expectStatus('unstaged')

        await toggleAll()
        await refresh()
        expectStatus('staged')

        await toggleAll()
        await refresh()
        expectStatus('unstaged')
      })
    })
  })
})
