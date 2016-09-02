/** @babel */
import path from 'path'

import {parsePatch} from 'diff'

import GitProcess from './git-process'
import AsyncQueue from './async-queue'
import {readFile} from './helpers'

const UNMERGED_FILE_REGEX = /^\* Unmerged path.*\n/gm
const LINE_ENDING_REGEX = /\r?\n/

export default class GitShellOutStrategy {
  constructor (workingDir) {
    this.workingDir = workingDir
    this.commandQueue = new AsyncQueue()
  }

  // Execute a command and read the output using the embedded Git environment
  async exec (args, stdin = null) {
    return this.commandQueue.push(async () => {
      const proc = new GitProcess(args, {
        stdin,
        cwd: this.workingDir
      })

      return proc.exec()
    })
  }

  async isGitRepository () {
    try {
      await this.exec(['rev-parse', '--resolve-git-dir', path.join(this.workingDir, '.git')])
      return true
    } catch (e) {
      return false
    }
  }

  /**
   * Staging/Unstaging files and patches and committing
   */
  stageFiles (paths) {
    if (paths.length === 0) return
    const args = ['add'].concat(paths)
    return this.exec(args)
  }

  unstageFiles (paths) {
    if (paths.length === 0) return
    const args = ['reset', '--'].concat(paths)
    return this.exec(args)
  }

  applyPatchToIndex (patch) {
    return this.exec(['apply', '--cached', '-'], patch)
  }

  commit (message, {allowEmpty, amend} = {}) {
    const args = ['commit', '-m', message]
    if (amend) args.push('--amend')
    if (allowEmpty) args.push('--allow-empty')
    return this.exec(args)
  }

  /**
   * File Status and Diffs
   */
  async diffFileStatus (options = {}) {
    let args = ['diff', '--name-status', '--no-renames']
    if (options.staged) args.push('--staged')
    if (options.target) args.push(options.target)
    if (options.diffFilter === 'unmerged') args.push('--diff-filter=U')
    const output = await this.exec(args)
    const untracked = await this.getUntrackedFiles()

    const statusMap = {
      A: 'added',
      M: 'modified',
      D: 'removed',
      U: 'unmerged'
    }

    const fileStatuses = {}
    untracked.forEach(filePath => { fileStatuses[filePath] = 'added' })
    output && output.trim().split(LINE_ENDING_REGEX).forEach(line => {
      const [status, filePath] = line.split('	')
      fileStatuses[filePath] = statusMap[status]
    })
    return fileStatuses
  }

  async getUntrackedFiles () {
    const output = await this.exec(['clean', '--dry-run'])
    if (output.trim() === '') return []
    return output.trim().split(LINE_ENDING_REGEX).map(line => line.split(' ')[2])
  }

  async diff (options = {}) {
    let args = ['diff', '--no-prefix', '--no-renames']
    if (options.staged) args.push('--staged')
    let output = await this.exec(args)
    output = output.replace(UNMERGED_FILE_REGEX, '')

    let rawDiffs = []
    if (output) rawDiffs = parsePatch(output)

    let status
    if (!options.staged) {
      status = await this.diffFileStatus()
      // add untracked files
      const untrackedFilePatches = await Promise.all((await this.getUntrackedFiles()).map(async (filePath) => {
        const contents = await readFile(path.join(this.workingDir, filePath))
        return buildAddedFilePatch(filePath, contents)
      }))
      rawDiffs = rawDiffs.concat(untrackedFilePatches)
    } else {
      status = await this.diffFileStatus({staged: true})
    }

    // filter out merge conflict files
    // TODO: consider implementing our own version of parsePatch that does this for us and formats the patches as we like
    const statusUnmergedFiles = await this.diffFileStatus({diffFilter: 'unmerged'})
    rawDiffs = rawDiffs.filter(rawDiff => statusUnmergedFiles[rawDiff.newFileName] !== 'unmerged')

    return rawDiffs.map(patch => {
      patch = formatPatch(patch)
      let fileName = getPathForPatch(patch)
      patch.status = status[fileName]
      return patch
    }).sort((a, b) => getPathForPatch(a).localeCompare(getPathForPatch(b)))
  }

