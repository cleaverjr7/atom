# Pull Request Review

## Status

Accepted

## Summary

Give and receive code reviews on pull requests within Atom.

## Motivation

Workflows around pull request reviews involve many trips between your editor and your browser. If you check out a pull request locally to test it and want to leave comments, you need to map the issues that you've found in your working copy back to lines on the diff to comment appropriately. Similarly, when you're given a review, you have to mentally correlate review comments on the diff on GitHub with the corresponding lines in your local working copy, then map _back_ to diff lines to respond once you've established context. By revealing review comments as decorations directly within the editor, we can eliminate all of these round-trips and streamline the review process for all involved.

Peer review is also a critical part of the path to acceptance for pull requests in many common workflows. By surfacing progress through code review, we provide context on the progress of each unit of work alongside existing indicators like commit status.

## Explanation

### Review information in Pull Request list

Review progress is indicated for open pull requests listed in the GitHub panel. The pull request corresponding to the checked out branch gets special treatment in it's own section at the top of the list.

![image](https://user-images.githubusercontent.com/378023/46524357-89bf6580-c8c3-11e8-8e2d-ea02d5a1f278.png)

> :construction: This mockup is still WIP and probably will change.

Clicking a pull request in the list opens a `PullRequestDetailItem` in the workspace center.


### PullRequestDetailItem

#### Header

At the top of each `PullRequestDetailItem` is a summary about the pull request, followed by the tabs to switch between different sub-views.

- Overview
- Files (**new**)
- Reviews (**new**)
- Commits
- Build Status

After the tabs users can search or filter. The default is to show all files, all authors, and unresolved comments. Filtering based on file type, author, search term makes it possible to narrow down a long list of diffs. Toggling comments or collapse files is also possible.

![header](https://user-images.githubusercontent.com/378023/46536358-3829d180-c8e9-11e8-9167-3d1003ab566b.png)

#### Footer

A panel at the bottom of the pane shows the progress for resolved review comments. It also has a "Review Changes" button to create a new review.

![reviews panel](https://user-images.githubusercontent.com/378023/46536010-17ad4780-c8e8-11e8-8338-338bb592efc5.png)

This panel is persistent throught all sub-views. It allows creating a reviews no matter where you are. Below shown with the existing sub-views:

Overview | Commits | Build Status
--- | --- | ---
![overview](https://user-images.githubusercontent.com/378023/46535907-ca30da80-c8e7-11e8-9401-2b8660d56c25.png) | ![commits](https://user-images.githubusercontent.com/378023/46535908-ca30da80-c8e7-11e8-87ca-01637f2554b6.png) | ![build status](https://user-images.githubusercontent.com/378023/46535909-cac97100-c8e7-11e8-8813-47fdaa3ece57.png)


### Files

Under the "Files" tab the full, multi-file diff associated with the pull request is displayed. This is akin to the "Files changed" tab on dotcom. It displays the diff for all changed files in the PR.

![files](https://user-images.githubusercontent.com/378023/46536560-d3bb4200-c8e9-11e8-9764-dca0b84245cf.png)

Review comments are shown within the diff. See ["Comment decorations"](#comment-decorations) for description of review comments.

![review comment](https://user-images.githubusercontent.com/378023/46534569-8fc53e80-c8e3-11e8-8721-b38462b51cc7.png)

Diffs are editable _only_ if the pull request branch is checked out and the local branch history has not diverged from the remote branch history.

### Reviews

Under the "Reviews" tab all reviews of a pull request get shown. This is akin to the review summaries that appear on the "Conversation" tab on dotcom. The comments are displayed grouped by review along with some context lines.

![reviews](https://user-images.githubusercontent.com/378023/46535563-c81a4c00-c8e6-11e8-9c0b-6ea575556101.png)

Comments can be collapsed to get a better overview.

![reviews collapsed](https://user-images.githubusercontent.com/378023/46926357-62a72780-d06b-11e8-9344-23389d1c727c.png)


### Create a new Review

Hovering along the gutter within a pull request diff region in a `TextEditor` or a `PullRequestDetailItem` reveals a `+` icon. Clicking the `+` icon reveals a new comment box, which may be used to submit a single comment or start a multi-comment review:

![new review](https://user-images.githubusercontent.com/378023/46926996-49ec4100-d06e-11e8-9fb7-86607861efdd.png)

* Clicking "Add single comment" submits a diff comment and does not create a draft review.
* Clicking "Start a review" creates a draft review and attaches the authored comment to it.

![pending review](https://user-images.githubusercontent.com/378023/46927357-e06d3200-d06f-11e8-9eae-b4c289fe16ae.png)

* If a draft review is already in progress, the "Start a review" button reads "Add review comment".
* And an additional row is added with options to "Start a new conversation" or "Finish your review".

#### Submit a new Review

Clicking "Finish your review" or "Review Changes" in the footer...

![reviews panel](https://user-images.githubusercontent.com/378023/46536010-17ad4780-c8e8-11e8-8338-338bb592efc5.png)

... expands the footer to:

![submit review](https://user-images.githubusercontent.com/378023/46927736-ef54e400-d071-11e8-99d9-0ea1001fc50d.png)

* The review summary is a TextEditor that may be used to compose a summary comment.
* Files with peding review comments are listed and make it possible to navigate between them.
* A review can be marked as "Comment", "Approve" or "Recommend changes" (.com's "Request changes").
* Choosing "Cancel" dismisses the review and any comments made. If there are local review comments that will be lost, a confirmation prompt is shown first.
* Choosing "Submit review" submits the drafted review to GitHub.

![resolve a review](https://user-images.githubusercontent.com/378023/46927875-c08b3d80-d072-11e8-978b-024111312d79.png)

* Review comments can be resolved by clicking on the "Resolve conversation" buttons. If the "reply..." editor has non-whitespace content, it is submitted as a final comment first.


### Single file diff

Clicking on the `<>` icon in a review comment switches from the multi-file diff to the entire file with diffs. If possible, the scrollposition is retained. This allows to quickly get more context about the code.

![single file diff](https://user-images.githubusercontent.com/378023/46928308-e9accd80-d074-11e8-8de3-a16140e74907.png)

Clicking the `file+-`  icon, switches back to the multi-file diff.

** :question: Open question:** Should there be a way to switch to the file without a diff? Should the inline comment still be shown only an icon or nothing?


---

:point_down: TODO

---

### Comment decorations

Within the multi-file diff view or a TextEditor, a block decoration is used to show the comment content at the corresponding position within the file content.

* The comment's position is calculated from the position acquired by the GitHub API response, modified based on the git diff of that file (following renames) between the owning review's attached commit and the current state of the working copy (including any local modifications). Once created, the associated marker will also track unsaved modifications to the file in real time.
* The up and down arrow buttons navigate to the next and previous review comments.
* For comment decorations in the `PullRequestDetailItem`, clicking the "code" (`<>`) button opens the corresponding file in a TextEditor and scrolls to the review comment decoration there.
  * If the current pull request is not checked out, the "code" button is disabled, and a tooltip prompts the user to check out the pull request to edit the source.
* For comment decorations within a `TextEditor`, clicking the "diff" button opens the corresponding `PullRequestDetailItem` and scrolls to focus the equivalent comment.
* Reaction emoji may be added to each comment with the "emoji" button. Existing emoji reaction tallies are included beneath each comment.

## Drawbacks

This adds a substantial amount of complexity to the UI, which is only justified for users that use GitHub pull request reviews.

Rendering pull request comments within TextEditors can be intrusive: if there are many, or if your reviewers are particularly verbose, they could easily crowd out the code that you're trying to write and obscure your context.

## Rationale and alternatives

Our original design looked and felt very dotcom-esque:

![changes-tab](https://user-images.githubusercontent.com/378023/46287431-6e9bdf80-c5bd-11e8-99eb-f3f81ba64e81.png)

We decided to switch to an editor-first approach and build the code review experience around an actual TextEditor item with a custom diff view. We are breaking free of the dotcom paradigm and leveraging the fact that we are in the context of the user's working directory, where we can easily update code.

We discussed displaying review summary information in the GitHub panel in a ["Current pull request tile"](https://github.com/atom/github/blob/2ab74b59873c3b5bccac7ef679795eb483b335cf/docs/rfcs/XXX-pull-request-review.md#current-pull-request-tile). The current design encapsulates all of the PR information and functionality within a `PullRequestDetailItem`. Keeping the GitHub panel free of PR details for a specific PR rids us of the problem of having to keep it updated when the user switches active repos (which can feel jarring). This also avoids confusing the user by showing PR details for different PRs (imagine the checked out PR info in the panel and a pane item with PR info for a separate repo). We also free up space in the GitHub panel, making it less busy/overwhelming and leaving room for other information we might want to provide there in the future (like associated issues, say).

## Unresolved questions

### Questions I expect to address before this is merged

Can we access "draft" reviews from the GitHub API, to unify them between Atom and GitHub?

* _Yes, the `reviews` object includes it in a `PENDING` state._

How do we represent the resolution of a comment thread? Where can we reveal this progress through each review, and of all required reviews?

* _We'll show a progress bar on a sticky header at the top of the `PullRequestDetailItem`._

Are there any design choices we can make to lessen the emotional weight of a "requests changes" review? Peer review has the most value when it discovers issues for the pull request author to address, but accepting criticism is a vulnerable moment.

* _Choosing phrasing and iconography carefully for "recommend changes"._

Similarly, are there any ways we can encourage empathy within the review authoring process? Can we encourage reviewers to make positive comments or demonstrate humility and open-mindedness?

* _Emoji reactions on comments :cake: :tada:_
* _Enable integration with Teletype for smoother jumping to a synchronous review_

### Questions I expect to resolve throughout the implementation process

When there are working directory changes or local commits on the PR branch, how do we clearly indicate them within the diff view? Do we need to make them visually distinct from the PR changes? Things might get confusing for the user when the diff in the editor gets out of sync with the diff on dotcom. For example: a pull request author reads a comment pointing out a typo in an added line. The author edits text within the multi-file diff which modifies the working directory. Should this line now be styled differently to indicate that it has deviated from the original diff?

Review comment positioning within live TextEditors will be a tricky problem to address satisfactorily. What are the edge cases we need to handle there?

* _Review comments on deleted lines._
* _Review comments on deleted files._

The GraphQL API paths we need to interact with all involve multiple levels of pagination: pull requests, pull request reviews, review comments. How do we handle these within Relay? Or do we interact directly with GraphQL requests?

How do we handle comment threads?

When editing diffs:

* Do we edit the underlying buffer or file directly, or do we mark the `PullRequestDetailItem` as "modified" and require a "save" action to persist changes?
* Do we disallow edits of removed lines, or do we re-introduce the removed line as an addition on modification?

### Questions I consider out of scope of this RFC

What other pull request information can we add to the GitHub pane item?

How can we notify users when new information, including reviews, is available, preferably without being intrusive or disruptive?

## Implementation phases

![dependency-graph](https://user-images.githubusercontent.com/17565/46475622-019e6a80-c7b4-11e8-9bf5-8223d5c6631f.png)

## Related features out of scope of this RFC

* "Find" input field for filtering based on search term (which could be a file name, an author, a variable name, etc)
