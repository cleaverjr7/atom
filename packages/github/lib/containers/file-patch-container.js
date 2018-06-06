import React from 'react';
import PropTypes from 'prop-types';
import yubikiri from 'yubikiri';

import {autobind} from '../helpers';
import ObserveModel from '../views/observe-model';
import FilePatchController from '../controllers/file-patch-controller';

export default class FilePatchContainer extends React.Component {
  static propTypes = {
    repository: PropTypes.object.isRequired,
    stagingStatus: PropTypes.oneOf(['staged', 'unstaged']),
    relPath: PropTypes.string.isRequired,

    tooltips: PropTypes.object.isRequired,
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
    if (data === null) {
      return null;
    }

    if (data.filePatch === null) {
      return null;
    }

    return (
      <FilePatchController
        isPartiallyStaged={data.isPartiallyStaged}
        filePatch={data.filePatch}
        stagingStatus={this.props.stagingStatus}
        tooltips={this.props.tooltips}
      />
    );
  }
}
