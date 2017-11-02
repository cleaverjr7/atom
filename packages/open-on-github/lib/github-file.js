/** @babel */

import {shell} from 'electron'
import {Range} from 'atom'
import {parse as parseURL} from 'url'
import path from 'path'

export default class GitHubFile {
  // Public
  static fromPath (filePath) {
    return new GitHubFile(filePath)
  }

  constructor (filePath) {
    this.filePath = filePath
    const [rootDir] = atom.project.relativizePath(this.filePath)

    if (rootDir != null) {
      const rootDirIndex = atom.project.getPaths().indexOf(rootDir)
      this.repo = atom.project.getRepositories()[rootDirIndex]
    }
  }

  // Public
  open (lineRange) {
    if (this.validateRepo()) {
      this.openURLInBrowser(this.blobURL() + this.getLineRangeSuffix(lineRange))
    }
  }

  // Public
  openOnMaster (lineRange) {
    if (this.validateRepo()) {
      this.openURLInBrowser(this.blobURLForMaster() + this.getLineRangeSuffix(lineRange))
    }
  }

  // Public
  blame (lineRange) {
    if (this.validateRepo()) {
      this.openURLInBrowser(this.blameURL() + this.getLineRangeSuffix(lineRange))
    }
  }

  history () {
    if (this.validateRepo()) {
      this.openURLInBrowser(this.historyURL())
    }
  }

  copyURL (lineRange) {
    if (this.validateRepo()) {
      atom.clipboard.write(this.shaURL() + this.getLineRangeSuffix(lineRange))
    }
  }

  openBranchCompare () {
    if (this.validateRepo()) {
      this.openURLInBrowser(this.branchCompareURL())
    }
  }

  openIssues () {
    if (this.validateRepo()) {
      this.openURLInBrowser(this.issuesURL())
    }
  }

  openPullRequests () {
    if (this.validateRepo()) {
      this.openURLInBrowser(this.pullRequestsURL())
    }
  }

  openRepository () {
    if (this.validateRepo()) {
      this.openURLInBrowser(this.githubRepoURL())
    }
  }

  getLineRangeSuffix (lineRange) {
    if (lineRange && !this.isGitHubWikiURL(this.githubRepoURL()) && atom.config.get('open-on-github.includeLineNumbersInUrls')) {
      lineRange = Range.fromObject(lineRange)
      const startRow = lineRange.start.row + 1
      const endRow = lineRange.end.row + 1

      if (startRow === endRow) {
        if (this.isGistURL(this.githubRepoURL())) {
          return `-L${startRow}`
        } else {
          return `#L${startRow}`
        }
      } else {
        if (this.isGistURL(this.githubRepoURL())) {
          return `-L${startRow}-L${endRow}`
        } else {
          return `#L${startRow}-L${endRow}`
        }
      }
    } else {
      return ''
    }
  }

  // Internal
  validateRepo () {
    if (!this.repo) {
      atom.notifications.addWarning(`No repository found for path: ${this.filePath}.`)
      return false
    } else if (!this.gitURL()) {
      atom.notifications.addWarning(`No URL defined for remote: ${this.remoteName()}`)
      return false
    } else if (!this.githubRepoURL()) {
      atom.notifications.addWarning(`Remote URL is not hosted on GitHub: ${this.gitURL()}`)
      return false
    }
    return true
  }

  // Internal
  openURLInBrowser (url) {
    shell.openExternal(url)
  }

  // Internal
  blobURL () {
    const gitHubRepoURL = this.githubRepoURL()
    const repoRelativePath = this.repoRelativePath()

    if (this.isGitHubWikiURL(gitHubRepoURL)) {
      return `${gitHubRepoURL.slice(0, -5)}/wiki/${this.extractFileName(repoRelativePath)}`
    } else if (this.isGistURL(gitHubRepoURL)) {
      return `${gitHubRepoURL}#file-${this.encodeSegments(repoRelativePath.replace(/\./g, '-'))}`
    } else {
      return `${gitHubRepoURL}/blob/${this.remoteBranchName()}/${this.encodeSegments(repoRelativePath)}`
    }
  }

  // Internal
  blobURLForMaster () {
    if (this.isGistURL(this.githubRepoURL())) {
      return this.blobURL() // Gists do not have branches
    } else {
      return `${this.githubRepoURL()}/blob/master/${this.encodeSegments(this.repoRelativePath())}`
    }
  }

