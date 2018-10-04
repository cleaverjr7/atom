import React from 'react';
import PropTypes from 'prop-types';
import yubikiri from 'yubikiri';

import {autobind} from '../helpers';
import ObserveModel from '../views/observe-model';
import LoadingView from '../views/loading-view';
import FilePatchController from '../controllers/file-patch-controller';

export default class FilePatchContainer extends React.Component {
  static propTypes = {
    repository: PropTypes.object.isRequired,
    stagingStatus: PropTypes.oneOf(['staged', 'unstaged']),
    relPath: PropTypes.string.isRequired,

    workspace: PropTypes.object.isRequired,
    commands: PropTypes.object.isRequired,
    keymaps: PropTypes.object.isRequired,
    tooltips: PropTypes.object.isRequired,
    config: PropTypes.object.isRequired,

    destroy: PropTypes.func.isRequired,
    undoLastDiscard: PropTypes.func.isRequired,
    surfaceFileAtPath: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);
    autobind(this, 'fetchData', 'renderWithData');
  }

  fetchData(repository) {
    return yubikiri({
      filePatch: repository.getFilePatchForPath(this.props.relPath, {staged: this.props.stagingStatus === 'staged'}),
      isPartiallyStaged: repository.isPartiallyStaged(this.props.relPath),
    });
  }

  render() {
    return (
      <ObserveModel model={this.props.repository} fetchData={this.fetchData}>
        {this.renderWithData}
      </ObserveModel>
    );
  }

  renderWithData(data) {
    if (this.props.repository.isLoading() || data === null) {
      return <LoadingView />;
    }

    return (
      <FilePatchController
        isPartiallyStaged={data.isPartiallyStaged}
        filePatch={data.filePatch}
        {...this.props}
      />
    );
  }
}
