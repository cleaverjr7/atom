import React from 'react';
import PropTypes from 'prop-types';

import {GithubLoginModelPropType} from '../prop-types';
import RefHolder from '../models/ref-holder';
import GitHubTabContainer from '../containers/github-tab-container';

export default class GitHubTabItem extends React.Component {
  static propTypes = {
    repository: PropTypes.object,
    loginModel: GithubLoginModelPropType.isRequired,

    documentActiveElement: PropTypes.func,

    // Atom environment
    workspace: PropTypes.object.isRequired,
    openDevTools: PropTypes.func.isRequired,
  }

  static defaultProps = {
    documentActiveElement: /* istanbul ignore next */ () => document.activeElement,
  }

  static uriPattern = 'atom-github://dock-item/github';

  static buildURI() {
    return this.uriPattern;
  }

  constructor(props) {
    super(props);

    this.rootHolder = new RefHolder();
  }

  getTitle() {
    return 'GitHub';
  }

  getIconName() {
    return 'octoface';
  }

  getDefaultLocation() {
    return 'right';
  }

  getPreferredWidth() {
    return 400;
  }

  getWorkingDirectory() {
    return this.props.repository.getWorkingDirectoryPath();
  }

  serialize() {
    return {
      deserializer: 'GithubDockItem',
      uri: this.getURI(),
    };
  }

  render() {
    return (
      <GitHubTabContainer {...this.props} rootHolder={this.rootHolder} />
    );
  }

  hasFocus() {
    return this.rootHolder.map(root => root.contains(this.props.documentActiveElement())).getOr(false);
  }

  restoreFocus() {
    // No-op
  }
}
