import React from 'react';
import PropTypes from 'prop-types';
import Octicon from '../atom/octicon';
import {addEvent} from '../reporter-proxy';
import {autobind} from '../helpers';

export default class ChangedFilesCountView extends React.Component {
  static propTypes = {
    changedFilesCount: PropTypes.number.isRequired,
    didClick: PropTypes.func.isRequired,
    mergeConflictsPresent: PropTypes.bool,
  }

  static defaultProps = {
    changedFilesCount: 0,
    mergeConflictsPresent: false,
    didClick: () => {},
  }

  constructor(props) {
    super(props);
    autobind(this, 'handleClick');
  }

  handleClick() {
    addEvent('click', {package: 'github', component: 'ChangedFileCountView'});
    this.props.didClick();
  }

  render() {
    const label =
      (this.props.changedFilesCount === 1)
        ? '1 file'
        : `${this.props.changedFilesCount} files`;
    return (
      <button
        ref="changedFiles"
        className="github-ChangedFilesCount inline-block"
        onClick={this.handleClick}>
        <Octicon icon="diff" />
        {label}
        {this.props.mergeConflictsPresent && <Octicon icon="alert" />}
      </button>
    );
  }
}
