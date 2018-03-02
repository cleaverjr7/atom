const net = require('net');
const readline = require('readline');
const url = require('url');
const fs = require('fs');
const path = require('path');
const {execFile} = require('child_process');
const {GitProcess} = require(process.env.ATOM_GITHUB_DUGITE_PATH);
const {createStrategy, UNAUTHENTICATED} = require(process.env.ATOM_GITHUB_KEYTAR_STRATEGY_PATH);

const diagnosticsEnabled = process.env.GIT_TRACE && process.env.GIT_TRACE.length !== 0;
const workdirPath = process.env.ATOM_GITHUB_WORKDIR_PATH;
const inSpecMode = process.env.ATOM_GITHUB_SPEC_MODE === 'true';
const sockPath = process.argv[2];
const action = process.argv[3];

const rememberFile = path.join(__dirname, 'remember');

/*
 * Emit diagnostic messages to stderr if GIT_TRACE is set to a non-empty value.
 */
function log(message) {
  if (!diagnosticsEnabled) {
    return;
  }

  process.stderr.write(`git-credential-atom: ${message}\n`);
}

/*
 * Because the git within dugite was (possibly) built with a different $PREFIX than the user's native git,
 * credential helpers or other config settings from the system configuration may not be discovered. Attempt
 * to collect them by running the native git, if one is present.
 */
function systemCredentialHelpers() {
  if (inSpecMode) {
    // Skip system credential helpers in spec mode to maintain reproduceability across systems.
    return Promise.resolve([]);
  }

  return new Promise(resolve => {
    const env = {
      PATH: process.env.ATOM_GITHUB_ORIGINAL_PATH || '',
      GIT_CONFIG_PARAMETERS: '',
    };

    log('discover credential helpers from system git configuration');
    log(`PATH = ${env.PATH}`);

    execFile('git', ['config', '--system', '--get-all', 'credential.helper'], {env}, (error, stdout, stderr) => {
      if (error) {
        log(`failed to list credential helpers. this is ok\n${error.stack}`);

        // Oh well, c'est la vie
        resolve([]);
        return;
      }

      const helpers = stdout.split(/\n+/).map(line => line.trim()).filter(each => each.length > 0);
      log(`discovered system credential helpers: ${helpers.map(h => `"${h}"`).join(', ')}`);
      resolve(helpers);
    });
  });
}

/*
 * Dispatch a `git credential` subcommand to all configured credential helpers. Return a Promise that
 * resolves with the exit status, stdout, and stderr of the subcommand.
 */
async function withAllHelpers(query, subAction) {
  const systemHelpers = await systemCredentialHelpers();
  const env = {
    GIT_ASKPASS: process.env.ATOM_GITHUB_ORIGINAL_GIT_ASKPASS || '',
    SSH_ASKPASS: process.env.ATOM_GITHUB_ORIGINAL_SSH_ASKPASS || '',
    GIT_CONFIG_PARAMETERS: '', // Only you can prevent forkbombs
  };

  const stdin = Object.keys(query).map(k => `${k}=${query[k]}\n`).join('') + '\n';
  const stdinEncoding = 'utf8';

  const args = [];
  systemHelpers.forEach(helper => args.push('-c', `credential.helper=${helper}`));
  args.push('credential', subAction);

  log(`attempting to run ${subAction} with user-configured credential helpers`);
  log(`GIT_ASKPASS = ${env.GIT_ASKPASS}`);
  log(`SSH_ASKPASS = ${env.SSH_ASKPASS}`);
  log(`arguments = ${args.join(' ')}`);
  log(`stdin =\n${stdin.replace(/password=[^\n]+/, 'password=*******')}`);

  return GitProcess.exec(args, workdirPath, {env, stdin, stdinEncoding});
}

/*
 * Parse `key=value` lines from stdin until EOF or the first blank line.
 */
