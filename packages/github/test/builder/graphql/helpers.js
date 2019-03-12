class Spec {
  constructor(node) {
    this.node = node;
  }

  getRequestedFields(kind) {
    return this.node.selections
      .filter(each => each.kind === kind)
      .map(each => each.alias || each.name);
  }

  getRequestedScalarFields() {
    return this.getRequestedFields('ScalarField');
  }

  getRequestedLinkedFields() {
    return this.getRequestedFields('LinkedField');
  }

  getLinkedNode(name) {
    const subNode = this.node.selections.find(each => each.alias === name) ||
      this.node.selections.find(each => each.name === name);
    if (!subNode) {
      throw new Error(`Unable to find linked field ${name}`);
    }
    return subNode;
  }
}

const UNSET = Symbol('unset');

function capitalize(word) {
  return word[0].toUpperCase() + word.slice(1);
}

function makeDefaultGetterName(fieldName) {
  return `getDefault${capitalize(fieldName)}`;
}

function makeAdderFunctionName(fieldName) {
  return `add${capitalize(fieldName)}`;
}

function makeNullableFunctionName(fieldName) {
  return `null${capitalize(fieldName)}`;
}

// Superclass for Builders that are expected to adhere to the fields requested by a GraphQL fragment.
class SpecBuilder {
  constructor(node) {
    this.spec = new Spec(node);

    this.knownScalarFieldNames = new Set(this.spec.getRequestedScalarFields());
    this.knownLinkedFieldNames = new Set(this.spec.getRequestedLinkedFields());

    this.fields = {};
    for (const fieldName of [...this.knownScalarFieldNames, ...this.knownLinkedFieldNames]) {
      this.fields[fieldName] = UNSET;
    }
  }

  singularScalarFieldSetter(fieldName, value) {
    if (!this.knownScalarFieldNames.has(fieldName)) {
      /* eslint-disable-next-line no-console */
      console.error('Try re-running "npm run relay" to regenerate the compiled GraphQL modules.');
      throw new Error(`Unrecognized field name ${fieldName} in ${this.builderName}`);
    }
    this.fields[fieldName] = value;
    return this;
  }

  pluralScalarFieldAdder(fieldName, value) {
    if (!this.knownScalarFieldNames.has(fieldName)) {
      /* eslint-disable-next-line no-console */
      console.error('Try re-running "npm run relay" to regenerate the compiled GraphQL modules.');
      throw new Error(`Unrecognized field name ${fieldName} in ${this.builderName}`);
    }

    if (this.fields[fieldName] === UNSET) {
      this.fields[fieldName] = [];
    }
    this.fields[fieldName].push(value);

    return this;
  }

  singularLinkedFieldSetter(fieldName, Builder, block) {
    if (!this.knownLinkedFieldNames.has(fieldName)) {
      /* eslint-disable-next-line no-console */
      console.error('Try re-running "npm run relay" to regenerate the compiled GraphQL modules.');
      throw new Error(`Unrecognized field name ${fieldName} in ${this.builderName}`);
    }

    const builder = new Builder(this.spec.getLinkedNode(fieldName));
    block(builder);
    this.fields[fieldName] = builder.build();

    return this;
  }

  pluralLinkedFieldAdder(fieldName, Builder, block) {
    if (!this.knownLinkedFieldNames.has(fieldName)) {
      /* eslint-disable-next-line no-console */
      console.error('Try re-running "npm run relay" to regenerate the compiled GraphQL modules.');
      throw new Error(`Unrecognized field name ${fieldName} in ${this.builderName}`);
    }

    if (this.fields[fieldName] === UNSET) {
      this.fields[fieldName] = [];
    }

    const builder = new Builder(this.spec.getLinkedNode(fieldName));
    block(builder);
    this.fields[fieldName].push(builder.build());

    return this;
  }

