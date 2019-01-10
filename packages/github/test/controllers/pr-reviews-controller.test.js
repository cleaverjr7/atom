import React from 'react';
import {shallow} from 'enzyme';
import {reviewBuilder} from '../builder/pr';

import PullRequestReviewsController from '../../lib/controllers/pr-reviews-controller';

import {PAGE_SIZE, PAGINATION_WAIT_TIME_MS} from '../../lib/helpers';

describe('PullRequestReviewsController', function() {
  function buildApp(opts, overrideProps = {}) {
    const o = {
      relayHasMore: () => { return false; },
      relayLoadMore: () => {},
      relayIsLoading: () => { return false; },
      reviewSpecs: [],
      reviewStartCursor: 0,
      ...opts,
    };

    const reviews = {
      edges: o.reviewSpecs.map((spec, i) => ({
        cursor: `result${i}`,
        node: {
          id: spec.id,
          __typename: 'review',
        },
      })),
      pageInfo: {
        startCursor: `result${o.reviewStartCursor}`,
        endCursor: `result${o.reviewStartCursor + o.reviewSpecs.length}`,
        hasNextPage: o.reviewStartCursor + o.reviewSpecs.length < o.reviewItemTotal,
        hasPreviousPage: o.reviewStartCursor !== 0,
      },
      totalCount: o.reviewItemTotal,
    };

    const props = {
      relay: {
        hasMore: o.relayHasMore,
        loadMore: o.relayLoadMore,
        isLoading: o.relayIsLoading,
      },

      switchToIssueish: () => {},
      getBufferRowForDiffPosition: () => {},
      pullRequest: {reviews},
      ...overrideProps,
    };
    return <PullRequestReviewsController {...props} />;
  }
  it('returns null if props.pullRequest is falsy', function() {
    const wrapper = shallow(buildApp({}, {pullRequest: null}));
    assert.isNull(wrapper.getElement());
  });

  it('returns null if props.pullRequest.reviews is falsy', function() {
    const wrapper = shallow(buildApp({}, {pullRequest: {reviews: null}}));
    assert.isNull(wrapper.getElement());
  });

  it('renders a PullRequestReviewCommentsContainer for every review', function() {
    const review1 = reviewBuilder().build();
    const review2 = reviewBuilder().build();

    const reviewSpecs = [review1, review2];
    const wrapper = shallow(buildApp({reviewSpecs}));
    const containers = wrapper.find('ForwardRef(Relay(BarePullRequestReviewCommentsContainer))');
    assert.strictEqual(containers.length, 2);

    assert.strictEqual(containers.at(0).prop('review').id, review1.id);
    assert.strictEqual(containers.at(1).prop('review').id, review2.id);
  });

  it('renders a PullRequestReviewCommentsView and passes props through', function() {
    const review1 = reviewBuilder().build();
    const review2 = reviewBuilder().build();

    const reviewSpecs = [review1, review2];
    const passThroughProp = 'I only exist for the children';
    const wrapper = shallow(buildApp({reviewSpecs}, {passThroughProp}));
    const view = wrapper.find('PullRequestCommentsView');
    assert.strictEqual(view.length, 1);

    assert.strictEqual(wrapper.instance().props.passThroughProp, view.prop('passThroughProp'));
  });

  describe('collectComments', function() {
    it('sets this.reviewsById with correct data', function() {
      const wrapper = shallow(buildApp());
      const args = {reviewId: 123, submittedAt: '2018-12-27T20:40:55Z', comments: ['a comment',
      ], fetchingMoreComments: true};
      assert.strictEqual(wrapper.instance().reviewsById.size, 0);
      wrapper.instance().collectComments(args);
      const review = wrapper.instance().reviewsById.get(args.reviewId);
      delete args.reviewId;
      assert.deepEqual(review, args);
    });

    it('calls groupCommentsByThread if there are no more reviews or comments to be fetched', function() {
      const wrapper = shallow(buildApp());
      const groupCommentsStub = sinon.stub(wrapper.instance(), 'groupCommentsByThread');
      assert.isFalse(groupCommentsStub.called);
      const args = {reviewId: 123, submittedAt: '2018-12-27T20:40:55Z', comments: ['a comment',
      ], fetchingMoreComments: false};
      wrapper.instance().collectComments(args);
      assert.strictEqual(groupCommentsStub.callCount, 1);
    });
  });

  describe('attemptToLoadMoreReviews', function() {
    it('does not call loadMore if hasMore is false', function() {
      const relayLoadMoreStub = sinon.stub();
      const wrapper = shallow(buildApp({relayLoadMore: relayLoadMoreStub}));
      relayLoadMoreStub.reset();

      wrapper.instance()._attemptToLoadMoreReviews();
      assert.strictEqual(relayLoadMoreStub.callCount, 0);
    });

    it('calls loadMore immediately if hasMore is true and isLoading is false', function() {
      const relayLoadMoreStub = sinon.stub();
      const relayHasMore = () => { return true; };
      const wrapper = shallow(buildApp({relayHasMore, relayLoadMore: relayLoadMoreStub}));
      relayLoadMoreStub.reset();

      wrapper.instance()._attemptToLoadMoreReviews();
      assert.strictEqual(relayLoadMoreStub.callCount, 1);
      assert.deepEqual(relayLoadMoreStub.lastCall.args, [PAGE_SIZE, wrapper.instance().handleError]);
    });

    it('calls loadMore after a timeout if hasMore is true and isLoading is true', function() {
      const clock = sinon.useFakeTimers();
      const relayLoadMoreStub = sinon.stub();
      const relayHasMore = () => { return true; };
      const relayIsLoading = () => { return true; };
      const wrapper = shallow(buildApp({relayHasMore, relayIsLoading, relayLoadMore: relayLoadMoreStub}));
      // advancing the timer and resetting the stub to clear the initial calls of
      // _attemptToLoadMoreReviews when the component is initially mounted.
      clock.tick(PAGINATION_WAIT_TIME_MS);
      relayLoadMoreStub.reset();

      wrapper.instance()._attemptToLoadMoreReviews();
      assert.strictEqual(relayLoadMoreStub.callCount, 0);

      clock.tick(PAGINATION_WAIT_TIME_MS);
      assert.strictEqual(relayLoadMoreStub.callCount, 1);
      assert.deepEqual(relayLoadMoreStub.lastCall.args, [PAGE_SIZE, wrapper.instance().handleError]);
      sinon.restore();
    });
  });

  describe('_loadMoreReviews', function() {
    it('calls this.props.relay.loadMore with correct args', function() {
      const relayLoadMoreStub = sinon.stub();
      const wrapper = shallow(buildApp({relayLoadMore: relayLoadMoreStub}));
      wrapper.instance()._loadMoreReviews();

      assert.deepEqual(relayLoadMoreStub.lastCall.args, [PAGE_SIZE, wrapper.instance().handleError]);
    });
  });

  describe('grouping and ordering comments', function() {
    it('groups the comments into threads based on replyId', function() {
      const originalCommentId = 1;
      const singleCommentId = 5;
      const review1 = reviewBuilder()
        .id(0)
        .submittedAt('2018-12-27T20:40:55Z')
        .addComment(c => c.id(originalCommentId).path('file0.txt').body('OG comment'))
        .build();

      const review2 = reviewBuilder()
        .id(1)
        .submittedAt('2018-12-28T20:40:55Z')
        .addComment(c => c.id(2).path('file0.txt').replyTo(originalCommentId).body('reply to OG comment'))
        .addComment(c => c.id(singleCommentId).path('file0.txt').body('I am single and free'))
        .build();

      const wrapper = shallow(buildApp({reviewSpecs: [review1, review2]}));

      // adding this manually to reviewsById because the last time you call collectComments it groups them, and we don't want to do that just yet.
      wrapper.instance().reviewsById.set(review1.id, {submittedAt: review1.submittedAt, comments: review1.comments, fetchingMoreComments: false});

      wrapper.instance().collectComments({reviewId: review2.id, submittedAt: review2.submittedAt, comments: review2.comments, fetchingMoreComments: false});
      const threadedComments = wrapper.instance().state[originalCommentId];
      assert.lengthOf(threadedComments, 2);
      assert.strictEqual(threadedComments[0].body, 'OG comment');
      assert.strictEqual(threadedComments[1].body, 'reply to OG comment');

      const singleComment = wrapper.instance().state[singleCommentId];
      assert.strictEqual(singleComment[0].body, 'I am single and free');
    });

    it('comments are ordered based on the order in which their reviews were submitted', function() {
      const originalCommentId = 1;
      const review1 = reviewBuilder()
        .id(0)
        .submittedAt('2018-12-20T20:40:55Z')
        .addComment(c => c.id(originalCommentId).path('file0.txt').body('OG comment'))
        .build();

      const review2 = reviewBuilder()
        .id(1)
        .submittedAt('2018-12-22T20:40:55Z')
        .addComment(c => c.id(2).path('file0.txt').replyTo(originalCommentId).body('first reply to OG comment'))
        .build();

      const review3 = reviewBuilder()
        .id(2)
        .submittedAt('2018-12-25T20:40:55Z')
        .addComment(c => c.id(3).path('file0.txt').replyTo(originalCommentId).body('second reply to OG comment'))
        .build();

      const wrapper = shallow(buildApp({reviewSpecs: [review1, review2, review3]}));

      // adding these manually to reviewsById because the last time you call collectComments it groups them, and we don't want to do that just yet.
      wrapper.instance().reviewsById.set(review2.id, {submittedAt: review2.submittedAt, comments: review2.comments, fetchingMoreComments: false});
      wrapper.instance().reviewsById.set(review1.id, {submittedAt: review1.submittedAt, comments: review1.comments, fetchingMoreComments: false});

      wrapper.instance().collectComments({reviewId: review3.id, submittedAt: review3.submittedAt, comments: review3.comments, fetchingMoreComments: false});
      const threadedComments = wrapper.instance().state[originalCommentId];
      assert.lengthOf(threadedComments, 3);

      assert.strictEqual(threadedComments[0].body, 'OG comment');
      assert.strictEqual(threadedComments[1].body, 'first reply to OG comment');
      assert.strictEqual(threadedComments[2].body, 'second reply to OG comment');
    });

    it('comments with a replyTo id that does not point to an existing comment are threaded separately', function() {
      const outdatedCommentId = 1;
      const replyToOutdatedCommentId = 2;
      const review = reviewBuilder()
        .id(2)
        .submittedAt('2018-12-28T20:40:55Z')
        .addComment(c => c.id(replyToOutdatedCommentId).path('file0.txt').replyTo(outdatedCommentId).body('reply to outdated comment'))
        .build();

      const wrapper = shallow(buildApp({reviewSpecs: [review]}));
      wrapper.instance().collectComments({reviewId: review.id, submittedAt: review.submittedAt, comments: review.comments, fetchingMoreComments: false});

      const comments = wrapper.instance().state[replyToOutdatedCommentId];
      assert.lengthOf(comments, 1);
      assert.strictEqual(comments[0].body, 'reply to outdated comment');
    });
  });

  describe('handleError', function() {
    it('attempts to load more reviews', function() {
      const wrapper = shallow(buildApp());

      const loadMoreStub = sinon.stub(wrapper.instance(), '_attemptToLoadMoreReviews');
      wrapper.instance().handleError();

      assert.strictEqual(loadMoreStub.callCount, 1);
    });
  });

  describe('compareReviewsByDate', function() {
    let wrapper;
    const reviewA = reviewBuilder().submittedAt('2018-12-28T20:40:55Z').build();
    const reviewB = reviewBuilder().submittedAt('2018-12-27T20:40:55Z').build();

    beforeEach(function() {
      wrapper = shallow(buildApp());
    });

    it('returns 1 if reviewA is older', function() {
      assert.strictEqual(wrapper.instance().compareReviewsByDate(reviewA, reviewB), 1);
    });
    it('return -1 if reviewB is older', function() {
      assert.strictEqual(wrapper.instance().compareReviewsByDate(reviewB, reviewA), -1);
    });
    it('returns 0 if reviews have the same date', function() {
      assert.strictEqual(wrapper.instance().compareReviewsByDate(reviewA, reviewA), 0);
    });
  });
});
