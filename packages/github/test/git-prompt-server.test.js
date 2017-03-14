import {execFile} from 'child_process';
import path from 'path';

import GitPromptServer from '../lib/git-prompt-server';
import {fileExists} from '../lib/helpers';

describe('GitPromptServer', function() {
  const electronEnv = {
    ELECTRON_RUN_AS_NODE: '1',
    ELECTRON_NO_ATTACH_CONSOLE: '1',
    ATOM_GITHUB_DUGITE_PATH: require.resolve('git-kitchen-sink'),
    ATOM_GITHUB_ORIGINAL_PATH: process.env.PATH,
    ATOM_GITHUB_WORKDIR_PATH: path.join(__dirname, '..'),
    GIT_TRACE: 'true',
    GIT_TERMINAL_PROMPT: '0',
  };

  describe('credential helper', function() {
    let server;

    beforeEach(function() {
      server = new GitPromptServer();
    });

    async function runCredentialScript(command, queryHandler, processHandler) {
      const {credentialHelper, socket, electron} = await server.start(queryHandler);

      let err, stdout, stderr;
      await new Promise((resolve, reject) => {
        const child = execFile(
          electron, [credentialHelper.script, socket, command],
          {env: electronEnv},
          (_err, _stdout, _stderr) => {
            err = _err;
            stdout = _stdout;
            stderr = _stderr;
            resolve();
          },
        );

        child.stderr.on('data', console.log); // eslint-disable-line no-console

        processHandler(child);
      });

      return {err, stdout, stderr};
    }

    it('prompts for user input and writes collected credentials to stdout', async function() {
      this.timeout(10000);

      function queryHandler(query) {
        assert.equal(query.prompt, 'Please enter your credentials for https://what-is-your-favorite-color.com');
        assert.isTrue(query.includeUsername);
        return {
          username: 'old-man-from-scene-24',
          password: 'Green. I mean blue! AAAhhhh...',
          remember: false,
        };
      }

      function processHandler(child) {
        child.stdin.write('protocol=https\n');
        child.stdin.write('host=what-is-your-favorite-color.com\n');
        child.stdin.end('\n');
      }

      const {err, stdout} = await runCredentialScript('get', queryHandler, processHandler);

      assert.ifError(err);
      assert.equal(stdout,
        'protocol=https\nhost=what-is-your-favorite-color.com\n' +
        'username=old-man-from-scene-24\npassword=Green. I mean blue! AAAhhhh...\n' +
        'quit=true\n');

      assert.isFalse(await fileExists(path.join(server.tmpFolderPath, 'remember')));
    });

    it('parses input without the terminating blank line', async function() {
      this.timeout(10000);

      function queryHandler(query) {
        return {
          username: 'old-man-from-scene-24',
          password: 'Green. I mean blue! AAAhhhh...',
          remember: false,
        };
      }

      function processHandler(child) {
        child.stdin.write('protocol=https\n');
        child.stdin.write('host=what-is-your-favorite-color.com\n');
        child.stdin.end();
      }

      const {err, stdout} = await runCredentialScript('get', queryHandler, processHandler);

      assert.ifError(err);
      assert.equal(stdout,
        'protocol=https\nhost=what-is-your-favorite-color.com\n' +
        'username=old-man-from-scene-24\npassword=Green. I mean blue! AAAhhhh...\n' +
        'quit=true\n');
    });

    it('creates a flag file if remember is set to true', async function() {
      this.timeout(10000);

      function queryHandler(query) {
        return {
          username: 'old-man-from-scene-24',
          password: 'Green. I mean blue! AAAhhhh...',
          remember: true,
        };
      }

      function processHandler(child) {
        child.stdin.write('protocol=https\n');
        child.stdin.write('host=what-is-your-favorite-color.com\n');
        child.stdin.end('\n');
      }

      const {err} = await runCredentialScript('get', queryHandler, processHandler);
      assert.ifError(err);
      assert.isTrue(await fileExists(path.join(server.tmpFolderPath, 'remember')));
    });

    afterEach(async function() {
      await server.terminate();
    });
  });

  describe('askpass helper', function() {
    it('prompts for user input and writes the response to stdout', async function() {
      this.timeout(10000);

      const server = new GitPromptServer();
      const {askPass, socket, electron} = await server.start(query => {
        assert.equal(query.prompt, 'Please enter your password for "updog"');
        assert.isFalse(query.includeUsername);
        return {
          password: "What's 'updog'?",
        };
      });

      let err, stdout;
      await new Promise((resolve, reject) => {
        const child = execFile(
          electron, [askPass.script, socket, 'Please enter your password for "updog"'],
          {env: electronEnv},
          (_err, _stdout, _stderr) => {
            err = _err;
            stdout = _stdout;
            resolve();
          },
        );

        child.stderr.on('data', console.log); // eslint-disable-line no-console
      });

      assert.ifError(err);
      assert.equal(stdout, "What's 'updog'?");

      await server.terminate();
    });
  });
});
