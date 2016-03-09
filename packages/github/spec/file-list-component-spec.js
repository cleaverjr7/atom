/** @babel */

import etch from 'etch'
import FileList from '../lib/file-list'
import FileListViewModel from '../lib/file-list-view-model'
import FileListComponent from '../lib/file-list-component'
import GitService from '../lib/git-service'
import {createFileDiffsFromPath, buildMouseEvent} from './helpers'

function createFileList (filePath, gitService) {
  let fileDiffs = createFileDiffsFromPath(filePath)
  let fileList = new FileList(fileDiffs, gitService)
  return new FileListViewModel(fileList)
}

describe('FileListComponent', function () {
  let viewModel, component, element, gitService

  function getFileElements () {
    return element.querySelectorAll('.file-summary')
  }

  function getFileElement (index) {
    return getFileElements()[index]
  }

  beforeEach(function () {
    gitService = new GitService(atom.project.getRepositories()[0])
    viewModel = createFileList('fixtures/two-file-diff.txt', gitService)
    component = new FileListComponent({fileListViewModel: viewModel})
    element = component.element
    jasmine.attachToDOM(component.element)
    spyOn(etch, 'update').andCallFake((component) => {
      return etch.updateSync(component)
    })
  })

  it('renders correctly', function () {
    let fileElements = getFileElements()
    expect(fileElements).toHaveLength(2)
    expect(fileElements[0]).toHaveClass('selected')
    expect(fileElements[1]).not.toHaveClass('selected')
  })

  describe('keyboard selection of files', function () {
    it('arrows through the list with core move commands', function () {
      expect(getFileElement(0)).toHaveClass('selected')

      atom.commands.dispatch(element, 'core:move-down')
      expect(getFileElement(1)).toHaveClass('selected')

      atom.commands.dispatch(element, 'core:move-up')
      expect(getFileElement(0)).toHaveClass('selected')
    })
  })

  describe('keyboard staging of files', function () {
    it('toggle stagedness on core:confirm', () => {
      expect(viewModel.getSelectedFile().getStageStatus()).toBe('unstaged')

      atom.commands.dispatch(element, 'core:confirm')
      expect(viewModel.getSelectedFile().getStageStatus()).toBe('staged')

      atom.commands.dispatch(element, 'core:confirm')
      expect(viewModel.getSelectedFile().getStageStatus()).toBe('unstaged')
    })
  })

  describe('mouse clicks', () => {
    const expectedURI = 'atom://git/diff/src/config.coffee'

    it("displays the file's diff in the pending state on single click", () => {
      spyOn(atom.workspace, 'open')

      const element = getFileElement(0)
      element.dispatchEvent(buildMouseEvent('click', {target: element}))

      const args = atom.workspace.open.mostRecentCall.args
      const uri = args[0]
      const options = args[1]
      expect(options.pending).toBe(true)
      expect(uri).toBe(expectedURI)
    })

    it("displays the file's diff in the normal state on double click", () => {
      spyOn(atom.workspace, 'open')

      const element = getFileElement(0)
      element.dispatchEvent(buildMouseEvent('dblclick', {target: element}))

      const args = atom.workspace.open.mostRecentCall.args
      const uri = args[0]
      const options = args[1]
      expect(options.pending).toBe(false)
      expect(uri).toBe(expectedURI)
    })
  })
})
