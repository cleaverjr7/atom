import React from 'react';
import PropTypes from 'prop-types';

import ReviewsView from '../views/reviews-view';
import PullRequestCheckoutController from '../controllers/pr-checkout-controller';
import IssueishDetailItem from '../items/issueish-detail-item';

export default class ReviewsController extends React.Component {
  static propTypes = {
    // GraphQL results
    repository: PropTypes.shape({
      pullRequest: PropTypes.object.isRequired,
    }).isRequired,

    // Package models
    multiFilePatch: PropTypes.object.isRequired,

    // URL parameters
    host: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    repo: PropTypes.string.isRequired,
    number: PropTypes.number.isRequired,
    workdir: PropTypes.string.isRequired,

    // Atom environment
    workspace: PropTypes.object.isRequired,
    config: PropTypes.object.isRequired,
    commands: PropTypes.object.isRequired,
  }

  state = {
    contextLines: 4,
  }

  render() {
    return (
      <PullRequestCheckoutController
        childComponent={ReviewsView}

        contextLines={this.state.contextLines}

        moreContext={this.moreContext}
        lessContext={this.lessContext}
        openFile={this.openFile}
        openDiff={this.openDiff}

        {...this.props}
      />
    );
  }

  openFile = (filePath, lineNumber) => {
    this.props.workspace.open(
      filePath, {
        initialLine: lineNumber,
        initialColumn: 0,
        pending: true,
      });
  }

  openDiff = async (filePath, lineNumber) => {
    const item = await this.props.workspace.open(
      IssueishDetailItem.buildURI(
        this.props.host,
        this.props.owner,
        this.props.repo,
        this.props.number,
        this.props.workdir,
      ), {
        pending: true,
        searchAllPanes: true,
      },
    );
    item.openFilesTab({
      changedFilePath: filePath,
      changedFilePosition: lineNumber,
    });
  }

  moreContext = () => this.setState(prev => ({contextLines: prev.contextLines + 1}));

  lessContext = () => this.setState(prev => ({contextLines: Math.max(prev.contextLines - 1, 1)}));
}