  /**
   * Miscellaneous getters
   */
  async getCommit (ref) {
    const output = (await this.exec(['log', '--oneline', '--no-abbrev-commit', '-1', ref])).split(' ')
    return {
      sha: output.shift(),
      message: output.join(' ').trim()
    }
  }

  getHeadCommit () {
    return this.getCommit('HEAD')
  }

  readFileFromIndex (path) {
    return this.exec(['show', `:${path}`])
  }

  /**
   * Merge
   */
  merge (branchName) {
    return this.exec(['merge', branchName])
  }

  async getMergeConflictFileStatus () {
    const output = await this.exec(['status', '--short'])
    const statusToHead = await this.diffFileStatus({target: 'HEAD'})

    const statusMap = {
      A: 'added',
      U: 'modified',
      D: 'removed'
    }

    const statusesByPath = {}
    output && output.trim().split(LINE_ENDING_REGEX).forEach(line => {
      const [oursTheirsStatus, filePath] = line.split(' ')
      if (['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(oursTheirsStatus)) {
        statusesByPath[filePath] = {
          ours: statusMap[oursTheirsStatus[0]],
          theirs: statusMap[oursTheirsStatus[1]],
          file: statusToHead[filePath] || 'equivalent'
        }
      }
    })
    return statusesByPath
  }

  async isMerging () {
    try {
      await readFile(path.join(this.workingDir, '.git', 'MERGE_HEAD'))
      return true
    } catch (e) {
      return false
    }
  }

  abortMerge () {
    return this.exec(['merge', '--abort'])
  }

  /**
   * Remote interactions
   */
  clone (remoteUrl, options = {}) {
    const args = ['clone', '--no-local', remoteUrl, this.workingDir]
    if (options.bare) args.push('--bare')
    return this.exec(args)
  }

  async getRemote (branchName) {
    try {
      const output = await this.exec(['config', `branch.${branchName}.remote`])
      return output.trim()
    } catch (e) {
      return null
    }
  }

  async fetch (branchName) {
    try {
      const remote = await this.getRemote(branchName)
      const output = await this.exec(['fetch', remote, branchName])
      return output
    } catch (e) {
      console.error(e)
    }
  }

  async push (branchName) {
    const remote = await this.getRemote(branchName)
    return this.exec(['push', remote, branchName])
  }

  async getAheadCount (branchName) {
    const remote = await this.getRemote(branchName)
    const output = await this.exec(['rev-list', `${remote}/${branchName}..${branchName}`])
    return output.trim().split(LINE_ENDING_REGEX).filter(s => s.trim()).length
  }

  async getBehindCount (branchName) {
    const remote = await this.getRemote(branchName)
    const output = await this.exec(['rev-list', `${branchName}..${remote}/${branchName}`])
    return output.trim().split(LINE_ENDING_REGEX).filter(s => s.trim()).length
  }

  /**
   * Branches
   */
  async getCurrentBranch () {
    const output = await this.exec(['rev-parse', '--abbrev-ref', 'HEAD'])
    return output.trim()
  }

  checkout (branchName, options = {}) {
    const args = ['checkout']
    if (options.createNew) args.push('-b')
    return this.exec(args.concat(branchName))
  }

  async getBranches () {
    const output = await this.exec(['branch'])
    return output.trim().split(LINE_ENDING_REGEX)
      .map(branchName => branchName.trim().replace(/^\* /, ''))
  }
}

function getFilePathFromDiffFileName (fileName) {
  return fileName === '/dev/null' ? null : fileName
}

function getPathForPatch (patch) {
  return getFilePathFromDiffFileName(patch.newPath) || getFilePathFromDiffFileName(patch.oldPath)
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
  let lines = contents.trim().split(LINE_ENDING_REGEX).map(line => `+${line}`)
  if (noNewLine) lines.push('\\ No newline at end of file')
  return {
    oldFileName: '/dev/null',
    newFileName: filePath,
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
