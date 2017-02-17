import fs from 'fs-extra';
import path from 'path';
import temp from 'temp';

import React from 'react';
import ReactDom from 'react-dom';
import sinon from 'sinon';

import Repository from '../lib/models/repository';
import GitShellOutStrategy from '../lib/git-shell-out-strategy';

assert.autocrlfEqual = (actual, expected, ...args) => {
  const newActual = actual.replace(/\r\n/g, '\n');
  const newExpected = expected.replace(/\r\n/g, '\n');
  return assert.equal(newActual, newExpected, ...args);
};

// cloning a repo into a folder and then copying it
// for each subsequent request to clone makes cloning
// 2-3x faster on macOS and 5-10x faster on Windows
const cachedClonedRepos = {};
function copyCachedRepo(repoName) {
  const workingDirPath = temp.mkdirSync('git-fixture-');
  fs.copySync(cachedClonedRepos[repoName], workingDirPath);
  return fs.realpathSync(workingDirPath);
}

export async function cloneRepository(repoName = 'three-files') {
  if (!cachedClonedRepos[repoName]) {
    const cachedPath = temp.mkdirSync('git-fixture-cache-');
    const git = new GitShellOutStrategy(cachedPath);
    await git.clone(path.join(__dirname, 'fixtures', `repo-${repoName}`, 'dot-git'));
    await git.exec(['config', '--local', 'core.autocrlf', 'false']);
    await git.exec(['checkout', '--', '.']); // discard \r in working directory
    cachedClonedRepos[repoName] = cachedPath;
  }
  return copyCachedRepo(repoName);
}

/*
 * Copy a fixture repository into a temporary working directory as-is, preserving working copy changes.
 */
export function copyRepository(repoName) {
  const workingDirPath = temp.mkdirSync('git-fixture-');
  const repoPath = path.join(__dirname, 'fixtures', `repo-${repoName}`);
  fs.copySync(repoPath, workingDirPath);
  fs.renameSync(path.join(workingDirPath, 'dot-git'), path.join(workingDirPath, '.git'));
  return fs.realpathSync(workingDirPath);
}

export async function setUpLocalAndRemoteRepositories(repoName = 'multiple-commits', options = {}) {
  /* eslint-disable no-param-reassign */
  if (typeof repoName === 'object') {
    options = repoName;
    repoName = 'multiple-commits';
  }
  /* eslint-enable no-param-reassign */
  const baseRepoPath = await cloneRepository(repoName);
  const baseGit = new GitShellOutStrategy(baseRepoPath);

  // create remote bare repo with all commits
  const remoteRepoPath = temp.mkdirSync('git-remote-fixture-');
  const remoteGit = new GitShellOutStrategy(remoteRepoPath);
  await remoteGit.clone(baseRepoPath, {bare: true});

  // create local repo with one fewer commit
  if (options.remoteAhead) { await baseGit.exec(['reset', 'head~']); }
  const localRepoPath = temp.mkdirSync('git-local-fixture-');
  const localGit = new GitShellOutStrategy(localRepoPath);
  await localGit.clone(baseRepoPath);
  await localGit.exec(['remote', 'set-url', 'origin', remoteRepoPath]);
  return {baseRepoPath, remoteRepoPath, localRepoPath};
}

export async function getHeadCommitOnRemote(remotePath) {
  const workingDirPath = temp.mkdirSync('git-fixture-');
  const git = new GitShellOutStrategy(workingDirPath);
  await git.clone(remotePath);
  return git.getHeadCommit();
}

export function buildRepository(workingDirPath) {
  return Repository.open(workingDirPath);
}

export function assertDeepPropertyVals(actual, expected) {
  function extractObjectSubset(actualValue, expectedValue) {
    if (actualValue !== Object(actualValue)) { return actualValue; }

    const actualSubset = Array.isArray(actualValue) ? [] : {};
    for (const key of Object.keys(expectedValue)) {
      if (actualValue.hasOwnProperty(key)) {
        actualSubset[key] = extractObjectSubset(actualValue[key], expectedValue[key]);
      }
    }

    return actualSubset;
  }

  assert.deepEqual(extractObjectSubset(actual, expected), expected);
}

export function assertEqualSets(a, b) {
  assert.equal(a.size, b.size, 'Sets are a different size');
  a.forEach(item => assert(b.has(item), 'Sets have different elements'));
}

export function assertEqualSortedArraysByKey(arr1, arr2, key) {
  const sortFn = (a, b) => a[key] < b[key];
  assert.deepEqual(arr1.sort(sortFn), arr2.sort(sortFn));
}

let activeRenderers = [];
export function createRenderer() {
  let instance;
  let lastInstance;
  let node = document.createElement('div');
  // ref function should be reference equal over renders to avoid React
  // calling the "old" one with `null` and the "new" one with the instance
  const setTopLevelRef = c => { instance = c; };
  const renderer = {
    render(appWithoutRef) {
      lastInstance = instance;
      const app = React.cloneElement(appWithoutRef, {ref: setTopLevelRef});
      ReactDom.render(app, node);
    },

    get instance() {
      return instance;
    },

    get lastInstance() {
      return lastInstance;
    },

    get node() {
      return node;
    },

    unmount() {
      if (node) {
        lastInstance = instance;
        ReactDom.unmountComponentAtNode(node);
        node = null;
      }
    },
  };
  activeRenderers.push(renderer);
  return renderer;
}

// eslint-disable-next-line jasmine/no-global-setup
beforeEach(function() {
  global.sinon = sinon.sandbox.create();
});

// eslint-disable-next-line jasmine/no-global-setup
afterEach(function() {
  activeRenderers.forEach(r => r.unmount());
  activeRenderers = [];
  global.sinon.restore();
});
