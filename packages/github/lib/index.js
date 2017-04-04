import GithubPackage from './github-package';

let pack;
const entry = {
  activate(...args) {
    pack = new GithubPackage(
      atom.workspace, atom.project, atom.commands, atom.notifications, atom.tooltips,
      atom.styles, atom.config, atom.confirm.bind(atom),
    );
    pack.activate(...args);
  },
};

[
  'serialize', 'deserialize', 'deactivate', 'consumeStatusBar',
  'createGitTimingsView', 'createIssueishPaneItem',
].forEach(method => {
  entry[method] = (...args) => {
    return pack[method](...args);
  };
});

module.exports = entry;
