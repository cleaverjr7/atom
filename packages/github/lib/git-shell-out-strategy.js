/** @babel */
import path from 'path'
import cp from 'child_process'
import fs from 'fs'

import {parsePatch} from 'diff'

function resolveGit () {
  if (process.platform === 'darwin') {
    return path.join(__dirname, '../git-distributions/git-macos/git/bin/git')
  // } else if (process.platform === 'win32') {
  //   return path.join(__dirname, 'git/cmd/git.exe')
  } else {
    throw new Error('Git not supported on platform: ' + process.platform)
  }
}

export default class GitShellOutStrategy {
  constructor (workingDir) {
    this.workingDir = workingDir
  }

  // Execute a command and read the output using the embedded Git environment
  exec (args, dataToWrite = null) {
    return new Promise((resolve, reject) => {
      const formatArgs = 'executing: `git ' + args.join(' ') + '` in ' + this.workingDir

      const child = cp.execFile(resolveGit(), args, { cwd: this.workingDir, encoding: 'utf8' }, (err, output, stdErr) => {
        if (stdErr) {
          console.warn(formatArgs)
          console.warn(stdErr)
        }

        if (err) {
          console.error(formatArgs)
          console.error(err)
          return reject(err)
        }

        resolve(output)
      })

      child.on('exit', (code) => {
        if (code !== 0) console.log('process (' + formatArgs + ') exited with code:', code)
      })
      child.on('error', (err) => {
        console.error('Error executing: ' + formatArgs)
        console.error(err.stack)
      })
      child.stdin.on('error', (err) => {
        console.error('Error writing to process: ' + formatArgs)
        console.error(err.stack)
        console.error('Tried to write: ' + dataToWrite)
      })

      if (dataToWrite) {
        child.stdin.end(dataToWrite)
      }
    })
  }

  async diffFileStatus (options = {}) {
    let args = ['diff', '--name-status']
    if (options.target) args = args.concat(options.target)
    const output = await this.exec(args)
    const untracked = await this.getUntrackedFiles()

    const statusMap = {
      A: 'added',
      M: 'modified',
      D: 'removed'
    }

    const fileStatuses = {}
    untracked.forEach(filePath => { fileStatuses[filePath] = 'added' })
    output.trim().split('\n').forEach(line => {
      const [status, filePath] = line.split('	')
      fileStatuses[filePath] = statusMap[status]
    })
    return fileStatuses
  }

  applyPatchToIndex (patch) {
    return this.exec(['apply', '--cached', '-'], patch)
  }

  stageFile (path) {
    return this.exec(['add', path])
  }

  unstageFile (path) {
    return this.exec(['reset', '--', path])
  }

  async getUntrackedFiles () {
    const output = await this.exec(['clean', '--dry-run'])
    if (output.trim() === '') return []
    return output.trim().split('\n').map(line => line.split(' ')[2])
  }

  async diff (options = {}) {
    let args = ['diff']
    if (options.staged) args.push('--staged')
    const output = await this.exec(args)
    let rawDiffs = parsePatch(output)

    if (!options.staged) {
      // add untracked files
      const untrackedFilePatches = await Promise.all((await this.getUntrackedFiles()).map(async (filePath) => {
        const contents = await readFile(path.join(this.workingDir, filePath))
        return buildAddedFilePatch(filePath, contents)
      }))
      rawDiffs = rawDiffs.concat(untrackedFilePatches)
    }

    const status = await this.diffFileStatus({target: 'HEAD'})
    return rawDiffs.map(patch => {
      let fileName
      if (patch.newFileName !== '/dev/null') {
        fileName = patch.newFileName.substr(2)
      } else {
        fileName = patch.oldFileName.substr(2)
      }
      patch.status = status[fileName]
      patch = formatPatch(patch)
      return patch
    })
  }
}

function readFile (absoluteFilePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(absoluteFilePath, 'utf8', (err, contents) => {
      if (err) reject(err)
      else resolve(contents)
    })
  })
}

function getFilePathFromDiffFileName (fileName) {
  return fileName === '/dev/null' ? null : fileName.substr(2)
}

function formatPatch (patch) {
  patch.oldPath = getFilePathFromDiffFileName(patch.oldFileName)
  patch.newPath = getFilePathFromDiffFileName(patch.newFileName)
  delete patch.oldFileName
  delete patch.newFileName
  delete patch.oldHeader
  delete patch.newHeader
  patch.hunks = patch.hunks.map(hunk => {
    return {
      oldStartLine: hunk.oldStart,
      oldLineCount: hunk.oldLines,
      newStartLine: hunk.newStart,
      newLineCount: hunk.newLines,
      lines: hunk.lines
    }
  })
  return patch
}

function buildAddedFilePatch (filePath, contents) {
  const noNewLine = contents[contents.length - 1] !== '\n'
  let lines = contents.trim().split(/\r?\n/).map(line => `+${line}`)
  if (noNewLine) lines.push('\\ No newline at end of file')
  return {
    oldFileName: '/dev/null',
    newFileName: `b/${filePath}`,
    status: 'added',
    hunks: [
      {
        lines: lines,
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: noNewLine ? lines.length - 1 : lines.length
      }
    ]
  }
}
