/** @babel */

import fs from 'fs-plus'
import path from 'path'
import temp from 'temp'
import FileDiff from '../lib/file-diff'
import {createObjectsFromString} from '../lib/common'

function readFileSync (filePath) {
  return fs.readFileSync(path.join(__dirname, filePath), 'utf-8')
}

function createFileDiffsFromString (str) {
  return createObjectsFromString(str, 'FILE', FileDiff)
}

function createFileDiffsFromPath (filePath) {
  let fileStr = readFileSync(filePath)
  return createFileDiffsFromString(fileStr)
}

// Lifted from atom/atom
function buildMouseEvent (type, properties) {
  if (properties.detail == null) {
    properties.detail = 1
  }
  if (properties.bubbles == null) {
    properties.bubbles = true
  }
  if (properties.cancelable == null) {
    properties.cancelable = true
  }

  let event = new MouseEvent(type, properties)
  if (properties.which != null) {
    Object.defineProperty(event, 'which', {
      get: function () {
        return properties.which
      }
    })
  }
  if (properties.target != null) {
    Object.defineProperty(event, 'target', {
      get: function () {
        return properties.target
      }
    })
    Object.defineProperty(event, 'srcObject', {
      get: function () {
        return properties.target
      }
    })
  }
  return event
}

temp.track()

function copyRepository (name = 'test-repo') {
  const workingDirPath = temp.mkdirSync('git-prototype-fixture')
  fs.copySync(path.join(__dirname, 'fixtures', name), workingDirPath)
  fs.renameSync(path.join(workingDirPath, 'git.git'), path.join(workingDirPath, '.git'))
  return fs.realpathSync(workingDirPath)
}

module.exports = {
  createFileDiffsFromString,
  createFileDiffsFromPath,
  readFileSync,
  buildMouseEvent,
  copyRepository
}
