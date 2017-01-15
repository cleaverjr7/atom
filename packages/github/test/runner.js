import {createRunner} from 'atom-mocha-test-runner';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
global.assert = chai.assert;

module.exports = createRunner({
  htmlTitle: `GitHub Package Tests - pid ${process.pid}`,
  reporter: 'spec',
  overrideTestPaths: [/spec$/, /test/],
});
