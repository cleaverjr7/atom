import fs from 'fs';
import path from 'path';

import {cloneRepository, buildRepository} from '../helpers';
import FilePatch from '../../lib/models/file-patch';
import FilePatchController from '../../lib/controllers/file-patch-controller';
import Hunk from '../../lib/models/hunk';
import HunkLine from '../../lib/models/hunk-line';

describe('FilePatchController', () => {
  let atomEnv, commandRegistry;

  beforeEach(() => {
    atomEnv = global.buildAtomEnvironment();
    commandRegistry = atomEnv.commands;
  });

  afterEach(() => {
    atomEnv.destroy();
  });

  it('bases its tab title on the staging status', () => {
    const filePatch1 = new FilePatch('a.txt', 'a.txt', 'modified', [new Hunk(1, 1, 1, 3, [])]);
    const controller = new FilePatchController({commandRegistry, filePatch: filePatch1, stagingStatus: 'unstaged'});
    assert.equal(controller.getTitle(), 'Unstaged Changes: a.txt');

    const changeHandler = sinon.spy();
    controller.onDidChangeTitle(changeHandler);

    controller.update({filePatch: filePatch1, stagingStatus: 'staged'});
    assert.equal(controller.getTitle(), 'Staged Changes: a.txt');
    assert.deepEqual(changeHandler.args, [[controller.getTitle()]]);
  });

  it('renders FilePatchView only if FilePatch has hunks', async () => {
    const emptyFilePatch = new FilePatch('a.txt', 'a.txt', 'modified', []);
    const controller = new FilePatchController({commandRegistry, filePatch: emptyFilePatch}); // eslint-disable-line no-new
    assert.isUndefined(controller.refs.filePatchView);

    const hunk1 = new Hunk(0, 0, 1, 1, [new HunkLine('line-1', 'added', 1, 1)]);
    const filePatch = new FilePatch('a.txt', 'a.txt', 'modified', [hunk1]);
    await controller.update({filePatch});
    assert.isDefined(controller.refs.filePatchView);
  });

  it('updates when a new FilePatch is passed', async () => {
    const hunk1 = new Hunk(5, 5, 2, 1, [new HunkLine('line-1', 'added', -1, 5)]);
    const hunk2 = new Hunk(8, 8, 1, 1, [new HunkLine('line-5', 'deleted', 8, -1)]);
    const hunkViewsByHunk = new Map();
    const filePatch = new FilePatch('a.txt', 'a.txt', 'modified', [hunk1, hunk2]);
    const controller = new FilePatchController({commandRegistry, filePatch, registerHunkView: (hunk, ctrl) => hunkViewsByHunk.set(hunk, ctrl)}); // eslint-disable-line no-new
    assert(hunkViewsByHunk.get(hunk1) != null);
    assert(hunkViewsByHunk.get(hunk2) != null);

    hunkViewsByHunk.clear();
    const hunk3 = new Hunk(8, 8, 1, 1, [new HunkLine('line-10', 'modified', 10, 10)]);
    await controller.update({filePatch: new FilePatch('a.txt', 'a.txt', 'modified', [hunk1, hunk3])});
    assert(hunkViewsByHunk.get(hunk1) != null);
    assert(hunkViewsByHunk.get(hunk2) == null);
    assert(hunkViewsByHunk.get(hunk3) != null);
  });

  it('invokes a didSurfaceFile callback with the current file path', () => {
    const filePatch1 = new FilePatch('a.txt', 'a.txt', 'modified', [new Hunk(1, 1, 1, 3, [])]);
    const didSurfaceFile = sinon.spy();
    const controller = new FilePatchController({commandRegistry, filePatch: filePatch1, stagingStatus: 'unstaged', didSurfaceFile});

    commandRegistry.dispatch(controller.refs.filePatchView.element, 'core:move-right');
    assert.isTrue(didSurfaceFile.calledWith('a.txt', 'unstaged'));
  });

  describe('integration tests', () => {
    it('stages and unstages hunks when the stage button is clicked on hunk views with no individual lines selected', async () => {
      const workdirPath = await cloneRepository('multi-line-file');
      const repository = await buildRepository(workdirPath);
      const filePath = path.join(workdirPath, 'sample.js');
      const originalLines = fs.readFileSync(filePath, 'utf8').split('\n');
      const unstagedLines = originalLines.slice();
      unstagedLines.splice(1, 1,
        'this is a modified line',
        'this is a new line',
        'this is another new line',
      );
      unstagedLines.splice(11, 2, 'this is a modified line');
      fs.writeFileSync(filePath, unstagedLines.join('\n'));
      const unstagedFilePatch = await repository.getFilePatchForPath('sample.js');

      const hunkViewsByHunk = new Map();
      function registerHunkView(hunk, view) { hunkViewsByHunk.set(hunk, view); }

      const controller = new FilePatchController({commandRegistry, filePatch: unstagedFilePatch, repository, stagingStatus: 'unstaged', registerHunkView});
      const view = controller.refs.filePatchView;
      await view.selectNext();
      const hunkToStage = hunkViewsByHunk.get(unstagedFilePatch.getHunks()[0]);
      assert.notDeepEqual(view.selectedHunk, unstagedFilePatch.getHunks()[0]);
      await hunkToStage.props.didClickStageButton();
      const expectedStagedLines = originalLines.slice();
      expectedStagedLines.splice(1, 1,
        'this is a modified line',
        'this is a new line',
        'this is another new line',
      );
      assert.autocrlfEqual(await repository.readFileFromIndex('sample.js'), expectedStagedLines.join('\n'));

      const stagedFilePatch = await repository.getFilePatchForPath('sample.js', {staged: true});
      await controller.update({filePatch: stagedFilePatch, repository, stagingStatus: 'staged', registerHunkView});
      await hunkViewsByHunk.get(stagedFilePatch.getHunks()[0]).props.didClickStageButton();
      assert.autocrlfEqual(await repository.readFileFromIndex('sample.js'), originalLines.join('\n'));
    });

    it('stages and unstages individual lines when the stage button is clicked on a hunk with selected lines', async () => {
      const workdirPath = await cloneRepository('multi-line-file');
      const repository = await buildRepository(workdirPath);
      const filePath = path.join(workdirPath, 'sample.js');
      const originalLines = fs.readFileSync(filePath, 'utf8').split('\n');

      // write some unstaged changes
      const unstagedLines = originalLines.slice();
      unstagedLines.splice(1, 1,
        'this is a modified line',
        'this is a new line',
        'this is another new line',
      );
      unstagedLines.splice(11, 2, 'this is a modified line');
      fs.writeFileSync(filePath, unstagedLines.join('\n'));
      let unstagedFilePatch = await repository.getFilePatchForPath('sample.js');
      const hunkViewsByHunk = new Map();
      function registerHunkView(hunk, view) { hunkViewsByHunk.set(hunk, view); }

      // stage a subset of lines from first hunk
      const controller = new FilePatchController({commandRegistry, filePatch: unstagedFilePatch, repository, stagingStatus: 'unstaged', registerHunkView});
      const view = controller.refs.filePatchView;
      let hunk = unstagedFilePatch.getHunks()[0];
      let lines = hunk.getLines();
      let hunkView = hunkViewsByHunk.get(hunk);
      hunkView.props.mousedownOnLine({detail: 1}, hunk, lines[1]);
      hunkView.props.mousemoveOnLine({}, hunk, lines[3]);
      view.mouseup();
      await hunkView.props.didClickStageButton();
      repository.refresh();
      let expectedLines = originalLines.slice();
      expectedLines.splice(1, 1,
        'this is a modified line',
        'this is a new line',
      );
      assert.autocrlfEqual(await repository.readFileFromIndex('sample.js'), expectedLines.join('\n'));

      // stage remaining lines in hunk
      unstagedFilePatch = await repository.getFilePatchForPath('sample.js');
      await controller.update({filePatch: unstagedFilePatch});
      hunk = unstagedFilePatch.getHunks()[0];
      hunkView = hunkViewsByHunk.get(hunk);
      await hunkView.props.didClickStageButton();
      repository.refresh();
      expectedLines = originalLines.slice();
      expectedLines.splice(1, 1,
        'this is a modified line',
        'this is a new line',
        'this is another new line',
      );
      assert.autocrlfEqual(await repository.readFileFromIndex('sample.js'), expectedLines.join('\n'));

      // unstage a subset of lines from the first hunk
      let stagedFilePatch = await repository.getFilePatchForPath('sample.js', {staged: true});
      await controller.update({filePatch: stagedFilePatch, repository, stagingStatus: 'staged', registerHunkView});
      hunk = stagedFilePatch.getHunks()[0];
      lines = hunk.getLines();
      hunkView = hunkViewsByHunk.get(hunk);
      hunkView.props.mousedownOnLine({detail: 1}, hunk, lines[1]);
      view.mouseup();
      hunkView.props.mousedownOnLine({detail: 1, metaKey: true}, hunk, lines[2]);
      view.mouseup();

      await hunkView.props.didClickStageButton();
      repository.refresh();
      expectedLines = originalLines.slice();
      expectedLines.splice(2, 0,
        'this is a new line',
        'this is another new line',
      );
      assert.autocrlfEqual(await repository.readFileFromIndex('sample.js'), expectedLines.join('\n'));

      // unstage the rest of the hunk
      stagedFilePatch = await repository.getFilePatchForPath('sample.js', {staged: true});
      await controller.update({filePatch: stagedFilePatch});
      await view.togglePatchSelectionMode();
      await hunkView.props.didClickStageButton();
      assert.autocrlfEqual(await repository.readFileFromIndex('sample.js'), originalLines.join('\n'));
    });

    // https://github.com/atom/github/issues/341
    describe('when duplicate staging occurs', () => {
      it('avoids patch conflicts with pending line staging operations', async () => {
        const workdirPath = await cloneRepository('multi-line-file');
        const repository = await buildRepository(workdirPath);
        const filePath = path.join(workdirPath, 'sample.js');
        const originalLines = fs.readFileSync(filePath, 'utf8').split('\n');

        // write some unstaged changes
        const unstagedLines = originalLines.slice();
        unstagedLines.splice(1, 0,
          'this is a modified line',
          'this is a new line',
          'this is another new line',
        );
        unstagedLines.splice(11, 2, 'this is a modified line');
        fs.writeFileSync(filePath, unstagedLines.join('\n'));
        const unstagedFilePatch = await repository.getFilePatchForPath('sample.js');
        const hunkViewsByHunk = new Map();
        function registerHunkView(hunk, view) { hunkViewsByHunk.set(hunk, view); }

        const controller = new FilePatchController({commandRegistry, filePatch: unstagedFilePatch, repository, stagingStatus: 'unstaged', registerHunkView});
        const view = controller.refs.filePatchView;
        let hunk = unstagedFilePatch.getHunks()[0];
        let lines = hunk.getLines();
        let hunkView = hunkViewsByHunk.get(hunk);
        hunkView.props.mousedownOnLine({detail: 1}, hunk, lines[1]);
        view.mouseup();

        // stage lines in rapid succession
        // second stage action is a no-op since the first staging operation is in flight
        const line1StagingPromises = hunkView.props.didClickStageButton();
        hunkView.props.didClickStageButton();

        await line1StagingPromises.stageOperationPromise;
        repository.refresh(); // clear the cached file patches
        const modifiedFilePatch = await repository.getFilePatchForPath('sample.js');
        await controller.update({filePatch: modifiedFilePatch, repository, stagingStatus: 'unstaged', registerHunkView});
        await line1StagingPromises.selectionUpdatePromise;

        // assert that only line 1 has been staged
        let expectedLines = originalLines.slice();
        expectedLines.splice(1, 0,
          'this is a modified line',
        );
        let actualLines = await repository.readFileFromIndex('sample.js');
        assert.autocrlfEqual(actualLines, expectedLines.join('\n'));

        hunk = modifiedFilePatch.getHunks()[0];
        lines = hunk.getLines();
        hunkView = hunkViewsByHunk.get(hunk);
        hunkView.props.mousedownOnLine({detail: 1}, hunk, lines[2]);
        view.mouseup();

        const line2StagingPromises = hunkView.props.didClickStageButton();
        await line2StagingPromises.stageOperationPromise;

        // assert that line 2 has now been staged
        expectedLines = originalLines.slice();
        expectedLines.splice(1, 0,
          'this is a modified line',
          'this is a new line',
        );
        actualLines = await repository.readFileFromIndex('sample.js');
        assert.autocrlfEqual(actualLines, expectedLines.join('\n'));
      });

      it('avoids patch conflicts with pending hunk staging operations', async () => {
        const workdirPath = await cloneRepository('multi-line-file');
        const repository = await buildRepository(workdirPath);
        const filePath = path.join(workdirPath, 'sample.js');
        const originalLines = fs.readFileSync(filePath, 'utf8').split('\n');

        // write some unstaged changes
        const unstagedLines = originalLines.slice();
        unstagedLines.splice(1, 0,
          'this is a modified line',
          'this is a new line',
          'this is another new line',
        );
        unstagedLines.splice(11, 2, 'this is a modified line');
        fs.writeFileSync(filePath, unstagedLines.join('\n'));
        const unstagedFilePatch = await repository.getFilePatchForPath('sample.js');
        const hunkViewsByHunk = new Map();
        function registerHunkView(hunk, view) { hunkViewsByHunk.set(hunk, view); }

        const controller = new FilePatchController({commandRegistry, filePatch: unstagedFilePatch, repository, stagingStatus: 'unstaged', registerHunkView});
        let hunk = unstagedFilePatch.getHunks()[0];
        let hunkView = hunkViewsByHunk.get(hunk);

        // ensure staging the same hunk twice does not cause issues
        // second stage action is a no-op since the first staging operation is in flight
        const hunk1StagingPromises = hunkView.props.didClickStageButton();
        hunkView.props.didClickStageButton();

        await hunk1StagingPromises.stageOperationPromise;
        repository.refresh(); // clear the cached file patches
        const modifiedFilePatch = await repository.getFilePatchForPath('sample.js');
        await controller.update({filePatch: modifiedFilePatch, repository, stagingStatus: 'unstaged', registerHunkView});
        await hunk1StagingPromises.selectionUpdatePromise;

        let expectedLines = originalLines.slice();
        expectedLines.splice(1, 0,
          'this is a modified line',
          'this is a new line',
          'this is another new line',
        );
        let actualLines = await repository.readFileFromIndex('sample.js');
        assert.autocrlfEqual(actualLines, expectedLines.join('\n'));

        hunk = modifiedFilePatch.getHunks()[0];
        hunkView = hunkViewsByHunk.get(hunk);

        const hunk2StagingPromises = hunkView.props.didClickStageButton();
        await hunk2StagingPromises.stageOperationPromise;

        expectedLines = originalLines.slice();
        expectedLines.splice(1, 0,
          'this is a modified line',
          'this is a new line',
          'this is another new line',
        );
        expectedLines.splice(11, 2, 'this is a modified line');
        actualLines = await repository.readFileFromIndex('sample.js');
        assert.autocrlfEqual(actualLines, expectedLines.join('\n'));
      });
    });
  });
});
