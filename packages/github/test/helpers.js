/** @babel */

import fs from 'fs-extra'
import path from 'path'
import temp from 'temp'
import {GitRepositoryAsync} from 'atom'

import Repository from '../lib/repository'

export function copyRepositoryDir (variant = 1) {
  const workingDirPath = temp.mkdirSync('git-fixture-')
  fs.copySync(path.join(__dirname, 'fixtures', 'repository-' + variant), workingDirPath)
  fs.renameSync(path.join(workingDirPath, 'dot-git'), path.join(workingDirPath, '.git'))
  return fs.realpathSync(workingDirPath)
}

export async function buildRepository (workingDirPath) {
  let atomRepository = GitRepositoryAsync.open(workingDirPath)
  let rawRepository = await atomRepository.repo.repoPromise
  return new Repository(rawRepository)
}
