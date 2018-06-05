import React from 'react';
import PropTypes from 'prop-types';
import {Disposable} from 'event-kit';
import {Range, Point} from 'atom';

import {autobind} from '../helpers';
import {RefHolderPropType} from '../prop-types';
import RefHolder from '../models/ref-holder';

const MarkablePropType = PropTypes.shape({
  markBufferRange: PropTypes.func.isRequired,
  markScreenRange: PropTypes.func.isRequired,
  markBufferPosition: PropTypes.func.isRequired,
  markScreenPosition: PropTypes.func.isRequired,
});

const RangePropType = PropTypes.oneOfType([
  PropTypes.array,
  PropTypes.instanceOf(Range),
]);

const PointPropType = PropTypes.oneOfType([
  PropTypes.array,
  PropTypes.instanceOf(Point),
]);

const markerProps = {
  maintainHistory: PropTypes.bool,
  reversed: PropTypes.bool,
  invalidate: PropTypes.oneOf(['never', 'surround', 'overlap', 'inside', 'touch']),
};

class WrappedMarker extends React.Component {
  static propTypes = {
    ...markerProps,
    bufferRange: RangePropType,
    bufferPosition: PointPropType,
    screenRange: RangePropType,
    screenPosition: PointPropType,
    markableHolder: RefHolderPropType,
    children: PropTypes.element,
    handleID: PropTypes.func,
  }

  static defaultProps = {
    handleID: () => {},
  }

  constructor(props) {
    super(props);

    autobind(this, 'createMarker');

    this.sub = new Disposable();
    this.marker = null;
  }

  componentDidMount() {
    this.observeMarkable();
  }

  render() {
    return this.props.children || null;
  }

  componentDidUpdate(prevProps) {
    if (this.props.markableHolder !== prevProps.markableHolder) {
      this.observeMarkable();
    }
  }

  componentWillUnmount() {
    if (this.marker) {
      this.marker.destroy();
    }
    this.sub.dispose();
  }

  observeMarkable() {
    this.sub.dispose();
    this.sub = this.props.markableHolder.observe(this.createMarker);
  }

  createMarker() {
    if (this.marker) {
      this.marker.destroy();
    }

    const options = Object.keys(markerProps).reduce((opts, propName) => {
      if (this.props[propName] !== undefined) {
        opts[propName] = this.props[propName];
      }
      return opts;
    }, {});

    this.marker = this.props.markableHolder.map(markable => {
      if (this.props.bufferRange) {
        return markable.markBufferRange(this.props.bufferRange, options);
      }

      if (this.props.screenRange) {
        return markable.markScreenRange(this.props.screenRange, options);
      }

      if (this.props.bufferPosition) {
        return markable.markBufferPosition(this.props.bufferPosition, options);
      }

      if (this.props.screenPosition) {
        return markable.markScreenPosition(this.props.screenPosition, options);
      }

      throw new Error('Expected one of bufferRange, screenRange, bufferPosition, or screenPosition to be set');
    }).getOr(null);

    if (this.marker) {
      this.props.handleID(this.marker.id);
    }
  }
}

export default class Marker extends React.Component {
  static propTypes = {
    editor: MarkablePropType,
    layer: MarkablePropType,
  }

  constructor(props) {
    super(props);

    this.state = {
      markableHolder: RefHolder.on(props.layer || props.editor),
    };
  }

  static getDerivedStateFromProps(props, state) {
    const markable = props.layer || props.editor;

    if (state.markableHolder.map(m => m === markable).getOr(markable === undefined)) {
      return {};
    }

    return {
      markableHolder: RefHolder.on(markable),
    };
  }

  render() {
    if (!this.state.markableHolder.isEmpty()) {
      return <WrappedMarker markableHolder={this.state.markableHolder} {...this.props} />;
    }

    return <WrappedMarker {...this.props} />;
  }
}
