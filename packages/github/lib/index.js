/** @babel */

import semver from 'semver';

const {major, minor, patch} = semver.parse(atom.appVersion);
const atomVersion = `${major}.${minor}.${patch}`;
const requiredVersion = '>=1.13.0';

if (atom.inDevMode() || atom.inSpecMode() || semver.satisfies(atomVersion, requiredVersion)) {
  module.exports = startPackage();
} else {
  module.exports = versionMismatch();
}

function versionMismatch() {
  return {
    activate: () => {
      atom.notifications.addWarning('Incompatible Atom Version', {
        description: `The GitHub packages requires Atom ${requiredVersion}. You are running ${atomVersion}.`,
        dismissable: true,
      });
    },
  };
}

function startPackage() {
  const GithubPackage = require('./github-package');

  return new GithubPackage(
    atom.workspace, atom.project, atom.commands, atom.notifications,
  );
}
