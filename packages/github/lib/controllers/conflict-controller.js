import React from 'react';
import {remote} from 'electron';
const {Menu, MenuItem} = remote;

import {autobind} from 'core-decorators';
import {OURS, BASE, THEIRS} from '../models/conflicts/source';
import Decoration from '../views/decoration';
import Octicon from '../views/octicon';

export default class ConflictController extends React.Component {
  static propTypes = {
    editor: React.PropTypes.object.isRequired,
    conflict: React.PropTypes.object.isRequired,
    resolveAsSequence: React.PropTypes.func,
    dismiss: React.PropTypes.func,
  };

  static defaultProps = {
    resolveAsSequence: sources => {},
    dismiss: () => {},
  }

  constructor(props, context) {
    super(props, context);

    this.state = {
      chosenSide: this.props.conflict.getChosenSide(),
    };
  }

  resolveAsSequence(sources) {
    this.props.resolveAsSequence(sources);

    this.setState({
      chosenSide: this.props.conflict.getChosenSide(),
    });
  }

  revert(side) {
    side.isModified() && side.revert();
    side.isBannerModified() && side.revertBanner();
  }

  @autobind
  showResolveMenu(event) {
    event.preventDefault();

    const menu = new Menu();

    menu.append(new MenuItem({
      label: 'Resolve as Ours',
      click: this.resolveAsSequence.bind(this, [OURS]),
    }));

    if (this.props.conflict.getSide(BASE)) {
      menu.append(new MenuItem({
        label: 'Resolve as Base',
        click: this.resolveAsSequence.bind(this, [BASE]),
      }));
    }

    menu.append(new MenuItem({
      label: 'Resolve as Theirs',
      click: this.resolveAsSequence.bind(this, [THEIRS]),
    }));

    menu.append(new MenuItem({type: 'separator'}));

    menu.append(new MenuItem({
      label: 'Resolve as Ours Then Theirs',
      click: this.resolveAsSequence.bind(this, [OURS, THEIRS]),
    }));
    menu.append(new MenuItem({
      label: 'Resolve as Theirs Then Ours',
      click: this.resolveAsSequence.bind(this, [THEIRS, OURS]),
    }));

    menu.append(new MenuItem({type: 'separator'}));

    menu.append(new MenuItem({
      label: 'Dismiss',
      click: this.props.dismiss,
    }));

    menu.popup(remote.getCurrentWindow());
  }

  render() {
    if (!this.state.chosenSide) {
      const ours = this.props.conflict.getSide(OURS);
      const base = this.props.conflict.getSide(BASE);
      const theirs = this.props.conflict.getSide(THEIRS);

      return (
        <div>
          {this.renderSide(ours)}
          {base && this.renderSide(base)}
          <Decoration
            key={this.props.conflict.getSeparator().getMarker().id}
            editor={this.props.editor}
            marker={this.props.conflict.getSeparator().getMarker()}
            type="line"
            className="github-ConflictSeparator"
          />
          {this.renderSide(theirs)}
        </div>
      );
    } else {
      return (
        <Decoration
          editor={this.props.editor}
          marker={this.state.chosenSide.getMarker()}
          type="line"
          className="github-ResolvedLines"
        />
      );
    }
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
          className={side.getBannerCSSClass()}
        />
        {side.isBannerModified() ||
          <Decoration
            key={'banner-modified-' + side.banner.marker.id}
            editor={this.props.editor}
            marker={side.getBannerMarker()}
            type="line"
            className="github-ConflictUnmodifiedBanner"
          />
        }
        <Decoration
          key={side.marker.id}
          editor={this.props.editor}
          marker={side.getMarker()}
          type="line"
          className={side.getLineCSSClass()}
        />
        <Decoration
          key={'block-' + side.marker.id}
          editor={this.props.editor}
          marker={side.getBlockMarker()}
          type="block"
          position={side.getBlockPosition()}>
          <div className={side.getBlockCSSClasses()}>
            <span className="github-ResolutionControls">
              <button className="btn btn-sm inline-block" onClick={() => this.resolveAsSequence([source])}>
                Use me
              </button>
              {(side.isModified() || side.isBannerModified()) &&
                <button className="btn btn-sm inline-block" onClick={() => this.revert(side)}>
                  Revert
                </button>
              }
              <Octicon icon="ellipses" className="inline-block" onClick={this.showResolveMenu} />
            </span>
            <span className="github-SideDescription">{source.toUIString()}</span>
          </div>
        </Decoration>
      </div>
    );
  }
}
