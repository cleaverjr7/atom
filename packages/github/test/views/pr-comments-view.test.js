import React from 'react';
import {shallow} from 'enzyme';

import {multiFilePatchBuilder} from '../builder/patch';
import {pullRequestBuilder} from '../builder/pr';
import PrCommentsView from '../../lib/views/pr-comments-view';

describe('PrCommentsView', function() {
  it('adjusts the position for comments after hunk headers', function() {
    const {multiFilePatch} = multiFilePatchBuilder()
      .addFilePatch(fp => {
        fp.setOldFile(f => f.path('file0.txt'));
        fp.addHunk(h => h.oldRow(5).unchanged('0 (1)').added('1 (2)', '2 (3)', '3 (4)').unchanged('4 (5)'));
        fp.addHunk(h => h.oldRow(20).unchanged('5 (7)').deleted('6 (8)', '7 (9)', '8 (10)').unchanged('9 (11)'));
        fp.addHunk(h => {
          h.oldRow(30).unchanged('10 (13)').added('11 (14)', '12 (15)').deleted('13 (16)').unchanged('14 (17)');
        });
      })
      .addFilePatch(fp => {
        fp.setOldFile(f => f.path('file1.txt'));
        fp.addHunk(h => h.oldRow(5).unchanged('15 (1)').added('16 (2)').unchanged('17 (3)'));
        fp.addHunk(h => h.oldRow(20).unchanged('18 (5)').deleted('19 (6)', '20 (7)', '21 (8)').unchanged('22 (9)'));
      })
      .build();

    const pr = pullRequestBuilder()
      .addReview(r => {
        r.addComment(c => c.id(0).path('file0.txt').position(2).body('one'));
        r.addComment(c => c.id(1).path('file0.txt').position(15).body('three'));
        r.addComment(c => c.id(1).path('file1.txt').position(7).body('three'));
      })
      .build();

    const wrapper = shallow(<PrCommentsView multiFilePatch={multiFilePatch} reviews={pr.reviews} />);

    assert.deepEqual(wrapper.find('Marker').at(0).prop('bufferRange').serialize(), [[1, 0], [1, 0]]);
    assert.deepEqual(wrapper.find('Marker').at(1).prop('bufferRange').serialize(), [[12, 0], [12, 0]]);
    assert.deepEqual(wrapper.find('Marker').at(2).prop('bufferRange').serialize(), [[20, 0], [20, 0]]);
  });
  it('does not render comment if position is null', function() {
    const {multiFilePatch} = multiFilePatchBuilder()
      .addFilePatch(fp => {
        fp.setOldFile(f => f.path('file0.txt'));
        fp.addHunk(h => h.oldRow(5).unchanged('0 (1)').added('1 (2)', '2 (3)', '3 (4)').unchanged('4 (5)'));
        fp.addHunk(h => h.oldRow(20).unchanged('5 (7)').deleted('6 (8)', '7 (9)', '8 (10)').unchanged('9 (11)'));
        fp.addHunk(h => {
          h.oldRow(30).unchanged('10 (13)').added('11 (14)', '12 (15)').deleted('13 (16)').unchanged('14 (17)');
        });
      })
      .build();

    const pr = pullRequestBuilder()
      .addReview(r => {
        r.addComment(c => c.id(0).path('file0.txt').position(2).body('one'));
        r.addComment(c => c.id(1).path('file0.txt').position(null).body('three'));
      })
      .build();

    const wrapper = shallow(<PrCommentsView multiFilePatch={multiFilePatch} reviews={pr.reviews} />);

    const comments = wrapper.find('PullRequestCommentView');
    assert.lengthOf(comments, 1);
    assert.strictEqual(comments.at(0).prop('comment').body, 'one');
  });
});
