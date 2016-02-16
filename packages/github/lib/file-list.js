/** @babel */

import {CompositeDisposable, Emitter} from 'atom'
import Git from 'nodegit'
import FileDiff from './file-diff'
import GitService from './git-service'
import EventTransactor from './event-transactor'

// FileList contains a collection of FileDiff objects
export default class FileList {
  constructor (files, {stageOnChange} = {}) {
    // TODO: Rather than this `stageOnChange` bool, there should probably be a
    // new object that just handles the connection to nodegit. Cause there are
    // several of these objects in the system, but only one of them handles
    // writing to the index.
    this.gitService = GitService.instance()
    this.emitter = new Emitter()
    this.transactor = new EventTransactor(this.emitter, {fileList: this})
    this.fileCache = {}
    this.setFiles(files || [])
    if (stageOnChange) {
      this.onDidChange(this.handleDidChange.bind(this))
    }
  }

  onDidChange (callback) {
    return this.emitter.on('did-change', callback)
  }

  didChange (event) {
    this.transactor.didChange(event)
  }

  onDidUserChange (callback) {
    return this.emitter.on('did-user-change', callback)
  }

  didUserChange () {
    this.emitter.emit('did-user-change')
  }

  async handleDidChange (event) {
    if (!(event && event.events && event.fileList === this)) return
    if (this.isSyncingState()) return

    console.log('staging?', event)

    let stagePromises = []
    let stagableLinesPerFile = {}

    for (let fileEvent of event.events) {
      if (!fileEvent) continue

      let fileDiff = fileEvent.file
      // TODO: is new path the right thing?
      let pathName = fileDiff.getNewPathName()
      if (!stagableLinesPerFile[pathName]) {
        stagableLinesPerFile[pathName] = {
          linesToStage: [],
          linesToUnstage: []
        }
      }
      let stagableLines = stagableLinesPerFile[pathName]
      for (let hunkEvent of fileEvent.events) {
        if (!hunkEvent) continue

        for (let lineEvent of hunkEvent.events) {
          if (lineEvent.line && lineEvent.property === 'isStaged') {
            if (lineEvent.line.isStaged()) {
              stagableLines.linesToStage.push(lineEvent.line)
            } else {
              stagableLines.linesToUnstage.push(lineEvent.line)
            }
          }
        }
      }
    }

    for (let pathName in stagableLinesPerFile) {
      let {linesToStage, linesToUnstage} = stagableLinesPerFile[pathName]
      console.log('lines to stage:', linesToStage.length, '; unstage:', linesToUnstage.length)
      if (linesToStage.length) {
        stagePromises.push(this.stageLines(pathName, linesToStage, true))
      } else if (linesToUnstage.length) {
        stagePromises.push(this.stageLines(pathName, linesToUnstage, false))
      }
    }

    await Promise.all(stagePromises).catch(e => {
      console.log('FAIL staging', e)
    })
    this.didUserChange()
  }

  openFileDiffAtIndex (index) {
    return this.files[index].openDiff()
  }

  setFiles (files) {
    if (this.fileSubscriptions) {
      this.fileSubscriptions.dispose()
    }
    this.fileSubscriptions = new CompositeDisposable()
    this.files = files
    for (const file of files) {
      this.fileSubscriptions.add(file.onDidChange(this.didChange.bind(this)))
      this.addFileToCache(file)
    }
    this.didChange()
  }

  getFiles () {
    return this.files
  }

  // position = [0, 2] will get you the third hunk in the first file.
  // position = [0, 2, 1] will get you the 2nd line in the third hunk in the first file.
  getObjectAtPosition (position) {
    const [fileIndex, hunkIndex, lineIndex] = position

    const file = this.getFiles()[fileIndex]
    const hunk = file.getHunks()[hunkIndex]
    if (lineIndex != null) {
      return hunk.getLines()[lineIndex]
    } else {
      return hunk
    }
  }

  // The file cache should allow all UI elements usage of the same FileDiff
  // models. Sometimes it's a bit of a chicken and egg problem, and it happens
  // when a tab is deserialized.
  //
  // * Let's say there is a Diff tab being deserialized for `config.js`.
  // * The deserializer runs before nodegit knows the state of things, but the
  // tab needs a model. The tab will use `getOrCreateFileFromPathName` to get
  // the model.
  // * Then and the FileDiff::loadFromGitUtils is called and there are changes
  // in `config.js`
  // * `loadFromGitUtils` will use
  // `getOrCreateFileFromPathName('config.js')`, which will grab the same model
  // that the Diff tab is using.
  // * The model will be updated from the nodegit state and the Diff tab will
  // update properly.
  addFileToCache (file) {
    if (file.getOldPathName() !== file.getNewPathName() && this.fileCache[file.getOldPathName()]) {
      delete this.fileCache[file.getOldPathName()]
    }
    this.fileCache[file.getNewPathName()] = file
  }

