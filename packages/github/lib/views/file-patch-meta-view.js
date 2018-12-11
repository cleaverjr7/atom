import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import CommitDetailItem from '../items/commit-detail-item';
import ChangedFileItem from '../items/changed-file-item';
import CommitPreviewItem from '../items/commit-preview-item';

export default class FilePatchMetaView extends React.Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    actionIcon: PropTypes.string.isRequired,
    actionText: PropTypes.string.isRequired,

    action: PropTypes.func.isRequired,

    children: PropTypes.element.isRequired,
    itemType: PropTypes.oneOf([ChangedFileItem, CommitPreviewItem, CommitDetailItem]).isRequired,
  };

  renderMetaControls() {
    if (this.props.itemType === CommitDetailItem) {
      return null;
    }
    return (
      <div className="github-FilePatchView-metaControls">
        <button
          className={cx('github-FilePatchView-metaButton', 'icon', this.props.actionIcon)}
          onClick={this.props.action}>
          {this.props.actionText}
        </button>
      </div>
    );
  }

  render() {
    return (
      <div className="github-FilePatchView-meta">
        <div className="github-FilePatchView-metaContainer">
          <header className="github-FilePatchView-metaHeader">
            <h3 className="github-FilePatchView-metaTitle">{this.props.title}</h3>
            {this.renderMetaControls()}
          </header>
          <div className="github-FilePatchView-metaDetails">
            {this.props.children}
          </div>
        </div>
      </div>
    );
  }
}
