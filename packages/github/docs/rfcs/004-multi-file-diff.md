# Commit Preview & Multi-file Diffs

## :tipping_hand_woman: Status

Proposed

## :memo: Summary

Give users an option to, before they make a commit, see diffs of all staged changes in one view, akin to the [`Files changed` tab in pull requests on github.com](https://github.com/atom/github/pull/1753/files).

## :checkered_flag: Motivation

So that users can view a full set of changes with more context before committing them.

Note that the multi-diff view is the MVP of this RFC, and we have identified `Commit Preview` to be the least frictional way to introduce this feature without making too many UX changes. Other planned features that will also make use of multi-diff view are:

- [commit pane item](#1655) where it shows all changes in a single commit
- [new PR review flow](https://github.com/atom/github/blob/master/docs/rfcs/003-pull-request-review.md) that shows all changed files proposed in a PR
- (TBD) multi-select files from unstaged & staged panes to view diffs


## 🤯 Explanation

![staged changes](https://user-images.githubusercontent.com/378023/47497740-0a0b3200-d896-11e8-85af-7c644af9ca37.png)

#### Commit preview button
A new button added above the commit message box that, when clicked, opens a multi-file diff pane item called something like "Commit Preview" and shows a summary of what will go into the user's next commit based on what is currently staged.

#### Multi-file diff view

- Shows diffs of multiple files as a stack.
- Each diff retains the file-specific controls it currently has in its header (e.g. the open file, stage file, undo last discard, etc).
- **[[out of scope](https://github.com/atom/github/blob/multi-diff-rfc/docs/rfcs/004-multi-file-diff.md#out-of-scope)]** It should be easy to jump quickly to a specific file you care about, or back to the file list to get to another file. Dotcom does so by creating a `jump to` drop down.
- As user scrolls through a long list of diffs, there should be a sticky heading which remains visible showing the filename of the diff being viewed.
- **[[out of scope](https://github.com/atom/github/blob/multi-diff-rfc/docs/rfcs/004-multi-file-diff.md#out-of-scope)]** Each file diff can be collapsed.

#### Workflow
This would be a nice addition to the top-to-bottom flow that currently exists in our panel:
1. View unstaged changes
2. Stage changes to be committed
3. :new: Click "Commit Preview" :new:
4. Write commit message that summarizes all changes
5. Hit commit button
6. See commit appear in recent commits list
7. Profit :tada:


## :anchor: Drawbacks

- There might be performance concerns having to render many diffs at once.

## :thinking: Rationale and alternatives

An alternative would be to _not_ implement multi-file diff, as other editors like VS Code also only has per-file diff at the time of writing. However, not implementing this would imply that [the proposed new PR review flow](https://github.com/atom/github/blob/master/docs/rfcs/003-pull-request-review.md) will have to find another solution to display all changes in a PR. Additionally users would have to do a lot more clicking to view all of their changes. Imagine there was a variable rename and only 10 lines are changed, but they are each in a different file. It'd be a bit of a pain to click through to view each one. Also, if we didn't implement multi-file diffs then we couldn't show commit contents since they often include changes across multiple files.

## :question: Unresolved questions

How exactly do we construct the multi-file diffs? Do we have one TextEditor component that has different sections for each file. Or do we create a new type of pane item that contains multiple TextEditor components stacked on top of one another, one for each file diff... If we do the former we could probably get something shipped sooner (we could just get the diff of the staged changes from Git, add a special decoration for file headers, and present all the changes in one editor). But to pave the way for a more complex code review UX I think taking extra time to do the latter will serve us well. For example, I can imagine reviewers wanting to collapse some files, or mark them as "Done", in which case it would be easier if we treated each diff as its own component.


## :warning: Out of Scope

The following items are considered out of scope for this RFC, but can be addressed in the future independently of this RFC.

#### Collapsable Diff
It would be cool if each diff was collapsable. Especially for when we start using the multi-file diff for code review and the reviewers may want to hide the contents of a file once they're done addressing the changes in it. "Collapse/Expand All" capabilities would be nice as well.

All files collapsed | Some files collapsed
--- | ---
![all collapsed](https://user-images.githubusercontent.com/378023/47497741-0a0b3200-d896-11e8-90b5-4153009f80b4.png) | ![some collapsed](https://user-images.githubusercontent.com/378023/47498408-27410000-d898-11e8-8e4b-c02dafe7e35a.png)

#### File filter for diff view
"Find" input field for filtering diffs based on search term (which could be a file name, an author, a variable name, etc). See [this section](https://github.com/atom/github/blob/master/docs/rfcs/003-pull-request-review.md#sort-options) in PR review RFC for more details.

#### Other out of scope UX considerations
- whether `cmd+click` to select multiple files is discoverable

## :construction: Implementation phases
TBD

## :white_check_mark: Definition of done
TBD
