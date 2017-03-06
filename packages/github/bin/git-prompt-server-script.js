const net = require('net');
const readline = require('readline');
const url = require('url');

const sockPath = process.argv[2];
const action = process.argv[3];

function dialog(query) {
  if (query.username) {
    query.auth = query.username;
  }
  const prompt = 'Please enter your credentials for ' + url.format(query);

  return new Promise((resolve, reject) => {
    const socket = net.connect({path: sockPath, allowHalfOpen: true}, () => {
      const parts = [];

      socket.on('data', data => parts.push(data));
      socket.on('end', () => {
        try {
          process.stderr.write(`Document: ${parts.join()}\n`);
          const replyDocument = JSON.parse(parts.join());
          resolve(replyDocument);
        } catch (e) {
          reject(e);
        }
      });

      socket.end(prompt, 'utf8');
    });
    socket.setEncoding('utf8');
  });
}

function get() {
  const rl = readline.createInterface({
    input: process.stdin,
  });

  const query = {};

  rl.on('line', line => {
    if (line.length !== 0) {
      const [key, ...value] = line.split('=');
      query[key] = value.join('=').replace(/\n$/, '');
    } else {
      // All input received.
      dialog(query).then(reply => {
        ['protocol', 'host', 'username', 'password'].forEach(k => {
          const value = reply[k] !== undefined ? reply[k] : query[k];
          process.stdout.write(`${k}=${value}\n`);
        });
        process.exit(0);
      }).catch(err => {
        process.stderr.write(`Unable to prompt through Atom:\n${err.stack}`);
        process.exit(1);
      });
    }
  });
}

switch (action) {
  case 'get':
    get();
    break;
  default:
    process.exit(0);
    break;
}
