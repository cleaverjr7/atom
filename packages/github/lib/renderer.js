const {GitProcess} = require('dugite');

const ipc = require('electron').ipcRenderer;

/*
Calculate running averages

Store time that exec was called. Or the difference between that and the last time it was called.
Ignore the time for write operations that are non-parallelizable
Take an average of the last 3 times
And if it is above XX ms create a new renderer to send future messages to.
Once the current renderer finishes up its work kill it
Timing concerns? the async queue will take care of everything for us
*/


class AverageTracker {
  constructor({limit} = {limit: 10}) {
    this.limit = limit;
    this.sum = 0;
    this.values = [];
  }

  addValue(value) {
    if (this.values.length >= this.limit) {
      const discardedValue = this.values.shift();
      this.sum -= discardedValue;
    }
    this.values.push(value);
    this.sum += value;
  }

  getAverage() {
    if (this.values.length < this.limit) { return null; }
    return this.sum / this.limit;
  }
}

const averageTracker = new AverageTracker({limit: 10});


ipc.on('ping', (event, webContentsId, {args, workingDir, options, operationId, timeSent}) => {
  const formattedArgs = `git ${args.join(' ')} in ${workingDir}`;
  console.log('operationId', operationId, formattedArgs);
  const startTime = performance.now();
  // For profiling purposes
  // const str = 'a'.repeat(amount);
  // const execTime = (process.uptime() - startTime) * 1000;
  // event.sender.sendTo(webContentsId, 'git-data', {
  //   type: 'git',
  //   data: {exitCode: 0, stdout: str, stderr: '', time: execTime},
  // });

  if (process.env.PRINT_GIT_TIMES) {
    console.time(`git:${formattedArgs}`);
  }
  const execStart = performance.now();
  GitProcess.exec(args, workingDir, options)
    .then(({stdout, stderr, exitCode}) => {
      // timingMarker.finalize();
      // if (process.env.PRINT_GIT_TIMES) {
      //   console.timeEnd(`git:${formattedArgs}`);
      // }
      // if (gitPromptServer) {
      //   gitPromptServer.terminate();
      // }
      // subscriptions.dispose();

      // if (diagnosticsEnabled) {
      //   const headerStyle = 'font-weight: bold; color: blue;';
      //
      //   console.groupCollapsed(`git:${formattedArgs}`);
      //   console.log('%cexit status%c %d', headerStyle, 'font-weight: normal; color: black;', exitCode);
      //   console.log('%cstdout', headerStyle);
      //   console.log(stdout);
      //   console.log('%cstderr', headerStyle);
      //   console.log(stderr);
      //   console.groupEnd();
      // }

      let err = null;
      if (exitCode) {
        err = {
          message: `${formattedArgs} exited with code ${exitCode}\nstdout: ${stdout}\nstderr: ${stderr}`,
          code: exitCode,
          stdErr: stderr,
          stdOut: stdout,
          command: formattedArgs,
        };
      }
      const execTime = performance.now() - startTime;
      console.log(operationId);
      console.log(stdout);
      event.sender.sendTo(webContentsId, 'git-data', {
        type: 'git',
        data: {result: stdout, err, execTime, operationId, timeSent, formattedArgs},
      });
    });
  const execEnd = performance.now();
  averageTracker.addValue(execEnd - execStart);
  console.error(averageTracker.values);
  console.error(averageTracker.getAverage());
});
