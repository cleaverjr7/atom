import React from 'react';
import {shallow} from 'enzyme';
import {reviewBuilder} from '../builder/pr';

import PullRequestReviewsController from '../../lib/controllers/pr-reviews-controller';

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
    const containers = wrapper.find('Relay(BarePullRequestReviewCommentsContainer)');
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


  it('groups the comments into threads once all the data has been fetched', function() {
    const review1 = reviewBuilder()
      .id(0)
      .submittedAt('2018-12-27T20:40:55Z')
      .addComment(c => c.id(1).path('file0.txt').body('OG comment'))
      .build();

    const review2 = reviewBuilder()
      .id(1)
      .submittedAt('2018-12-28T20:40:55Z')
      .addComment(c => c.id(2).path('file0.txt').replyTo(1).body('reply to OG comment'))
      .build();

    const reviewSpecs = [review1, review2];

    const wrapper = shallow(buildApp({reviewSpecs}));

    // adding this manually to reviewsById because the last time you call collectComments
    wrapper.instance().reviewsById.set(review1.id, {submittedAt: review1.submittedAt, comments: review1.comments, fetchingMoreComments: false});

    wrapper.instance().collectComments({reviewId: review2.id, submittedAt: review2.submittedAt, comments: review2.comments, fetchingMoreComments: false});
    const threadedComments = wrapper.instance().state[1];
    assert.lengthOf(threadedComments, 2);
    assert.strictEqual(threadedComments[0].body, 'OG comment');
    assert.strictEqual(threadedComments[1].body, 'reply to OG comment');
  });
});
