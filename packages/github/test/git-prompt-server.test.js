import {execFile} from 'child_process';

import GitPromptServer from '../lib/git-prompt-server';

describe('GitPromptServer', function() {
  it('prompts for user input and writes the response to stdout', async function() {
    this.timeout(10000);

    const server = new GitPromptServer();
    const {helper, socket, electron} = await server.start(question => {
      assert.equal(question, 'What... is your favorite color?\u0000');
      return 'Green. I mean blue! AAAhhhh...';
    });

    let err, stdout;
    await new Promise((resolve, reject) => {
      execFile(electron,
        [helper, socket, 'What... is your favorite color?'],
        {
          env: {
            ELECTRON_RUN_AS_NODE: 1,
            ELECTRON_NO_ATTACH_CONSOLE: 1,
          },
        }, (_err, _stdout, _stderr) => {
          err = _err;
          stdout = _stdout;
          resolve();
        });
    });

    assert.ifError(err);
    assert.equal(stdout, 'Green. I mean blue! AAAhhhh...\n');

    await server.terminate();
  });
});
