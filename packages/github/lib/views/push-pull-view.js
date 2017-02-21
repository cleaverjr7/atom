import React from 'react';
import cx from 'classnames';

export default class PushPullView extends React.Component {
  static propTypes = {
    pushInProgress: React.PropTypes.bool,
    fetchInProgress: React.PropTypes.bool,
    behindCount: React.PropTypes.number,
    aheadCount: React.PropTypes.number,
  };

  static defaultProps = {
    pushInProgress: false,
    fetchInProgress: false,
    behindCount: 0,
    aheadCount: 0,
  }

  render() {
    const pushing = this.props.pushInProgress;
    const pulling = this.props.fetchInProgress;
    const pushClasses = cx('github-PushPull-icon', 'icon', {'icon-arrow-up': !pushing, 'icon-sync': pushing});
    const pullClasses = cx('github-PushPull-icon', 'icon', {'icon-arrow-down': !pulling, 'icon-sync': pulling});
    return (
      <div className="github-PushPull inline-block">
        <span className={pullClasses} />
        <span className="github-PushPull-label is-pull">
          {this.props.behindCount ? `${this.props.behindCount}` : ''}
        </span>
        <span className={pushClasses} />
        <span className="github-PushPull-label is-push">
          {this.props.aheadCount ? `${this.props.aheadCount}` : ''}
        </span>
      </div>
    );
  }
}
