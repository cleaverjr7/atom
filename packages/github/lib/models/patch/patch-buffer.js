import {TextBuffer, Range, Point} from 'atom';

const LAYER_NAMES = ['unchanged', 'addition', 'deletion', 'nonewline', 'hunk', 'patch'];

export default class PatchBuffer {
  constructor() {
    this.buffer = new TextBuffer();
    this.layers = LAYER_NAMES.reduce((map, layerName) => {
      map[layerName] = this.buffer.addMarkerLayer();
      return map;
    }, {});
  }

  getBuffer() {
    return this.buffer;
  }

  getInsertionPoint() {
    return this.buffer.getEndPosition();
  }

  getLayer(layerName) {
    return this.layers[layerName];
  }

  findMarkers(layerName, ...args) {
    return this.layers[layerName].findMarkers(...args);
  }

  markPosition(layerName, ...args) {
    return this.layers[layerName].markPosition(...args);
  }

  markRange(layerName, ...args) {
    return this.layers[layerName].markRange(...args);
  }

  clearAllLayers() {
    for (const layerName of LAYER_NAMES) {
      this.layers[layerName].clear();
    }
  }

  createModifierAt(insertionPoint) {
    return new Modification(this, Point.fromObject(insertionPoint));
  }

  createModifierAtEnd() {
    return this.createModifierAt(this.getInsertionPoint());
  }
}

class Modification {
  constructor(patchBuffer, insertionPoint) {
    this.patchBuffer = patchBuffer;
    this.startPoint = insertionPoint.copy();
    this.insertionPoint = insertionPoint;
    this.markerBlueprints = [];

    this.markersBefore = new Set();
    this.markersAfter = new Set();
  }

  keepBefore(markers) {
    for (const marker of markers) {
      if (marker.getRange().end.isEqual(this.startPoint)) {
        this.markersBefore.add(marker);
      }
    }
  }

  keepAfter(markers) {
    for (const marker of markers) {
      if (marker.getRange().end.isEqual(this.startPoint)) {
        this.markersAfter.add(marker);
      }
    }
  }

  append(text) {
    const insertedRange = this.patchBuffer.getBuffer().insert(this.insertionPoint, text);
    this.insertionPoint = insertedRange.end;
    return this;
  }

  appendMarked(text, layerName, markerOpts) {
    const start = this.insertionPoint.copy();
    this.append(text);
    const end = this.insertionPoint.copy();
    this.markerBlueprints.push({layerName, range: new Range(start, end), markerOpts});
    return this;
  }

  apply() {
    for (const {layerName, range, markerOpts} of this.markerBlueprints) {
      const callback = markerOpts.callback;
      delete markerOpts.callback;

      const marker = this.patchBuffer.markRange(layerName, range, markerOpts);
      if (callback) {
        callback(marker);
      }
    }

    for (const beforeMarker of this.markersBefore) {
      if (!beforeMarker.isReversed()) {
        beforeMarker.setHeadPosition(this.startPoint);
      } else {
        beforeMarker.setTailPosition(this.startPoint);
      }
    }

    for (const afterMarker of this.markersAfter) {
      if (!afterMarker.isReversed()) {
        afterMarker.setTailPosition(this.insertionPoint);
      } else {
        afterMarker.setHeadPosition(this.insertionPoint);
      }
    }
  }
}
