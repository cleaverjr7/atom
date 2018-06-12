import React, {Fragment} from 'react';
import PropTypes from 'prop-types';

import {SearchPropType} from '../prop-types';
import {autobind} from '../helpers';
import Accordion from './accordion';

export default class IssueishListView extends React.Component {
  static propTypes = {
    search: SearchPropType.isRequired,
    isLoading: PropTypes.bool.isRequired,
    total: PropTypes.number.isRequired,
    issueishes: PropTypes.arrayOf(PropTypes.any).isRequired,
  }

  constructor(props) {
    super(props);

    autobind(this, 'renderIssueish');
  }

  render() {
    return (
      <Accordion
        leftTitle={this.props.search.getName()}
        isLoading={this.props.isLoading}
        results={this.props.issueishes}>
        {this.renderIssueish}
      </Accordion>
    );
  }

  renderIssueish(issueish) {
    return (
      <Fragment>
        <img
          className="github-IssueishList-item--avatar"
          src={issueish.getAuthorAvatarURL()}
          title={issueish.getAuthorLogin()}
        />
        <span className="github-IssueishList-item--title">
          {issueish.getTitle()}
        </span>
        <span className="github-IssueishList-item--number">
          #{issueish.getNumber()}
        </span>
        <span className="github-IssueishList-item--status">
          ...
        </span>
        <span className="github-IssueishList-item--age">
          ...
        </span>
      </Fragment>
    );
  }
}
