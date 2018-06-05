import React from 'react';
import PropTypes from 'prop-types';
import {Disposable} from 'event-kit';

import {autobind, extractProps} from '../helpers';
import RefHolder from '../models/ref-holder';
import {TextEditorContext} from './atom-text-editor';

const markerLayerProps = {
  maintainHistory: PropTypes.bool,
  persistent: PropTypes.bool,
};

export const MarkerLayerContext = React.createContext();

class WrappedMarkerLayer extends React.Component {
  static propTypes = {
    ...markerLayerProps,
    editor: PropTypes.object,
    children: PropTypes.element,
    handleID: PropTypes.func,
  };

  static defaultProps = {
    handleID: () => {},
  }

  constructor(props) {
    super(props);

    autobind(this, 'createLayer');

    this.sub = new Disposable();
    this.layerHolder = new RefHolder();
    this.state = {
      editorHolder: RefHolder.on(this.props.editor),
    };
  }

  static getDerivedStateFromProps(props, state) {
    if (state.editorHolder.map(e => e === props.editor).getOr(props.editor === undefined)) {
      return null;
    }

    return {
      editorHolder: RefHolder.on(props.editor),
    };
  }

  componentDidMount() {
    this.observeEditor();
  }

  render() {
    return (
      <MarkerLayerContext.Provider value={this.layerHolder}>
        {this.props.children}
      </MarkerLayerContext.Provider>
    );
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.editorHolder !== prevState.editorHolder) {
      this.observeEditor();
    }
  }

  componentWillUnmount() {
    this.layerHolder.map(layer => layer.destroy());
    this.sub.dispose();
  }

  observeEditor() {
    this.sub.dispose();
    this.sub = this.state.editorHolder.observe(this.createLayer);
  }

  createLayer() {
    this.layerHolder.map(layer => layer.destroy());

    const options = extractProps(this.props, markerLayerProps);


    this.layerHolder.setter(
      this.state.editorHolder.map(editor => editor.addMarkerLayer(options)).getOr(null),
    );
    this.props.handleID(this.getID());
  }

  getID() {
    return this.layerHolder.map(layer => layer.id).getOr(undefined);
  }
}

export default class MarkerLayer extends React.Component {
  render() {
    return (
      <TextEditorContext.Consumer>
        {editor => <WrappedMarkerLayer editor={editor} {...this.props} />}
      </TextEditorContext.Consumer>
    );
  }
}
