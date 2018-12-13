import React from 'react';
import {shallow} from 'enzyme';
import {parse as parseDiff} from 'what-the-diff';

import rawDiff from '../fixtures/diffs/raw-diff';
import {buildMultiFilePatch} from '../../lib/models/patch';
import {getEndpoint} from '../../lib/models/endpoint';

import PullRequestChangedFilesContainer from '../../lib/containers/pr-changed-files-container';
import IssueishDetailItem from '../../lib/items/issueish-detail-item';

describe('PullRequestChangedFilesContainer', function() {
  let diffResponse;

  function buildApp(overrideProps = {}) {
    return (
      <PullRequestChangedFilesContainer
        owner="atom"
        repo="github"
        number={1804}
        token="1234"
        endpoint={getEndpoint('github.com')}
        itemType={IssueishDetailItem}
        {...overrideProps}
      />
    );
  }

  function setDiffResponse(body) {
    diffResponse = new window.Response(body, {
      status: 200,
      headers: {'Content-type': 'text/plain'},
    });
  }

  beforeEach(function() {
    setDiffResponse(rawDiff);
    sinon.stub(window, 'fetch').callsFake(() => Promise.resolve(diffResponse));
  });

  it('renders a loading spinner if data has not yet been fetched', function() {
    const wrapper = shallow(buildApp());
    assert.isTrue(wrapper.find('LoadingView').exists());
  });

  it('passes extra props through to PullRequestChangedFilesController', async function() {
    const extraProp = Symbol('really really extra');

    const wrapper = shallow(buildApp({extraProp}));
    await assert.async.isTrue(wrapper.update().find('MultiFilePatchController').exists());

    const controller = wrapper.find('MultiFilePatchController');
    assert.strictEqual(controller.prop('extraProp'), extraProp);
  });

  it('builds the diff URL', function() {
    const wrapper = shallow(buildApp({
      owner: 'smashwilson',
      repo: 'pushbot',
      number: 12,
      endpoint: getEndpoint('github.com'),
    }));

    const diffURL = wrapper.instance().getDiffURL();
    assert.strictEqual(diffURL, 'https://api.github.com/repos/smashwilson/pushbot/pulls/12');
  });

  it('passes loaded diff data through to the controller', async function() {
    const wrapper = shallow(buildApp({
      token: '4321',
    }));
    await assert.async.isTrue(wrapper.update().find('MultiFilePatchController').exists());

    const controller = wrapper.find('MultiFilePatchController');
    const expected = buildMultiFilePatch(parseDiff(rawDiff));
    assert.isTrue(controller.prop('multiFilePatch').isEqual(expected));

    assert.deepEqual(window.fetch.lastCall.args, [
      'https://api.github.com/repos/atom/github/pulls/1804',
      {
        headers: {
          Accept: 'application/vnd.github.v3.diff',
          Authorization: 'bearer 4321',
        },
      },
    ]);
  });

  it('renders an error if fetch returns a non-ok response');
});
