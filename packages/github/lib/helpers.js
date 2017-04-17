import path from 'path';
import fs from 'fs-extra';
import temp from 'temp';
import {ncp} from 'ncp';

export function getPackageRoot() {
  const {resourcePath} = atom.getLoadSettings();
  const currentFileWasRequiredFromSnapshot = !path.isAbsolute(__dirname);
  if (currentFileWasRequiredFromSnapshot) {
    return path.join(resourcePath, 'node_modules', 'github');
  } else {
    const packageRoot = path.resolve(__dirname, '..');
    if (path.extname(resourcePath) === '.asar') {
      if (packageRoot.indexOf(resourcePath) === 0) {
        return path.join(`${resourcePath}.unpacked`, 'node_modules', 'github');
      }
    }
    return packageRoot;
  }
}

let DUGITE_PATH;
export function getDugitePath() {
  if (!DUGITE_PATH) {
    DUGITE_PATH = require.resolve('dugite');
    if (!path.isAbsolute(DUGITE_PATH)) {
      // Assume we're snapshotted
      const {resourcePath} = atom.getLoadSettings();
      if (path.extname(resourcePath) === '.asar') {
        DUGITE_PATH = path.join(`${resourcePath}.unpacked`, 'node_modules', 'dugite');
      } else {
        DUGITE_PATH = path.join(resourcePath, 'node_modules', 'dugite');
      }
    }
  }

  return DUGITE_PATH;
}

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
      if (name === 'getImplementers') {
        return () => targets;
      }

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
      return targets.reduceRight((acc, t) => {
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

export function deleteFileOrFolder(fileOrFolder) {
  return new Promise((resolve, reject) => {
    fs.remove(fileOrFolder, err => {
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

export function getTempDir(prefix = '') {
  return new Promise((resolve, reject) => {
    temp.mkdir(prefix, (tempError, folder) => {
      if (tempError) {
        reject(tempError);
        return;
      }

      fs.realpath(folder, (realError, rpath) => (realError ? reject(realError) : resolve(rpath)));
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

export async function isFileExecutable(absoluteFilePath) {
  const stat = await fsStat(absoluteFilePath);
  return stat.mode & fs.constants.S_IXUSR; // eslint-disable-line no-bitwise
}

export function mkdirs(directory) {
  return new Promise((resolve, reject) => {
    fs.mkdirs(directory, err => (err ? reject(err) : resolve()));
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
