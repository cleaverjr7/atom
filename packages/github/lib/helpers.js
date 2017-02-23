import fs from 'fs-extra';
import {ncp} from 'ncp';


function descriptorsFromProto(proto) {
  return Object.getOwnPropertyNames(proto).reduce((acc, name) => {
    Object.assign(acc, {
      [name]: Reflect.getOwnPropertyDescriptor(proto, name),
    });
    return acc;
  }, {});
}

/**
 * Takes an array of targets and returns a proxy. The proxy intercepts property accessor calls and
 * returns the value of that property on the first object in `targets` where the target implements that property.
 */
export function firstImplementer(...targets) {
  return new Proxy({__implementations: targets}, {
    get(target, name) {
      if (Reflect.has(target, name)) {
        return target[name];
      }

      const firstValidTarget = targets.find(t => Reflect.has(t, name));
      if (firstValidTarget) {
        return firstValidTarget[name];
      } else {
        return undefined;
      }
    },

    set(target, name, value) {
      const firstValidTarget = targets.find(t => Reflect.has(t, name));
      if (firstValidTarget) {
        // eslint-disable-next-line no-return-assign
        return firstValidTarget[name] = value;
      } else {
        // eslint-disable-next-line no-return-assign
        return target[name] = value;
      }
    },

    // Used by sinon
    getOwnPropertyDescriptor(target, name) {
      const firstValidTarget = targets.find(t => Reflect.getOwnPropertyDescriptor(t, name));
      const compositeOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor(target, name);
      if (firstValidTarget) {
        return Reflect.getOwnPropertyDescriptor(firstValidTarget, name);
      } else if (compositeOwnPropertyDescriptor) {
        return compositeOwnPropertyDescriptor;
      } else {
        return undefined;
      }
    },

    // Used by sinon
    getPrototypeOf(target) {
      return targets.reduce((acc, t) => {
        return Object.create(acc, descriptorsFromProto(Object.getPrototypeOf(t)));
      }, Object.prototype);
    },
  });
}

export function readFile(absoluteFilePath, encoding = 'utf8') {
  return new Promise((resolve, reject) => {
    fs.readFile(absoluteFilePath, encoding, (err, contents) => {
      if (err) { reject(err); } else { resolve(contents); }
    });
  });
}

export function fileExists(absoluteFilePath) {
  return new Promise((resolve, reject) => {
    fs.access(absoluteFilePath, err => {
      if (err) {
        if (err.code === 'ENOENT') {
          resolve(false);
        } else {
          reject(err);
        }
      } else {
        resolve(true);
      }
    });
  });
}

export function writeFile(absoluteFilePath, contents) {
  return new Promise((resolve, reject) => {
    fs.writeFile(absoluteFilePath, contents, err => {
      if (err) { return reject(err); } else { return resolve(); }
    });
  });
}

export function deleteFileOrFolder(path) {
  return new Promise((resolve, reject) => {
    fs.remove(path, err => {
      if (err) { return reject(err); } else { return resolve(); }
    });
  });
}

export function copyFile(source, target) {
  return new Promise((resolve, reject) => {
    ncp(source, target, err => {
      if (err) { return reject(err); } else { return resolve(target); }
    });
  });
}

export function getTempDir(prefix) {
  return new Promise((resolve, reject) => {
    fs.mkdtemp(prefix, (err, folder) => {
      if (err) { return reject(err); } else { return resolve(folder); }
    });
  });
}

export function fsStat(absoluteFilePath) {
  return new Promise((resolve, reject) => {
    fs.stat(absoluteFilePath, (err, stats) => {
      if (err) { reject(err); } else { resolve(stats); }
    });
  });
}

export function shortenSha(sha) {
  return sha.slice(0, 8);
}

export const classNameForStatus = {
  added: 'added',
  deleted: 'removed',
  modified: 'modified',
  equivalent: 'ignored',
};