  getFileFromPathName (pathName) {
    return this.fileCache[pathName]
  }

  getOrCreateFileFromPathName (pathName) {
    let file = this.getFileFromPathName(pathName)
    if (!file) {
      file = new FileDiff({newPathName: pathName, oldPathName: pathName})
      this.addFileToCache(file)
    }
    return file
  }

  isSyncingState () {
    if (this.isSyncing) {
      return true
    }

    for (let file of this.files) {
      if (file.isSyncingState()) {
        return true
      }
    }

    return false
  }

  toString () {
    return this.files.map((file) => { return file.toString() }).join('\n')
  }

  async stageLines (pathName, lines, isStaged) {
    console.log(isStaged ? 'stageLines' : 'unstageLines', lines)

    let repo = null
    try {
      repo = await Git.Repository.open(this.gitService.repoPath)
    } catch (e) {
      console.log(e)
      // TODO: Means we're not actually in a repo. Fine for now.
      return Promise.resolve()
    }

    let gitUtilsLines = lines.map((line) => { return line.line })
    return repo.stageLines2(pathName, gitUtilsLines, !isStaged)
  }

  async loadFromGitUtils () {
    console.log("Reloading")

    let files = []
    this.isSyncing = true

    // FIXME: for now, we need to get the stati for the diff stuff to work. :/
    this.gitService.getStatuses()
    let unifiedDiffs = await this.gitService.getDiffs('all')
    // TODO: It's a bummer these lines happen sequentially
    const stagedDiffs = await this.gitService.getDiffs('staged')
    const unstagedDiffs = await this.gitService.getDiffs('unstaged')

    const stagedDiffsByName = {}
    for (const diff of stagedDiffs) {
      // TODO: Old path is probably not always right.
      stagedDiffsByName[diff.oldFile().path()] = diff
    }

    const unstagedDiffsByName = {}
    for (const diff of unstagedDiffs) {
      // TODO: Old path is probably not always right.
      unstagedDiffsByName[diff.oldFile().path()] = diff
    }

    for (let diff of unifiedDiffs) {
      let fileDiff = this.getOrCreateFileFromPathName(diff.newFile().path())
      const stagedDiff = stagedDiffsByName[diff.newFile().path()]
      const unstagedDiff = unstagedDiffsByName[diff.newFile().path()]
      await fileDiff.fromGitUtilsObject({diff, stagedDiff, unstagedDiff})
      files.push(fileDiff)
    }

    this.transactor.transact(() => {
      this.setFiles(files)
    })
    this.isSyncing = false
  }
}

var NodeGit = Git
var Repository = NodeGit.Repository

