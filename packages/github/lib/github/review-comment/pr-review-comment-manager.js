'use babel'

import FileReviewCommentManager from './file-review-comment-manager'
import EditorReviewCommentRenderer from './editor-review-comment-renderer'

import {CompositeDisposable} from 'atom'

function isEditor (item) {
  return item && item.getPath
}

function getForegroundEditors () {
  return atom.workspace.getPanes()
    .map(pane => pane.getActiveItem())
    .filter(item => isEditor(item))
}

function groupBy (items, fieldGetter) {
  if (typeof fieldGetter === 'string') {
    const prop = fieldGetter
    fieldGetter = (item) => item[prop]
  }
  const itemsByField = new Map()
  items.forEach(item => {
    const field = fieldGetter(item)
    const arr = itemsByField.get(field) || []
    arr.push(item)
    itemsByField.set(field, arr)
  })
  return itemsByField
}

export default class PrReviewCommentManager {
  constructor (gitHubModel, commentEmitter) {
    this.gitHubModel = gitHubModel
    this.commentEmitter = commentEmitter
    this.fileCommentManagersByPath = new Map()
    this.timeoutId = null
    this.commentsByPath = new Map()
    this.firstLoad = true
    this.addSubscriptions()
    this.nextFetch()
  }

  async relativizePath (path) {
    const repo = await this.gitHubModel.getRepo()
    return await repo.relativizeToWorkingDirectory(path)
  }

  addSubscriptions () {
    this.subscriptions = new CompositeDisposable()
    this.subscriptions.add(
      atom.workspace.observeActivePaneItem(async (item) => {
        if (isEditor(item)) { this.renderEditorComments(item) }
      }),
      atom.workspace.onDidDestroyPaneItem(async ({item}) => {
        if (isEditor(item)) { this.destroyEditorReviewCommentRenderer(item) }
      })
    )
  }

  renderEditorComments (editor) {
    clearTimeout(this.timeoutId)
    this.nextFetch()
  }

  async nextFetch () {
    if (this.fetching) return
    this.fetching = true
    await this.fetchComments()
    this.fetching = false

    const wait = atom.config.get('github.maxCacheAge') || 1000 * 60
    this.timeoutId = setTimeout(() => {
      this.nextFetch()
    }, wait)
  }

  async fetchComments () {
    const repoComments = await this.gitHubModel.getBufferComments()

    const prComments = this.getCommentsForUrl(repoComments)
    this.commentsByPath = groupBy(prComments, 'path')
    this.onFetchedComments()
  }

  getCommentsForUrl (repoComments) {
    const pullRequest = this.gitHubModel.getPullRequestForCurrentBranch()
    const pullRequestUrl = pullRequest ? pullRequest.url : null
    const prComments = repoComments.filter(comment => {
      return comment.pull_request_url === pullRequestUrl
    })
    return prComments
  }

  onFetchedComments () {
    const editorsByPath = groupBy(getForegroundEditors(), (e) => e.getPath())

    editorsByPath.forEach(async (editors, path) => {
      // If all comments in a file are deleted, be sure to pass empty array
      path = await this.relativizePath(path)
      const comments = this.commentsByPath.get(path) || []
      editors.forEach(editor => EditorReviewCommentRenderer.renderCommentsForEditor(comments, editor))
    })

    this.commentsByPath.forEach((comments, path) => {
      this.getFileCommentManager(path).setComments(comments, {suppress: this.firstLoad})
    })
    this.firstLoad = false
  }

  async destroyEditorReviewCommentRenderer (editor) {
    EditorReviewCommentRenderer.destroyRendererForEditor(editor)
  }

  getFileCommentManager (path) {
    let manager = this.fileCommentManagersByPath.get(path)
    if (!manager) {
      manager = new FileReviewCommentManager(path, this.commentEmitter)
      this.fileCommentManagersByPath.set(path, manager)
    }
    return manager
  }

  destroy () {
    clearTimeout(this.timeoutId)
    this.subscriptions.dispose()
  }
}
