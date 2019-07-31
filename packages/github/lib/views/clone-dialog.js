import React from 'react';
import PropTypes from 'prop-types';
import {CompositeDisposable} from 'event-kit';
import {TextBuffer} from 'atom';
import url from 'url';
import path from 'path';

import AtomTextEditor from '../atom/atom-text-editor';
import AutoFocus from '../autofocus';
import TabGroup from '../tab-group';
import DialogView from './dialog-view';

export default class CloneDialog extends React.Component {
  static propTypes = {
    // Model
    request: PropTypes.shape({
      getParams: PropTypes.func.isRequired,
      accept: PropTypes.func.isRequired,
      cancel: PropTypes.func.isRequired,
    }).isRequired,
    inProgress: PropTypes.bool,
    error: PropTypes.instanceOf(Error),

    // Atom environment
    workspace: PropTypes.object.isRequired,
    commands: PropTypes.object.isRequired,
    config: PropTypes.object.isRequired,
  }

  constructor(props) {
    super(props);

    const params = this.props.request.getParams();
    this.sourceURL = new TextBuffer({text: params.sourceURL});
    this.destinationPath = new TextBuffer({
      text: params.destPath || this.props.config.get('core.projectHome'),
    });
    this.destinationPathModified = false;

    this.state = {
      acceptEnabled: false,
    };

    this.subs = new CompositeDisposable(
      this.sourceURL.onDidChange(this.didChangeSourceUrl),
      this.destinationPath.onDidChange(this.didChangeDestinationPath),
    );

    this.autofocus = new AutoFocus();
    this.tabGroup = new TabGroup();
  }

  render() {
    return (
      <DialogView
        progressMessage="cloning..."
        acceptEnabled={this.state.acceptEnabled}
        acceptClassNames="icon icon-repo-clone"
        acceptText="Clone"
        accept={this.accept}
        cancel={this.props.request.cancel}
        tabGroup={this.tabGroup}
        inProgress={this.props.inProgress}
        error={this.props.error}
        workspace={this.props.workspace}
        commands={this.props.commands}>

        <label className="github-DialogLabel">
          Clone from
          <AtomTextEditor
            ref={this.autofocus.target}
            className="github-Clone-sourceURL"
            mini={true}
            readOnly={this.props.inProgress}
            buffer={this.sourceURL}
            tabIndex={this.tabGroup.nextIndex()}
          />
        </label>
        <label className="github-DialogLabel">
          To directory
          <AtomTextEditor
            className="github-Clone-destinationPath"
            mini={true}
            readOnly={this.props.inProgress}
            buffer={this.destinationPath}
            tabIndex={this.tabGroup.nextIndex()}
          />
        </label>

      </DialogView>
    );
  }

  componentDidMount() {
    this.autofocus.trigger();
  }

  accept = () => {
    const sourceURL = this.sourceURL.getText();
    const destinationPath = this.destinationPath.getText();
    if (sourceURL === '' || destinationPath === '') {
      return Promise.resolve();
    }

    return this.props.request.accept(sourceURL, destinationPath);
  }

  didChangeSourceUrl = () => {
    if (!this.destinationPathModified) {
      const name = path.basename(url.parse(this.sourceURL.getText()).pathname, '.git') || '';

      if (name.length > 0) {
        const proposedPath = path.join(this.props.config.get('core.projectHome'), name);
        this.destinationPath.setText(proposedPath);
        this.destinationPathModified = false;
      }
    }

    this.setAcceptEnablement();
  }

  didChangeDestinationPath = () => {
    this.destinationPathModified = true;
    this.setAcceptEnablement();
  }

  setAcceptEnablement = () => {
    const enabled = !this.sourceURL.isEmpty() && !this.destinationPath.isEmpty();
    if (enabled !== this.state.acceptEnabled) {
      this.setState({acceptEnabled: enabled});
    }
  }
}
