/** @babel */

import fs from 'fs-extra'
import path from 'path'
import temp from 'temp'
import {Directory} from 'atom'
import GitShellOutStrategy from '../lib/git-shell-out-strategy'

import Repository from '../lib/models/repository'

assert.autocrlfEqual = (actual, expected, ...args) => {
  actual = actual.replace(/\r\n/g, '\n')
  expected = expected.replace(/\r\n/g, '\n')
  return assert.equal(actual, expected, ...args)
}

// cloning a repo into a folder and then copying it
// for each subsequent request to clone makes cloning
// 2-3x faster on macOS and 5-10x faster on Windows
const cachedClonedRepos = {}
function copyCachedRepo(repoName) {
  const workingDirPath = temp.mkdirSync('git-fixture-')
  fs.copySync(cachedClonedRepos[repoName], workingDirPath)
  return fs.realpathSync(workingDirPath)
}

export async function cloneRepository (repoName = 'three-files') {
  if (!cachedClonedRepos[repoName]) {
    const cachedPath = temp.mkdirSync('git-fixture-cache-')
    const git = new GitShellOutStrategy(cachedPath)
    await git.clone(path.join(__dirname, 'fixtures', `repo-${repoName}`, 'dot-git'))
    await git.exec(['config', '--local', 'core.autocrlf', 'false'])
    await git.exec(['checkout', '--', '.']) // discard \r in working directory
    cachedClonedRepos[repoName] = cachedPath
  }
  return copyCachedRepo(repoName)
}

export async function setUpLocalAndRemoteRepositories (repoName = 'multiple-commits', options = {}) {
  if (typeof repoName === 'object') {
    options = repoName
    repoName = 'multiple-commits'
  }
  const baseRepoPath = await cloneRepository(repoName)
  const baseGit = new GitShellOutStrategy(baseRepoPath)

  // create remote bare repo with all commits
  const remoteRepoPath = temp.mkdirSync('git-remote-fixture-')
  const remoteGit = new GitShellOutStrategy(remoteRepoPath)
  await remoteGit.clone(baseRepoPath, {bare: true})

  // create local repo with one fewer commit
  if (options.remoteAhead) await baseGit.exec(['reset', 'head~'])
  const localRepoPath = temp.mkdirSync('git-local-fixture-')
  const localGit = new GitShellOutStrategy(localRepoPath)
  await localGit.clone(baseRepoPath)
  await localGit.exec(['remote', 'set-url', 'origin', remoteRepoPath])
  return {baseRepoPath, remoteRepoPath, localRepoPath}
}

export async function getHeadCommitOnRemote (remotePath) {
  const workingDirPath = temp.mkdirSync('git-fixture-')
  const git = new GitShellOutStrategy(workingDirPath)
  await git.clone(remotePath)
  return git.getHeadCommit()
}

export function buildRepository (workingDirPath) {
  return Repository.open(new Directory(workingDirPath))
}

export function assertDeepPropertyVals (actual, expected) {
  function extractObjectSubset (actual, expected) {
    if (actual !== Object(actual)) return actual

    let actualSubset = Array.isArray(actual) ? [] : {}
    for (let key of Object.keys(expected)) {
      if (actual.hasOwnProperty(key)) {
        actualSubset[key] = extractObjectSubset(actual[key], expected[key])
      }
    }

    return actualSubset
  }

  assert.deepEqual(extractObjectSubset(actual, expected), expected)
}

export function assertEqualSets (a, b) {
  assert.equal(a.size, b.size, 'Sets are a different size')
  a.forEach(item => assert(b.has(item), 'Sets have different elements'))
}

export function assertEqualSortedArraysByKey (arr1, arr2, key) {
  const sortFn = (a, b) => a[key] < b[key]
  assert.deepEqual(arr1.sort(sortFn), arr2.sort(sortFn))
}

// like `waitsFor` and `waitsForPromise` except you can `await` it
// to suspend/block an `async` test, and you don't have to use `runs`.
// Usage: `await until([description,] [timeout,] fn)`
//    Arguments can be supplied in any order
//
// E.g.:
//
//    await until('a thing happens', () => didThingHappen())
//    expect(thing).toBe(something)
export function until (...args) {
  const start = new Date().getTime()

  let latchFunction = null
  let message = null
  let timeout = null

  if (args.length > 3) {
    throw new Error('until only takes up to 3 args')
  }

  for (let arg of args) {
    switch (typeof arg) {
      case 'function':
        latchFunction = arg
        break
      case 'string':
        message = arg
        break
      case 'number':
        timeout = arg
        break
    }
  }

  message = message || 'something happens'
  timeout = timeout || 5000

  return new Promise((resolve, reject) => {
    const checker = () => {
      const result = latchFunction()
      if (result) return resolve(result)

      const now = new Date().getTime()
      const delta = now - start
      if (delta > timeout) {
        return reject(new Error(`timeout: timed out after ${timeout} msec waiting until ${message}`))
      } else {
        setTimeout(checker)
      }
    }
    checker()
  })
}
