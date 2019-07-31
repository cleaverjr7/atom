import React from 'react';
import PropTypes from 'prop-types';
import {TextBuffer} from 'atom';

import AtomTextEditor from '../atom/atom-text-editor';
import AutoFocus from '../autofocus';
import TabGroup from '../tab-group';
import DialogView from './dialog-view';

export default class InitDialog extends React.Component {
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
  }

  constructor(props) {
    super(props);

    this.autofocus = new AutoFocus();
    this.tabGroup = new TabGroup();

    this.destinationPath = new TextBuffer({
      text: this.props.request.getParams().dirPath,
    });

    this.sub = this.destinationPath.onDidChange(this.setAcceptEnablement);

    this.state = {
      acceptEnabled: !this.destinationPath.isEmpty(),
    };
  }

  render() {
    return (
      <DialogView
        progressMessage="Initializing..."
        acceptEnabled={this.state.acceptEnabled}
        acceptClassName="icon icon-repo-create"
        acceptText="Init"
        accept={this.accept}
        cancel={this.props.request.cancel}
        tabGroup={this.tabGroup}
        inProgress={this.props.inProgress}
        error={this.props.error}
        workspace={this.props.workspace}
        commands={this.props.commands}>

        <label className="github-DialogLabel">
          Initialize git repository in directory
          <AtomTextEditor
            ref={this.autofocus.target}
            mini={true}
            readOnly={this.props.inProgress}
            preselect={true}
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

  componentWillUnmount() {
    this.sub.dispose();
  }

  accept = () => {
    const destPath = this.destinationPath.getText();
    if (destPath.length === 0) {
      return Promise.resolve();
    }

    return this.props.request.accept(destPath);
  }

  setAcceptEnablement = () => {
    const enablement = !this.destinationPath.isEmpty();
    if (enablement !== this.state.acceptEnabled) {
      this.setState({acceptEnabled: enablement});
    }
  }
}
