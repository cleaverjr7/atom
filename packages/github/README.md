# Atom GitHub Package

[![Build Status](https://travis-ci.com/atom/github.svg?token=RwrCnzpsZN5oEq5S5p7V&branch=master)](https://travis-ci.com/atom/github)
[![Build status](https://ci.appveyor.com/api/projects/status/psctk8vrva49dseb/branch/master?svg=true)](https://ci.appveyor.com/project/Atom/github/branch/master)

The Atom GitHub package provides Git and GitHub integration for Atom.

## Installation

**NOTE: This package requires that you're on Atom v1.13.0 or above**

You may install the GitHub package via the Atom GUI or via the command line.

**Settings View**

In settings view, click "Install," enter `atom/github` in the search field, and press enter. In the installation card that appears, click "Install."

![Installation via settings view](./docs/install-settings-view.png)


**Command Line**

Run `apm install atom/github`.

## Keyboard Shortcuts

The default keyboard shortcuts are:

* `ctrl-9` :point_right: Show/hide the Git panel
* `ctrl-shift-9` :point_right: Toggle Git panel focus

From within the Git panel:

* `enter` :point_right: Stage/unstage the currently selected file
* `cmd/ctrl-enter` :point_right: Commit (or move to the commit box)
* `tab` :point_right: Focus the next list/commit box
* `shift-tab` :point_right: Focus the previous list

From within a diff view:

* `/` :point_right: Toggle between selection of hunks and lines
* `tab` :point_right: Move to the next hunk
* `shift-tab` :point_right: Move to the previous hunk
* `enter` :point_right: Stage/unstage the currently selected hunk or line

## Feedback

Please feel free to post your comments, feedback, and issues [in the GitHub repository](https://github.com/atom/github/issues).

## Current Status

This package is currently :construction: under heavy development. :construction: The following checked features are done, while others are in the works or are planned for the future:

**Git**

- [x] Stage files/hunks/lines
- [x] Unstage files/hunks/lines
- [x] Discard changed files/hunks/lines
- [x] Create commits
- [x] Amend last commit
- [x] Sign commits
- [x] Change branches
- [x] Create new branches
- [x] Push/pull/fetch
- [x] Abort merges
- [x] Resolve merge conflicts via special UI

**GitHub**

- [x] Show current PR details
- [ ] Open a new PR
- [ ] Show PR comments inline in the editor
- [ ] Edit PRs
- [ ] Create/edit PR comments
- [ ] Perform GitHub.com code reviews from within Atom
- [ ] Merge/close PRs


## License

GitHub® and its stylized versions and the Invertocat mark are GitHub's Trademarks or registered Trademarks. When using GitHub's logos, be sure to follow the GitHub [logo guidelines](https://github.com/logos).