Repository.prototype.stageLines2 =
          function(filePath, selectedLines, isSelectionStaged) {

  function applySelectedLinesToBlob
              (pathHunks, isStaged, newLines, originalBlob) {
    var lineTypes = {
      ADDED: 43, // ascii code for '+'
      DELETED: 45 // ascii code for '-'
    };
    var newContent = "";
    var oldIndex = 0;
    var linesPromises = [];

    //split the original file into lines
    var oldLines = originalBlob.toString().split("\n");

    //if no selected lines were sent, return the original content
    if (!newLines || newLines.length === 0) {
      return originalBlob;
    }

    function lineEqualsFirstNewLine(hunkLine) {
      return ((hunkLine.oldLineno() === newLines[0].oldLineno()) &&
              (hunkLine.newLineno() === newLines[0].newLineno()));
    }

    function processSelectedLine(hunkLine) {
      //if this hunk line is a selected line find the selected line
      var newLine = newLines.filter(function(nLine) {
        return ((hunkLine.oldLineno() === nLine.oldLineno()) &&
                (hunkLine.newLineno() === nLine.newLineno()));
      });

      if (hunkLine.raw.content()
        .indexOf("\\ No newline at end of file") != -1) {
        return false;
      }

      //determine what to add to the new content
      if ((isStaged && newLine && newLine.length > 0) ||
            (!isStaged && (!newLine || newLine.length === 0))) {
        if (hunkLine.origin() !== lineTypes.ADDED) {
          newContent += hunkLine.content();
        }
        if ((isStaged && hunkLine.origin() !== lineTypes.DELETED) ||
            (!isStaged && hunkLine.origin() !== lineTypes.ADDED)) {
          oldIndex++;
        }
      }
      else {
        switch (hunkLine.origin()) {
          case lineTypes.ADDED:
            newContent += hunkLine.content();
            if (isStaged) {
              oldIndex++;
            }
            break;
          case lineTypes.DELETED:
            if (!isStaged) {
              oldIndex++;
            }
            break;
          default:
            newContent += oldLines[oldIndex++];
            if (oldIndex < oldLines.length) {
              newContent += "\n";
            }
            break;
        }
      }
    }

    //find the affected hunk
    pathHunks.forEach(function(pathHunk) {
      linesPromises.push(pathHunk.lines());
    });
    return Promise.all(linesPromises).then(function(results) {
      for (var index = 0; index < results.length &&
                    newContent.length < 1; index++) {
        var hunkStart = isStaged ? pathHunks[index].hunk.newStart()
                        : pathHunks[index].hunk.oldStart();
        var lines = results[index];
        if (lines.filter(lineEqualsFirstNewLine).length > 0) {
          //add content that is before the hunk
          while (hunkStart > (oldIndex + 1)) {
            newContent += oldLines[oldIndex++] + "\n";
          }

          //modify the lines of the hunk according to the selection
          lines.forEach(processSelectedLine);

          //add the rest of the file
          while (oldLines.length > oldIndex) {
            newContent += oldLines[oldIndex++] +
                          (oldLines.length > oldIndex ? "\n" : "");
          }
        }
      }
      return newContent;
    });
  }

  var repo = this;
  var index;
  var diffPromise = function () {
    return isSelectionStaged ?
      repo.getHeadCommit()
        .then(function getTreeFromCommit(commit) {
          return commit.getTree();
        })
        .then(function getDiffFromTree(tree) {
          return NodeGit.Diff.treeToIndex(repo, tree, index);
        })
      :
      NodeGit.Diff.indexToWorkdir(repo, index, {
          flags:
            NodeGit.Diff.OPTION.SHOW_UNTRACKED_CONTENT |
            NodeGit.Diff.OPTION.RECURSE_UNTRACKED_DIRS
        });
    }

    //The following chain checks if there is a patch with no hunks left for the
    //file, and no filemode changes were done on the file. It is then safe to
    //stage the entire file so the file doesn't show as having unstaged changes
    //in `git status`. Also, check if there are no type changes.
    var lastHunkStagedPromise = function lastHunkStagedPromise(result) {
      return NodeGit.Diff.indexToWorkdir(repo, index, {
          flags:
            NodeGit.Diff.OPTION.SHOW_UNTRACKED_CONTENT |
            NodeGit.Diff.OPTION.RECURSE_UNTRACKED_DIRS
        })
      .then(function (diff) {
        return diff.patches();
      })
      .then(function(patches) {
        var pathPatch = patches.filter(function(patch) {
          return patch.newFile().path() === filePath;
        });
        var emptyPatch = false;
        if (pathPatch.length > 0) {
          //No hunks, unchanged file mode, and no type changes.
          emptyPatch = pathPatch[0].patch.numHunks() === 0 &&
            pathPatch[0].oldFile().mode() == pathPatch[0].newFile().mode() &&
            !pathPatch[0].isTypeChange();
        }
        if (emptyPatch) {
          index.addByPath(filePath);
          return index.write();
        } else {
          return result;
        }
      });
    };

  return repo.openIndex()
    .then(function(indexResult) {
      index = indexResult;
      return index.read(1);
    })
    .then(function() {
      return diffPromise();
    })
    .then(function(diff) {
      if (!(NodeGit.Status.file(repo, filePath) &
          NodeGit.Status.STATUS.WT_MODIFIED) &&
          !(NodeGit.Status.file(repo, filePath) &
          NodeGit.Status.STATUS.INDEX_MODIFIED)) {
        return Promise.reject
            ("Selected staging is only available on modified files.");
      }
      return diff.patches();
    })
    .then(function(patches) {
      var pathOid = index.getByPath(filePath).id;
      var pathPatch = patches.filter(function(patch) {
        return patch.newFile().path() === filePath;
      });
      if (pathPatch.length !== 1) {
        return Promise.reject("No differences found for this file.");
      }
      return Promise.all([repo.getBlob(pathOid), pathPatch[0].hunks()]);
    })
    .then(function(results) {
      var originalBlob = results[0];
      var pathHunks = results[1];
      return applySelectedLinesToBlob(
            pathHunks, isSelectionStaged, selectedLines, originalBlob);
    })
    .then(function(newContent) {
      var newContentBuffer = new Buffer(newContent);

      var newOid = repo.createBlobFromBuffer(newContentBuffer);
      return repo.getBlob(newOid);
    })
    .then(function(newBlob) {
      var entry = index.getByPath(filePath, 0);
      entry.id = newBlob.id();
      entry.path = filePath;
      entry.fileSize = newBlob.content().length;

      index.add(entry);
      return index.write();
    })
    .then(function(result) {
      if (isSelectionStaged) {
        return result;
      } else {
        return lastHunkStagedPromise(result);
      }
    });
};
