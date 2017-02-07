import React from 'react';

import Decoration from '../views/decoration';
import Octicon from '../views/octicon';

export default class ConflictController extends React.Component {
  static propTypes = {
    editor: React.PropTypes.object.isRequired,
    conflict: React.PropTypes.object.isRequired,
    resolveAsSequence: React.PropTypes.func,
  };

  static defaultProps = {
    resolveAsSequence: sources => {},
  }

  render() {
    return (
      <div>
        {this.renderSide(this.props.conflict.ours)}
        {this.props.conflict.base ? this.renderSide(this.props.conflict.base) : null}
        <Decoration
          key={this.props.conflict.separator.marker.id}
          editor={this.props.editor}
          marker={this.props.conflict.separator.marker}
          type="line"
          className="github-ConflictSeparator"
        />
        {this.renderSide(this.props.conflict.theirs)}
      </div>
    );
  }

  renderSide(side) {
    const source = side.getSource();

    return (
      <div>
        <Decoration
          key={side.banner.marker.id}
          editor={this.props.editor}
          marker={side.getBannerMarker()}
          type="line"
          className={source.getBannerCSSClass()}
        />
        <Decoration
          key={side.marker.id}
          editor={this.props.editor}
          marker={side.getMarker()}
          type="line"
          className={source.getCSSClass()}
        />
        <Decoration
          key={'block-' + side.marker.id}
          editor={this.props.editor}
          marker={side.getBlockMarker()}
          type="block"
          position={side.getBlockPosition()}>
          <div className={side.getBlockCSSClasses()}>
            <span className="github-ResolutionControls">
              <button className="btn btn-sm inline-block">Use me</button>
              <Octicon icon="ellipses" className="inline-block" />
            </span>
            <span className="github-SideDescription">{source.toUIString()}</span>
          </div>
        </Decoration>
      </div>
    );
  }
}