function parse() {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({input: process.stdin});

    let resolved = false;
    const query = {};

    rl.on('line', line => {
      if (resolved) {
        return;
      }

      if (line.length === 0) {
        log('all input received: blank line received');
        resolved = true;
        resolve(query);
        return;
      }

      const ind = line.indexOf('=');
      if (ind === -1) {
        reject(new Error(`Unable to parse credential line: ${line}`));
        return;
      }

      const key = line.substring(0, ind);
      const value = line.substring(ind + 1).replace(/\n$/, '');
      log(`parsed from stdin: [${key}] = [${key === 'password' ? '******' : value}]`);

      query[key] = value;
    });

    rl.on('close', () => {
      if (resolved) {
        return;
      }

      log('all input received: EOF from stdin');
      resolved = true;
      resolve(query);
    });
  });
}

/*
 * Attempt to use user-configured credential handlers through the normal git channels. If they actually work,
 * hooray! Report the results to stdout. Otherwise, reject the promise and collect credentials through Atom.
 */
async function fromOtherHelpers(query) {
  const {stdout, stderr, exitCode} = await withAllHelpers(query, 'fill');
  if (exitCode !== 0) {
    log(`stdout:\n${stdout}`);
    log(`stderr:\n${stderr}`);
    log(`user-configured credential helpers failed with exit code ${exitCode}. this is ok`);

    throw new Error('git-credential fill failed');
  }

  if (/password=/.test(stdout)) {
    log('password received from user-configured credential helper');

    return stdout;
  } else {
    log(`no password received from user-configured credential helper:\n${stdout}`);

    throw new Error('No password reported from upstream git-credential fill');
  }
}

/*
 * Attempt to read credentials previously stored in keytar.
 */
async function fromKeytar(query) {
  log('reading credentials stored in your OS keychain');
  let password = UNAUTHENTICATED;

  if (!query.host && !query.protocol) {
    throw new Error('Host or protocol unavailable');
  }

  const strategy = await createStrategy();

  if (!query.username) {
    const metaService = `atom-github-git-meta @ ${query.protocol}://${query.host}`;
    log(`reading username from service "${metaService}" and account "username"`);
    const u = await strategy.getPassword(metaService, 'username');
    if (u !== UNAUTHENTICATED) {
      log('username found in keychain');
      query.username = u;
    }
  }

  if (query.username) {
    // Read git entry from OS keychain
    const gitService = `atom-github-git @ ${query.protocol}://${query.host}`;
    log(`reading service "${gitService}" and account "${query.username}"`);
    const gitPassword = await strategy.getPassword(gitService, query.username);
    if (gitPassword !== UNAUTHENTICATED) {
      log('password found in keychain');
      password = gitPassword;
    }
  }

  const githubHost = `${query.protocol}://api.${query.host}`;
  log(`reading service "atom-github" and account "${githubHost}"`);
  const githubPassword = await strategy.getPassword('atom-github', githubHost);
  if (githubPassword !== UNAUTHENTICATED) {
    try {
      if (!query.username) {
        const apiUrl = githubHost === 'https://api.github.com' ? `${githubHost}/graphql` : `${githubHost}/api/v3/graphql`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'Authorization': `bearer ${githubPassword}`,
            'Accept': 'application/vnd.github.graphql-profiling+json',
          },
          body: JSON.stringify({
            query: 'query { viewer { login } }',
          }),
        });

        query.username = response.json().data.viewer.login;
      }
    } catch (e) {
      log(`unable to acquire username from token: ${e.stack}`);
      throw new Error('token found in keychain, but no username');
    }

    password = githubPassword;
  }

  if (password !== UNAUTHENTICATED) {
    const lines = ['protocol', 'host', 'username']
      .filter(k => query[k] !== undefined)
      .map(k => `${k}=${query[k]}\n`);
    lines.push(`password=${password}\n`);
    return lines.join('') + 'quit=true\n';
  } else {
    log('no password found in keychain');
    throw new Error('Unable to read password from keychain');
  }
}

/*
 * Request a dialog in Atom by writing a null-delimited JSON query to the socket we were given.
 */
