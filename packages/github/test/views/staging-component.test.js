/** @babel */

import {copyRepositoryDir, buildRepository} from '../helpers'
import path from 'path'
import fs from 'fs'
import sinon from 'sinon'

import StagingComponent, {ListTypes} from '../../lib/views/staging-component'

const getSelectedItemForStagedList = (component) => {
  return component.multiList.getSelectedItemForList(1)
}

const getSelectedItemForUnstagedList = (component) => {
  return component.multiList.getSelectedItemForList(0)
}

describe('StagingComponent', () => {
  it('only renders the change lists when their data is loaded', async () => {
    const workdirPath = await copyRepositoryDir(1)
    const repository = await buildRepository(workdirPath)
    const component = new StagingComponent({repository})

    assert.isUndefined(component.refs.stagedChangesComponent)
    assert.isUndefined(component.refs.unstagedChangesComponent)

    await component.lastModelDataRefreshPromise

    assert(component.refs.stagedChangesComponent)
    assert(component.refs.unstagedChangesComponent)
  })

  describe('staging and unstaging files', () => {
    it('stages and unstages files', async () => {
      const workdirPath = await copyRepositoryDir(1)
      const repository = await buildRepository(workdirPath)
      fs.writeFileSync(path.join(workdirPath, 'a.txt'), 'a change\n')
      fs.unlinkSync(path.join(workdirPath, 'b.txt'))
      const component = new StagingComponent({repository})
      await component.lastModelDataRefreshPromise

      const {stagedChangesComponent, unstagedChangesComponent} = component.refs
      const filePatches = unstagedChangesComponent.filePatches

      await unstagedChangesComponent.didConfirmFilePatch(filePatches[1])
      await component.lastModelDataRefreshPromise

      assert.deepEqual(unstagedChangesComponent.filePatches, [filePatches[0]])
      assert.deepEqual(stagedChangesComponent.filePatches, [filePatches[1]])

      await stagedChangesComponent.didConfirmFilePatch(filePatches[1])
      await component.lastModelDataRefreshPromise

      assert.deepEqual(unstagedChangesComponent.filePatches, filePatches)
      assert.deepEqual(stagedChangesComponent.filePatches, [])
    })

    describe('didConfirmSelectedFilePatch()', () => {
      it('stages and unstages files, updating lists accordingly', async () => {
        const workdirPath = await copyRepositoryDir(1)
        const repository = await buildRepository(workdirPath)
        fs.writeFileSync(path.join(workdirPath, 'a.txt'), 'a change\n')
        fs.unlinkSync(path.join(workdirPath, 'b.txt'))
        const component = new StagingComponent({repository})
        await component.lastModelDataRefreshPromise

        const {stagedChangesComponent, unstagedChangesComponent} = component.refs
        const filePatches = unstagedChangesComponent.filePatches

        unstagedChangesComponent.didSelectFilePatch(filePatches[1])
        await component.didConfirmSelectedFilePatch()
        await component.lastModelDataRefreshPromise

        assert.deepEqual(unstagedChangesComponent.filePatches, [filePatches[0]])
        assert.deepEqual(stagedChangesComponent.filePatches, [filePatches[1]])

        // QUESITON: why do these not have reference equality
        // console.log(filePatches[1], stagedChangesComponent.filePatches[0], filePatches[1] === stagedChangesComponent.filePatches[0])
        stagedChangesComponent.didSelectFilePatch(stagedChangesComponent.filePatches[0])
        await component.didConfirmSelectedFilePatch()
        await component.lastModelDataRefreshPromise

        assert.deepEqual(unstagedChangesComponent.filePatches, filePatches)
        assert.deepEqual(stagedChangesComponent.filePatches, [])
      })
    })
  })

  describe('focusing lists', () => {
    describe('when lists are not empty', () => {
      let component
      beforeEach(async () => {
        const workdirPath = await copyRepositoryDir(1)
        const repository = await buildRepository(workdirPath)
        fs.writeFileSync(path.join(workdirPath, 'a.txt'), 'a change\n')
        fs.unlinkSync(path.join(workdirPath, 'b.txt'))
        component = new StagingComponent({repository})
        await component.lastModelDataRefreshPromise

        const {stagedChangesComponent, unstagedChangesComponent} = component.refs
        const initialUnstagedFilePatches = unstagedChangesComponent.filePatches

        // Create three staged files, leaving three unstaged
        await unstagedChangesComponent.didConfirmFilePatch(initialUnstagedFilePatches[0])
        await component.lastModelDataRefreshPromise

        assert.equal(stagedChangesComponent.filePatches.length, 1)
        assert.equal(unstagedChangesComponent.filePatches.length, 1)
      })

      it('focuses staged and unstaged lists accordingly', async () => {
        await component.selectList(ListTypes.STAGED)
        assert.equal(component.getSelectedList(), ListTypes.STAGED)
        let selectedLists = component.element.querySelectorAll('.git-Panel-item.is-focused .is-header')
        assert.equal(selectedLists.length, 1)
        assert.equal(selectedLists[0].textContent, 'Staged Changes')

        await component.selectList(ListTypes.UNSTAGED)
        assert.equal(component.getSelectedList(), ListTypes.UNSTAGED)
        selectedLists = component.element.querySelectorAll('.git-Panel-item.is-focused .is-header')
        assert.equal(selectedLists.length, 1)
        assert.equal(selectedLists[0].textContent, 'Unstaged Changes')

        await component.selectList(ListTypes.STAGED)
        assert.equal(component.getSelectedList(), ListTypes.STAGED)
        selectedLists = component.element.querySelectorAll('.git-Panel-item.is-focused .is-header')
        assert.equal(selectedLists.length, 1)
        assert.equal(selectedLists[0].textContent, 'Staged Changes')
      })

      describe('git:focus-unstaged-changes', () => {
        it('sets the unstaged list to be focused', () => {
          component.selectList(ListTypes.STAGED)
          assert.equal(component.getSelectedList(), ListTypes.STAGED)

          atom.commands.dispatch(component.element, 'git:focus-unstaged-changes')
          assert.equal(component.getSelectedList(), ListTypes.UNSTAGED)
        })
      })

      describe('git:focus-staged-changes', () => {
        it('sets the unstaged list to be focused', () => {
          component.selectList(ListTypes.UNSTAGED)
          assert.equal(component.getSelectedList(), ListTypes.UNSTAGED)

          atom.commands.dispatch(component.element, 'git:focus-staged-changes')
          assert.equal(component.getSelectedList(), ListTypes.STAGED)
        })
      })
    })
  })

  describe('selecting files', () => {
    describe('core:move-up and core:move-down', () => {
      let component, unstagedFilePatches, stagedFilePatches
      beforeEach(async () => {
        const workdirPath = await copyRepositoryDir(1)
        const repository = await buildRepository(workdirPath)
        fs.writeFileSync(path.join(workdirPath, 'a.txt'), 'a change\n')
        fs.unlinkSync(path.join(workdirPath, 'b.txt'))
        fs.writeFileSync(path.join(workdirPath, 'c.txt'), 'another change\n')
        fs.writeFileSync(path.join(workdirPath, 'd.txt'), 'new file 1\n')
        fs.writeFileSync(path.join(workdirPath, 'e.txt'), 'new file 2\n')
        fs.writeFileSync(path.join(workdirPath, 'f.txt'), 'new file 3\n')
        component = new StagingComponent({repository})
        await component.lastModelDataRefreshPromise

        const {stagedChangesComponent, unstagedChangesComponent} = component.refs
        const initialUnstagedFilePatches = unstagedChangesComponent.filePatches

        // Create three staged files, leaving three unstaged
        await unstagedChangesComponent.didConfirmFilePatch(initialUnstagedFilePatches[0])
        await component.lastModelDataRefreshPromise
        await unstagedChangesComponent.didConfirmFilePatch(initialUnstagedFilePatches[1])
        await component.lastModelDataRefreshPromise
        await unstagedChangesComponent.didConfirmFilePatch(initialUnstagedFilePatches[2])
        await component.lastModelDataRefreshPromise

        stagedFilePatches = stagedChangesComponent.filePatches
        unstagedFilePatches = unstagedChangesComponent.filePatches

        assert.equal(stagedFilePatches.length, 3)
        assert.equal(unstagedFilePatches.length, 3)
      })

      describe('keyboard navigation within Staged Changes list', () => {
        it('selects next/previous staged filePatch if there is one', () => {
          component.didSelectStagedFilePatch(stagedFilePatches[0])

          assert.equal(component.getSelectedList(), ListTypes.STAGED)
          assert.equal(getSelectedItemForStagedList(component), stagedFilePatches[0])

          atom.commands.dispatch(component.element, 'core:move-down')
          assert.deepEqual(getSelectedItemForStagedList(component), stagedFilePatches[1])

          atom.commands.dispatch(component.element, 'core:move-down')
          assert.deepEqual(getSelectedItemForStagedList(component), stagedFilePatches[2])

          atom.commands.dispatch(component.element, 'core:move-up')
          assert.deepEqual(getSelectedItemForStagedList(component), stagedFilePatches[1])

          atom.commands.dispatch(component.element, 'core:move-up')
          assert.deepEqual(getSelectedItemForStagedList(component), stagedFilePatches[0])
        })
      })

      describe('keyboard navigation within Unstaged Changes list', () => {
        it('selects next/previous unstaged filePatch if there is one', () => {
          component.didSelectUnstagedFilePatch(unstagedFilePatches[0])
          assert.equal(component.getSelectedList(), ListTypes.UNSTAGED)
          assert.equal(getSelectedItemForUnstagedList(component), unstagedFilePatches[0])

          atom.commands.dispatch(component.element, 'core:move-down')
          assert.deepEqual(getSelectedItemForUnstagedList(component), unstagedFilePatches[1])

          atom.commands.dispatch(component.element, 'core:move-down')
          assert.deepEqual(getSelectedItemForUnstagedList(component), unstagedFilePatches[2])

          atom.commands.dispatch(component.element, 'core:move-up')
          assert.deepEqual(getSelectedItemForUnstagedList(component), unstagedFilePatches[1])

          atom.commands.dispatch(component.element, 'core:move-up')
          assert.deepEqual(getSelectedItemForUnstagedList(component), unstagedFilePatches[0])
        })
      })

      describe('keyboard navigation across Staged and Unstaged Changes lists', () => {
        it('jumps between the end of Staged Changes list and beginning of Unstaged Changes list', () => {
          const lastStagedFilePatch = stagedFilePatches[stagedFilePatches.length - 1]
          const firstUnstagedFilePatch = unstagedFilePatches[0]

          component.didSelectStagedFilePatch(lastStagedFilePatch)
          assert.equal(component.getSelectedList(), ListTypes.STAGED)
          assert.equal(getSelectedItemForStagedList(component), lastStagedFilePatch)

          atom.commands.dispatch(component.element, 'core:move-down')
          assert.equal(component.getSelectedList(), ListTypes.UNSTAGED)
          assert.deepEqual(getSelectedItemForUnstagedList(component), firstUnstagedFilePatch)

          atom.commands.dispatch(component.element, 'core:move-up')
          assert.equal(component.getSelectedList(), ListTypes.STAGED)
          assert.deepEqual(getSelectedItemForStagedList(component), lastStagedFilePatch)
        })

        it('jumps between the end of Unstaged Changes list and beginning of Staged Changes list', () => {
          const lastUnstagedFilePatch = unstagedFilePatches[unstagedFilePatches.length - 1]
          const firstStagedFilePatch = stagedFilePatches[0]

          component.didSelectUnstagedFilePatch(lastUnstagedFilePatch)
          assert.equal(component.getSelectedList(), ListTypes.UNSTAGED)
          assert.equal(getSelectedItemForUnstagedList(component), lastUnstagedFilePatch)

          atom.commands.dispatch(component.element, 'core:move-down')
          assert.equal(component.getSelectedList(), ListTypes.STAGED)
          assert.deepEqual(getSelectedItemForStagedList(component), firstStagedFilePatch)

          atom.commands.dispatch(component.element, 'core:move-up')
          assert.equal(component.getSelectedList(), ListTypes.UNSTAGED)
          assert.deepEqual(getSelectedItemForUnstagedList(component), lastUnstagedFilePatch)
        })
      })
    })

    it('calls didSelectFilePatch when file is selected', async () => {
      const didSelectFilePatch = sinon.spy()

      const workdirPath = await copyRepositoryDir(1)
      const repository = await buildRepository(workdirPath)
      fs.writeFileSync(path.join(workdirPath, 'a.txt'), 'a change\n')
      const component = new StagingComponent({repository, didSelectFilePatch})
      await component.lastModelDataRefreshPromise

      const {stagedChangesComponent, unstagedChangesComponent} = component.refs
      const filePatch = unstagedChangesComponent.filePatches[0]

      assert(filePatch)

      unstagedChangesComponent.didSelectFilePatch(filePatch)
      assert.equal(didSelectFilePatch.callCount, 1)
      assert.deepEqual(didSelectFilePatch.args[0], [filePatch, 'unstaged'])

      stagedChangesComponent.didSelectFilePatch(filePatch)
      assert.equal(didSelectFilePatch.callCount, 2)
      assert.deepEqual(didSelectFilePatch.args[1], [filePatch, 'staged'])
    })
  })
})
