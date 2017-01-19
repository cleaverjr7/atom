import {createRunner} from 'atom-mocha-test-runner';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import until from 'test-until';

chai.use(chaiAsPromised);
global.assert = chai.assert;

// Give tests that rely on filesystem event delivery lots of breathing room.
until.setDefaultTimeout(5000);

module.exports = createRunner({
  htmlTitle: `GitHub Package Tests - pid ${process.pid}`,
  reporter: process.env.MOCHA_REPORTER || 'spec',
  overrideTestPaths: [/spec$/, /test/],
}, mocha => {
  mocha.timeout(5000);
  if (process.env.APPVEYOR_API_URL) {
    mocha.reporter(require('mocha-appveyor-reporter'));
  }
});