function dialog(query) {
  if (query.username) {
    query.auth = query.username;
  }
  const prompt = 'Please enter your credentials for ' + url.format(query);
  const includeUsername = !query.username;

  const payload = {prompt, includeUsername, pid: process.pid};

  return new Promise((resolve, reject) => {
    log('requesting dialog through Atom socket');
    log(`prompt = "${prompt}" includeUsername = ${includeUsername}`);

    const socket = net.connect(sockPath, () => {
      log('connection established');

      const parts = [];

      socket.on('data', data => parts.push(data));
      socket.on('end', () => {
        log('Atom socket stream terminated');

        try {
          const reply = JSON.parse(parts.join(''));

          const writeReply = function(err) {
            if (err) {
              log(`Unable to write remember file: ${err.stack}`);
            }

            const lines = [];
            ['protocol', 'host', 'username', 'password'].forEach(k => {
              const value = reply[k] !== undefined ? reply[k] : query[k];
              lines.push(`${k}=${value}\n`);
            });

            log('Atom reply parsed');
            resolve(lines.join('') + 'quit=true\n');
          };

          if (reply.remember) {
            fs.writeFile(rememberFile, writeReply);
          } else {
            writeReply();
          }
        } catch (e) {
          log(`Unable to parse reply from Atom:\n${e.stack}`);
          reject(e);
        }
      });

      log('writing payload');
      socket.write(JSON.stringify(payload) + '\u0000', 'utf8');
      log('payload written');
    });
    socket.setEncoding('utf8');
  });
}

/*
 * Write a successfully used username and password pair to the OS keychain, so that fromKeytar will find it.
 */
async function toKeytar(query) {
  const rememberFlag = await new Promise(resolve => {
    fs.access(rememberFile, err => resolve(!err));
  });
  if (!rememberFlag) {
    return;
  }

  const strategy = await createStrategy();

  const gitService = `atom-github-git @ ${query.protocol}://${query.host}`;
  log(`writing service "${gitService}" and account "${query.username}"`);
  await strategy.replacePassword(gitService, query.username, query.password);

  const metaService = `atom-github-git-meta @ ${query.protocol}://${query.host}`;
  log(`writing service "${metaService}" and account "username"`);
  await strategy.replacePassword(metaService, 'username', query.username);

  log('success');
}

/*
 * Remove credentials that failed authentication.
 */
async function deleteFromKeytar(query) {
  const strategy = await createStrategy();

  const gitService = `atom-github-git @ ${query.protocol}://${query.host}`;
  log(`removing account "${query.username}" from service "${gitService}"`);
  await strategy.deletePassword(gitService, query.username, query.password);
  log('success');
}

async function get() {
  const query = await parse();
  const reply = await fromOtherHelpers(query)
    .catch(() => fromKeytar(query))
    .catch(() => dialog(query))
    .catch(err => {
      process.stderr.write(`Unable to prompt through Atom:\n${err.stack}`);
      log('failure');
      return 'quit=true\n\n';
    });

  await new Promise((resolve, reject) => {
    process.stdout.write(reply, err => {
      if (err) { reject(err); } else { resolve(); }
    });
  });

  log('success');
  process.exit(0);
}

async function store() {
  try {
    const query = await parse();
    await toKeytar(query);
    await withAllHelpers(query, 'approve');
    log('success');
    process.exit(0);
  } catch (e) {
    log(`Unable to execute store: ${e.stack}`);
    process.exit(1);
  }
}

async function erase() {
  try {
    const query = await parse();
    await withAllHelpers(query, 'reject');
    await deleteFromKeytar(query);
    log('success');
    process.exit(0);
  } catch (e) {
    log(`Unable to execute erase: ${e.stack}`);
    process.exit(1);
  }
}

log(`working directory = ${workdirPath}`);
log(`socket path = ${sockPath}`);
log(`action = ${action}`);

switch (action) {
  case 'get':
    get();
    break;
  case 'store':
    store();
    break;
  case 'erase':
    erase();
    break;
  default:
    log(`Unrecognized command: ${action}`);
    process.exit(0);
    break;
}
