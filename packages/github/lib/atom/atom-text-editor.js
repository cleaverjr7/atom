import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {TextEditor} from 'atom';
import {CompositeDisposable} from 'event-kit';

import RefHolder from '../models/ref-holder';
import {RefHolderPropType} from '../prop-types';
import {extractProps} from '../helpers';

const editorUpdateProps = {
  mini: PropTypes.bool,
  readOnly: PropTypes.bool,
  placeholderText: PropTypes.string,
  lineNumberGutterVisible: PropTypes.bool,
  autoHeight: PropTypes.bool,
  autoWidth: PropTypes.bool,
  softWrapped: PropTypes.bool,
};

const editorCreationProps = {
  buffer: PropTypes.object,
  ...editorUpdateProps,
};

const EMPTY_CLASS = 'github-AtomTextEditor-empty';

export const TextEditorContext = React.createContext();

export default class AtomTextEditor extends React.Component {
  static propTypes = {
    ...editorCreationProps,

    didChangeCursorPosition: PropTypes.func,
    didAddSelection: PropTypes.func,
    didChangeSelectionRange: PropTypes.func,
    didDestroySelection: PropTypes.func,

    hideEmptiness: PropTypes.bool,
    className: PropTypes.string,

    refModel: RefHolderPropType,

    children: PropTypes.node,
  }

  static defaultProps = {
    didChangeCursorPosition: () => {},
    didAddSelection: () => {},
    didChangeSelectionRange: () => {},
    didDestroySelection: () => {},

    hideEmptiness: false,
  }

  constructor(props) {
    super(props);

    this.subs = new CompositeDisposable();

    this.refParent = new RefHolder();
    this.refElement = new RefHolder();
    this.refModel = null;
  }

  render() {
    return (
      <Fragment>
        <div className="github-AtomTextEditor-container" ref={this.refParent.setter} />
        <TextEditorContext.Provider value={this.getRefModel()}>
          {this.props.children}
        </TextEditorContext.Provider>
      </Fragment>
    );
  }

  componentDidMount() {
    const modelProps = extractProps(this.props, editorCreationProps);

    this.refParent.map(element => {
      const editor = new TextEditor(modelProps);
      if (this.props.className) {
        editor.getElement().classList.add(this.props.className);
      }
      element.appendChild(editor.getElement());
      this.getRefModel().setter(editor);
      this.refElement.setter(editor.getElement());

      this.subs.add(
        editor.onDidChangeCursorPosition(this.props.didChangeCursorPosition),
        editor.observeSelections(this.observeSelections),
        editor.onDidChange(this.observeEmptiness),
      );

      if (editor.isEmpty() && this.props.hideEmptiness) {
        editor.getElement().classList.add(EMPTY_CLASS);
      }

      return null;
    });
  }

  componentDidUpdate() {
    const modelProps = extractProps(this.props, editorUpdateProps);
    this.getRefModel().map(editor => editor.update(modelProps));

    // When you look into the abyss, the abyss also looks into you
    this.observeEmptiness();
  }

  componentWillUnmount() {
    this.getRefModel().map(editor => editor.destroy());
    this.subs.dispose();
  }

  observeSelections = selection => {
    const selectionSubs = new CompositeDisposable(
      selection.onDidChangeRange(this.props.didChangeSelectionRange),
      selection.onDidDestroy(() => {
        selectionSubs.dispose();
        this.subs.remove(selectionSubs);
        this.props.didDestroySelection(selection);
      }),
    );
    this.subs.add(selectionSubs);
    this.props.didAddSelection(selection);
  }

  observeEmptiness = () => {
    this.getRefModel().map(editor => {
      if (editor.isEmpty() && this.props.hideEmptiness) {
        this.refElement.map(element => element.classList.add(EMPTY_CLASS));
      } else {
        this.refElement.map(element => element.classList.remove(EMPTY_CLASS));
      }
      return null;
    });
  }

  contains(element) {
    return this.refElement.map(e => e.contains(element)).getOr(false);
  }

  focus() {
    this.refElement.map(e => e.focus());
  }

  getRefModel() {
    if (this.props.refModel) {
      return this.props.refModel;
    }

    if (!this.refModel) {
      this.refModel = new RefHolder();
    }

    return this.refModel;
  }

  getModel() {
    return this.getRefModel().getOr(undefined);
  }
}