  nullField(fieldName) {
    if (!this.knownScalarFieldNames.has(fieldName) && !this.knownLinkedFieldNames.has(fieldName)) {
      /* eslint-disable-next-line no-console */
      console.error('Try re-running "npm run relay" to regenerate the compiled GraphQL modules.');
      throw new Error(`Unrecognized field name ${fieldName} in ${this.builderName}`);
    }

    this.fields[fieldName] = null;
    return this;
  }

  build() {
    const fieldNames = Object.keys(this.fields);

    const missingFieldNames = [];

    const populators = {};
    for (const fieldName of fieldNames) {
      const defaultGetterName = makeDefaultGetterName(fieldName);
      Object.defineProperty(populators, fieldName, {
        get: () => {
          if (this.fields[fieldName] !== UNSET) {
            return this.fields[fieldName];
          } else {
            const value = this[defaultGetterName](populators);
            this.fields[fieldName] = value;
            return value;
          }
        },
      });
    }

    if (missingFieldNames.length > 0) {
      /* eslint-disable-next-line no-console */
      console.error('Either give these fields a "default" in the builder or call their setters.');
      throw new Error(`Missing required fields ${missingFieldNames.join(', ')} in builder ${this.builderName}`);
    }

    for (const fieldName of fieldNames) {
      populators[fieldName];
    }

    return this.fields;
  }
}

export function createSpecBuilderClass(name, fieldDescriptions) {
  class Builder extends SpecBuilder {}
  Builder.prototype.builderName = name;

  function installScalarSetter(fieldName) {
    Builder.prototype[fieldName] = function(_value) {
      return this.singularScalarFieldSetter(fieldName, _value);
    };
  }

  function installScalarAdder(fieldName) {
    Builder.prototype[makeAdderFunctionName(fieldName)] = function(_value) {
      return this.pluralScalarFieldAdder(fieldName, _value);
    };
  }

  function installLinkedSetter(fieldName, LinkedBuilder) {
    Builder.prototype[fieldName] = function(_block = () => {}) {
      return this.singularLinkedFieldSetter(fieldName, LinkedBuilder, _block);
    };
  }

  function installLinkedAdder(fieldName, LinkedBuilder) {
    Builder.prototype[makeAdderFunctionName(fieldName)] = function(_block = () => {}) {
      return this.pluralLinkedFieldAdder(fieldName, LinkedBuilder, _block);
    };
  }

  function installNullableFunction(fieldName) {
    Builder.prototype[makeNullableFunctionName(fieldName)] = function() {
      return this.nullField(fieldName);
    };
  }

  function installDefaultGetter(fieldName, descriptionDefault) {
    const defaultGetterName = makeDefaultGetterName(fieldName);
    const defaultGetter = typeof descriptionDefault === 'function' ? descriptionDefault : function() {
      return descriptionDefault;
    };
    Builder.prototype[defaultGetterName] = defaultGetter;
  }

  function installDefaultPluralGetter(fieldName) {
    installDefaultGetter(fieldName, function() { return []; });
  }

  function installDefaultLinkedGetter(fieldName) {
    installDefaultGetter(fieldName, function() {
      this[fieldName]();
      return this.fields[fieldName];
    });
  }

  for (const fieldName in fieldDescriptions) {
    const description = fieldDescriptions[fieldName];
    if (description.linked === undefined) {
      if (description.plural) {
        installScalarAdder(fieldName);
      } else {
        installScalarSetter(fieldName);
      }
    } else {
      if (description.plural) {
        installLinkedAdder(fieldName, description.linked);
      } else {
        installLinkedSetter(fieldName, description.linked);
      }
    }

    if (description.default !== undefined) {
      installDefaultGetter(fieldName, description.default);
    } else if (description.plural) {
      installDefaultPluralGetter(fieldName);
    } else if (description.linked) {
      installDefaultLinkedGetter(fieldName);
    }

    if (description.nullable) {
      installNullableFunction(fieldName);
    }
  }

  return Builder;
}