  // Internal
  shaURL () {
    const gitHubRepoURL = this.githubRepoURL()
    const encodedSHA = this.encodeSegments(this.sha())
    const repoRelativePath = this.repoRelativePath()

    if (this.isGistURL(gitHubRepoURL)) {
      return `${gitHubRepoURL}/${encodedSHA}#file-${this.encodeSegments(repoRelativePath.replace(/\./g, '-'))}`
    } else {
      return `${gitHubRepoURL}/blob/${encodedSHA}/${this.encodeSegments(repoRelativePath)}`
    }
  }

  // Internal
  blameURL () {
    return `${this.githubRepoURL()}/blame/${this.remoteBranchName()}/${this.encodeSegments(this.repoRelativePath())}`
  }

  // Internal
  historyURL () {
    const gitHubRepoURL = this.githubRepoURL()

    if (this.isGistURL(gitHubRepoURL)) {
      return `${gitHubRepoURL}/revisions`
    } else {
      return `${gitHubRepoURL}/commits/${this.remoteBranchName()}/${this.encodeSegments(this.repoRelativePath())}`
    }
  }

  // Internal
  issuesURL () {
    return `${this.githubRepoURL()}/issues`
  }

  // Internal
  pullRequestsURL () {
    return `${this.githubRepoURL()}/pulls`
  }

  // Internal
  branchCompareURL () {
    return `${this.githubRepoURL()}/compare/${this.encodeSegments(this.branchName())}`
  }

  encodeSegments (segments = '') {
    return segments.split('/').map(segment => encodeURIComponent(segment)).join('/')
  }

  // Internal
  extractFileName (relativePath = '') {
    return path.parse(relativePath).name
  }

  // Internal
  gitURL () {
    const remoteName = this.remoteName()
    if (remoteName != null) {
      return this.repo.getConfigValue(`remote.${remoteName}.url`, this.filePath)
    } else {
      return this.repo.getConfigValue(`remote.origin.url`, this.filePath)
    }
  }

  // Internal
  githubRepoURL () {
    let url = this.gitURL()

    if (url.match(/git@[^:]+:/)) {
      url = url.replace(/^git@([^:]+):(.+)$/, (match, host, repoPath) => {
        repoPath = repoPath.replace(/^\/+/, '')
        return `http://${host}/${repoPath}`
      })
    } else if (url.match(/ssh:\/\/git@([^/]+)\//)) {
      url = `http://${url.substring(10)}`
    } else if (url.match(/^git:\/\/[^/]+\//)) {
      url = `http${url.substring(3)}`
    }

    // Remove trailing .git and trailing slashes
    url = url.replace(/\.git$/, '').replace(/\/+$/, '')

    if (!this.isBitbucketURL(url)) {
      return url
    }
  }

  isGistURL (url) {
    try {
      const {host} = parseURL(url)

      return host === 'gist.github.com'
    } finally {}
  }

  isGitHubWikiURL (url) {
    return /\.wiki$/.test(url)
  }

  isBitbucketURL (url) {
    if (url.startsWith('git@bitbucket.org')) {
      return true
    }

    try {
      const {host} = parseURL(url)

      return host === 'bitbucket.org'
    } finally {}
  }

  // Internal
  repoRelativePath () {
    return this.repo.getRepo(this.filePath).relativize(this.filePath)
  }

  // Internal
  remoteName () {
    const gitConfigRemote = this.repo.getConfigValue('atom.open-on-github.remote', this.filePath)

    if (gitConfigRemote) {
      return gitConfigRemote
    }

    const shortBranch = this.repo.getShortHead(this.filePath)

    if (!shortBranch) {
      return null
    }

    const branchRemote = this.repo.getConfigValue(`branch.${shortBranch}.remote`, this.filePath)

    if (branchRemote && branchRemote.length > 0) {
      return branchRemote
    }

    return null
  }

  // Internal
  sha () {
    return this.repo.getReferenceTarget('HEAD', this.filePath)
  }

  // Internal
  branchName () {
    const shortBranch = this.repo.getShortHead(this.filePath)

    if (!shortBranch) {
      return null
    }

    const branchMerge = this.repo.getConfigValue(`branch.${shortBranch}.merge`, this.filePath)
    if (!(branchMerge && branchMerge.length > 11)) {
      return shortBranch
    }

    if (branchMerge.indexOf('refs/heads/') !== 0) {
      return shortBranch
    }

    return branchMerge.substring(11)
  }

  // Internal
  remoteBranchName () {
    const gitConfigBranch = this.repo.getConfigValue('atom.open-on-github.branch', this.filePath)

    if (gitConfigBranch) {
      return gitConfigBranch
    } else if (this.remoteName() != null) {
      return this.encodeSegments(this.branchName())
    } else {
      return 'master'
    }
  }
}
