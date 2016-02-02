/** @babel */

import path from 'path'
import FileList from '../lib/file-list'
import HunkLine from '../lib/hunk-line'
import GitService from '../lib/git-service'
import temp from 'temp'
import fs from 'fs-plus'

temp.track()

function copyRepository (name = 'test-repo') {
  const workingDirPath = temp.mkdirSync('git-prototype-fixture')
  fs.copySync(path.join(__dirname, 'fixtures', name), workingDirPath)
  fs.renameSync(path.join(workingDirPath, 'git.git'), path.join(workingDirPath, '.git'))
  return fs.realpathSync(workingDirPath)
}

describe("HunkLine", function() {
  let fileList = null
  let repoPath = null

  const fileName = 'README.md'
  let filePath = null

  beforeEach(() => {
    repoPath = copyRepository()

    filePath = path.join(repoPath, fileName)
    fs.writeFileSync(filePath, "i'm new here\n")

    // TODO: This makes me feel gross inside.
    GitService.instance().repoPath = repoPath

    fileList = new FileList()
    waitsForPromise(() => fileList.loadFromGitUtils())
  })

  it("roundtrips toString and fromString", function() {
    let line = '  89 --- - # default, the type it should be, etc. A simple example:'
    let hunkLine = HunkLine.fromString(line)
    expect(hunkLine.toString()).toEqual(line)

    line = '  435 432         scopeDescriptor = options.scope'
    hunkLine = HunkLine.fromString(line)
    expect(hunkLine.toString()).toEqual(line)

    line = '  --- 434 +     # Some new linesssss'
    hunkLine = HunkLine.fromString(line)
    expect(hunkLine.toString()).toEqual(line)

    line = '✓ --- 434 +     # Some new linesssss'
    hunkLine = HunkLine.fromString(line)
    expect(hunkLine.toString()).toEqual(line)

    line = '  85 85   #'
    hunkLine = HunkLine.fromString(line)
    expect(hunkLine.toString()).toEqual(line)
  })

  fit("can be staged and unstaged with ::stage() and ::unstage()", function() {
    const diff = fileList.getFileDiffFromPathName(fileName)
    expect(diff).not.toBeUndefined()

    const hunks = diff.getHunks()
    expect(hunks.length).toEqual(1)

    const hunk = hunks[0]
    const lines = hunk.getLines()
    expect(lines.length).toEqual(21)

    const line = lines[0]
    expect(line.isStaged()).toEqual(false)
    console.log(line)

    waitsForPromise(() => line.stage())
    runs(() => {
      console.log('heyoo!')
      console.log(repoPath)
      expect(line.isStaged()).toEqual(true)
    })

    // waitsForPromise(() => line.unstage())
    // runs(() => {
    //   console.log('heyoo!')
    //   console.log(repoPath)
    //   expect(line.isStaged()).toEqual(false)
    // })
    // let hunkLine = HunkLine.fromString('  89 --- - # a comment')
    // expect(hunkLine.isStaged()).toEqual(false)
    //
    // hunkLine.stage()
    // expect(hunkLine.isStaged()).toEqual(true)
    //
    // hunkLine.unstage()
    // expect(hunkLine.isStaged()).toEqual(false)
  })
})
