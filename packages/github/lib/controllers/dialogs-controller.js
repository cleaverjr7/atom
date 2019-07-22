import React from 'react';
import PropTypes from 'prop-types';

import InitDialog from '../views/init-dialog';
import CloneDialog from '../views/clone-dialog';
import CredentialDialog from '../views/credential-dialog';
import OpenIssueishDialog from '../views/open-issueish-dialog';
import OpenCommitDialog from '../views/open-commit-dialog';

const DIALOG_COMPONENTS = {
  null: NullDialog,
  init: InitDialog,
  clone: CloneDialog,
  credential: CredentialDialog,
  issueish: OpenIssueishDialog,
  commit: OpenCommitDialog,
};

export default class DialogsController extends React.Component {
  static propTypes = {
    // Model
    request: PropTypes.shape({
      identifier: PropTypes.string.isRequired,
      isProgressing: PropTypes.bool.isRequired,
    }).isRequired,

    // Atom environment
    workspace: PropTypes.object.isRequired,
    commands: PropTypes.object.isRequired,
    config: PropTypes.object.isRequired,
  };

  state = {
    requestInProgress: null,
    requestError: [null, null],
  }

  render() {
    const DialogComponent = DIALOG_COMPONENTS[this.props.request.identifier];
    return <DialogComponent {...this.getCommonProps()} />;
  }

  getCommonProps() {
    const {request} = this.props;
    const accept = request.isProgressing
      ? async (...args) => {
        this.setState({requestError: [null, null], requestInProgress: request});
        try {
          const result = await request.accept(...args);
          this.setState({requestInProgress: null});
          return result;
        } catch (error) {
          this.setState({requestError: [request, error], requestInProgress: null});
          return undefined;
        }
      } : (...args) => {
        this.setState({requestError: [null, null]});
        try {
          return request.accept(...args);
        } catch (error) {
          this.setState({requestError: [request, error]});
          return undefined;
        }
      };
    const wrapped = wrapDialogRequest(request, {accept});

    return {
      config: this.props.config,
      commands: this.props.commands,
      workspace: this.props.workspace,
      inProgress: this.state.requestInProgress === request,
      error: this.state.requestError[0] === request ? this.state.requestError[1] : null,
      request: wrapped,
    };
  }
}

function NullDialog() {
  return null;
}

class DialogRequest {
  constructor(identifier, params = {}) {
    this.identifier = identifier;
    this.params = params;
    this.isProgressing = false;
    this.accept = () => {};
    this.cancel = () => {};
  }

  onAccept(cb) {
    this.accept = cb;
  }

  onProgressingAccept(cb) {
    this.isProgressing = true;
    this.onAccept(cb);
  }

  onCancel(cb) {
    this.cancel = cb;
  }

  getParams() {
    return this.params;
  }
}

function wrapDialogRequest(original, {accept}) {
  const dup = new DialogRequest(original.identifier, original.params);
  dup.isProgressing = original.isProgressing;
  dup.onAccept(accept);
  dup.onCancel(original.cancel);
  return dup;
}

export const dialogRequests = {
  null: {
    identifier: 'null',
    isProgressing: false,
    params: {},
    accept: () => {},
    cancel: () => {},
  },

  init({dirPath}) {
    return new DialogRequest('init', {dirPath});
  },

  clone(opts) {
    return new DialogRequest('clone', {
      sourceURL: '',
      destPath: '',
      ...opts,
    });
  },

  credential(opts) {
    return new DialogRequest('credential', {
      includeUsername: false,
      includeRemember: false,
      prompt: 'Please authenticate',
      ...opts,
    });
  },

  issueish() {
    return new DialogRequest('issueish');
  },

  commit() {
    return new DialogRequest('commit');
  },
};
