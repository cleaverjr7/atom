import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import cx from 'classnames';

export default class Timeago extends React.Component {
  static propTypes = {
    time: PropTypes.any.isRequired,
    type: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.func,
    ]),
  }

  static defaultProps = {
    type: 'span',
  }

  static getTimeDisplay(time, now = moment()) {
    const m = moment(time);
    return m.from(now, true);
  }

  componentDidMount() {
    this.timer = setInterval(() => this.forceUpdate(), 60000);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  render() {
    const {type, time, ...others} = this.props;
    const display = Timeago.getTimeDisplay(time);
    const Type = type;
    const className = cx('timeago', others.className);
    return (
      <Type {...others} className={className}>{display}</Type>
    );
  }
}
