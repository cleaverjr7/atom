/* @flow */

import {Emitter} from 'atom'

import type {Point} from 'atom'
import type GitStore from './git-store'

export const SummaryPreferredLength = 50

export default class CommitBoxViewModel {
  emitter: Emitter;
  gitStore: GitStore;
  branchName: string;

  constructor (gitStore: GitStore) {
    this.emitter = new Emitter()
    this.gitStore = gitStore
  }

  getBranchName (): string { return this.gitStore.branchName }

  commit (message: string): Promise<void> {
    return this.gitStore.commit(message)
  }

  calculateRemainingCharacters (msg: string, cursorPosition: Point): number {
    const editingState = getMessageEditingState(msg, cursorPosition)
    if (editingState === 'summary') {
      const lines = msg.split('\n')
      const len = lines[0].length
      return SummaryPreferredLength - len
    } else {
      return Infinity
    }
  }
}

function getMessageEditingState (msg: string, cursorPosition: Point): 'summary' | 'description' {
  if (cursorPosition.row === 0) return 'summary'

  const parts = msg.split('\n')
  if (parts.length < 3) return 'summary'

  return 'description'
}
