/** @babel */

import {CompositeDisposable, Disposable, TextEditor} from 'atom'
import _ from 'underscore-plus'
import CollapsibleSectionPanel from './collapsible-section-panel-2'
import {getSettingDescription} from './rich-description'

const SCOPED_SETTINGS = [
  'autoIndent',
  'autoIndentOnPaste',
  'invisibles',
  'nonWordCharacters',
  'preferredLineLength',
  'scrollPastEnd',
  'showIndentGuide',
  'showInvisibles',
  'softWrap',
  'softWrapAtPreferredLineLength',
  'softWrapHangingIndent',
  'tabLength'
]

export default class SettingsPanel extends CollapsibleSectionPanel {
  constructor (options = {}) {
    super()
    let namespace = options.namespace
    this.element = document.createElement('section')
    this.element.classList.add('section', 'settings-panel')
    this.options = options
    this.disposables = new CompositeDisposable()
    let settings
    if (this.options.scopeName) {
      namespace = 'editor'
      settings = {}
      for (const name of SCOPED_SETTINGS) {
        settings[name] = atom.config.get(name, {scope: [this.options.scopeName]})
      }
    } else {
      settings = atom.config.get(namespace)
    }

    this.element.appendChild(this.elementForSettings(namespace, settings))

    this.disposables.add(this.bindInputFields())
    this.disposables.add(this.bindSelectFields())
    this.disposables.add(this.bindEditors())
    this.disposables.add(this.bindTooltips())
    this.disposables.add(this.handleEvents())
  }

  destroy () {
    this.disposables.dispose()
    this.element.remove()
  }

  elementForSettings (namespace, settings) {
    if (_.isEmpty(settings)) {
      return
    }

    let {title} = this.options
    const includeTitle = this.options.includeTitle != null ? this.options.includeTitle : true
    if (includeTitle) {
      if (title == null) {
        title = `${_.undasherize(_.uncamelcase(namespace))} Settings`
      }
    } else {
      if (title == null) {
        title = "Settings"
      }
    }

    const icon = this.options.icon != null ? this.options.icon : 'gear'
    const {note} = this.options
    const sortedSettings = this.sortSettings(namespace, settings)

    const container = document.createElement('div')
    container.classList.add('section-container')

    const heading = document.createElement('div')
    heading.classList.add('block', 'section-heading', 'icon', `icon-${icon}`)
    heading.textContent = title
    container.appendChild(heading)

    if (note) {
      container.insertAdjacentHTML('beforeend', note)
    }

    const body = document.createElement('div')
    body.classList.add('section-body')
    for (const name of sortedSettings) {
      body.appendChild(elementForSetting(namespace, name, settings[name]))
    }
    container.appendChild(body)

    return container
  }

  sortSettings (namespace, settings) {
    return sortSettings(namespace, settings)
  }

  bindInputFields() {
    const disposables = Array.from(this.element.querySelectorAll('input[id]')).map((input) => {
      let name = input.id
      let type = input.type

      this.observe(name, function(value) {
        if (type === 'checkbox') {
          input.checked = value
        } else {
          if (type === 'color') {
            if (value && value.toHexString && value.toHexString()) {
              value = value.toHexString()
            }
          }

          if (value) {
            input.value = value
          }
        }
      })

      const changeHandler = () => {
        let value = input.value
        if (type === 'checkbox') {
          value = input.checked
        } else {
          value = this.parseValue(type, value)
        }

        if (type === 'color') {
          // This is debounced since the color wheel fires lots of events
          // as you are dragging it around
          clearTimeout(this.colorDebounceTimeout)
          this.colorDebounceTimeout = setTimeout(() => { this.set(name, value) }, 100)
        } else {
          this.set(name, value)
        }
      }

      input.addEventListener('change', changeHandler)
      return new Disposable(() => input.removeEventListener('change', changeHandler))
    })

    return new CompositeDisposable(...disposables)
  }

  observe (name, callback) {
    let params = {sources: [atom.config.getUserConfigPath()]}
    if (this.options.scopeName != null) {
      params.scope = [this.options.scopeName]
    }
    this.disposables.add(atom.config.observe(name, params, callback))
  }

  isDefault (name) {
    let params = {sources: [atom.config.getUserConfigPath()]}
    if (this.options.scopeName != null) {
      params.scope = [this.options.scopeName]
    }
    let defaultValue = this.getDefault(name)
    let value = atom.config.get(name, params)
    return (value == null) || (defaultValue === value)
  }

  getDefault (name) {
    if (this.options.scopeName != null) {
      return atom.config.get(name)
    } else {
      let params = {excludeSources: [atom.config.getUserConfigPath()]}
      if (this.options.scopeName != null) {
        params.scope = [this.options.scopeName]
      }
      return atom.config.get(name, params)
    }
  }

  set (name, value) {
    if (this.options.scopeName) {
      if (value === undefined) {
        atom.config.unset(name, {scopeSelector: this.options.scopeName})
      } else {
        atom.config.set(name, value, {scopeSelector: this.options.scopeName})
      }
    } else {
      atom.config.set(name, value)
    }
  }

  bindSelectFields () {
    const disposables = Array.from(this.element.querySelectorAll('select[id]')).map((select) => {
      const name = select.id
      this.observe(name, (value) => select.value = value)
      const changeHandler = () => {
        this.set(name, select.value)
      }
      select.addEventListener('change', changeHandler)
      return new Disposable(() => select.removeEventListener('change', changeHandler))
    })

    return new CompositeDisposable(...disposables)
  }

  bindEditors() {
    const disposables = Array.from(this.element.querySelectorAll('atom-text-editor')).map((editorElement) => {
      let defaultValue, left
      let editor = editorElement.getModel()
      let name = editorElement.id
      let type = editorElement.getAttribute('type')

      if (defaultValue = this.valueToString(this.getDefault(name))) {
        if (this.options.scopeName != null) {
          editor.setPlaceholderText(`Unscoped value: ${defaultValue}`)
        } else {
          editor.setPlaceholderText(`Default: ${defaultValue}`)
        }
      }

      const subscriptions = new CompositeDisposable()

      const focusHandler = () => {
        if (this.isDefault(name)) {
          editor.setText((left = this.valueToString(this.getDefault(name))) != null ? left : '')
        }
      }
      editorElement.addEventListener('focus', focusHandler)
      subscriptions.add(new Disposable(() => editorElement.removeEventListener('focus', focusHandler)))

      const blurHandler = () => {
        if (this.isDefault(name)) {
          editor.setText('')
        }
      }
      editorElement.addEventListener('blur', blurHandler)
      subscriptions.add(new Disposable(() => editorElement.removeEventListener('blur', blurHandler)))

      this.observe(name, (value) => {
        let stringValue
        if (this.isDefault(name)) {
          stringValue = ''
        } else {
          stringValue = (left = this.valueToString(value)) != null ? left : ''
        }

        if (stringValue === editor.getText() || _.isEqual(value, this.parseValue(type, editor.getText()))) {
          return
        }

        editor.setText(stringValue)
      })

      subscriptions.add(editor.onDidStopChanging(() => {
        this.set(name, this.parseValue(type, editor.getText()))
      }))

      return subscriptions
    })

    return new CompositeDisposable(...disposables)
  }

  bindTooltips () {
    const disposables = Array.from(this.element.querySelectorAll('input[id], select[id], atom-text-editor[id]')).map((element) => {
      let defaultValue = this.valueToString(this.getDefault(element.id))
      if (defaultValue) {
        return atom.tooltips.add(element, {
          title: `Default: ${defaultValue}`,
          delay: {show: 100},
          placement: 'auto left'
        })
      } else {
        return new Disposable(() => {}) // no-op
      }
    })

    return new CompositeDisposable(...disposables)
  }

  valueToString (value) {
    if (Array.isArray(value)) {
      return value.join(', ')
    } else if (value) {
      return value.toString()
    } else {
      return null
    }
  }

  parseValue (type, value) {
    if (value === '') {
      return undefined
    } else if (type === 'number') {
      let floatValue = parseFloat(value)
      if (isNaN(floatValue)) {
        return value
      } else {
        return floatValue
      }
    } else if (type === 'array') {
      let arrayValue = (value || '').split(',')
      return arrayValue.filter((val) => val).map((val) => val.trim())
    }
  }
}

/*
 * Space Pen Helpers
 */

let isEditableArray = function(array) {
  for (let item of array) {
    if (!_.isString(item)) {
      return false
    }
  }
  return true
}

function sortSettings (namespace, settings) {
  return _.chain(settings)
    .keys()
    .sortBy((name) => name)
    .sortBy((name) => {
      const schema = atom.config.getSchema(`${namespace}.${name}`)
      return schema ? schema.order : null
    })
    .value()
}

function elementForSetting (namespace, name, value) {
  if (namespace === 'core') {
    if (name === 'themes') { return document.createDocumentFragment() } // Handled in the Themes panel
    if (name === 'disabledPackages') { return document.createDocumentFragment() } // Handled in the Packages panel
    if (name === 'customFileTypes') { return document.createDocumentFragment() }
  }

  if (namespace === 'editor') {
    // There's no global default for these, they are defined by language packages
    if (['commentStart', 'commentEnd', 'increaseIndentPattern', 'decreaseIndentPattern', 'foldEndPattern'].includes(name)) {
      return document.createDocumentFragment()
    }
  }

  const controlGroup = document.createElement('div')
  controlGroup.classList.add('control-group')

  const controls = document.createElement('div')
  controls.classList.add('controls')
  controlGroup.appendChild(controls)

  let schema = atom.config.getSchema(`${namespace}.${name}`)
  if (schema && schema.enum) {
    controls.appendChild(elementForOptions(namespace, name, value))
  } else if (schema && schema.type === 'color') {
    controls.appendChild(elementForColor(namespace, name, value))
  } else if (_.isBoolean(value) || (schema && schema.type === 'boolean')) {
    controls.appendChild(elementForCheckbox(namespace, name, value))
  } else if (_.isArray(value) || (schema && schema.type === 'array')) {
    if (isEditableArray(value)) {
      controls.appendChild(elementForArray(namespace, name, value))
    }
  } else if (_.isObject(value) || (schema && schema.type === 'object')) {
    controls.appendChild(elementForObject(namespace, name, value))
  } else {
    controls.appendChild(elementForEditor(namespace, name, value))
  }

  return controlGroup
}

function getSettingTitle (keyPath, name) {
  if (name == null) {
    name = ''
  }
  const schema = atom.config.getSchema(keyPath)
  const title = schema != null ? schema.title : null
  return title || _.uncamelcase(name).split('.').map(_.capitalize).join(' ')
}

function elementForOptions (namespace, name, value) {
  let keyPath = `${namespace}.${name}`
  let schema = atom.config.getSchema(keyPath)
  let options = (schema && schema.enum) ? schema.enum : []

  const fragment = document.createDocumentFragment()

  const label = document.createElement('label')
  label.classList.add('control-label')

  const titleDiv = document.createElement('div')
  titleDiv.classList.add('setting-title')
  titleDiv.textContent = getSettingTitle(keyPath, name)
  label.appendChild(titleDiv)

  const descriptionDiv = document.createElement('div')
  descriptionDiv.classList.add('setting-description')
  descriptionDiv.innerHTML = getSettingDescription(keyPath)
  label.appendChild(descriptionDiv)

  fragment.appendChild(label)

  const select = document.createElement('select')
  select.id = keyPath
  select.classList.add('form-control')
  for (const option of options) {
    const optionElement = document.createElement('option')
    if (option.hasOwnProperty('value')) {
      optionElement.value = option.value
      optionElement.textContent = option.description
    } else {
      optionElement.value = option
      optionElement.textContent = option
    }
    select.appendChild(optionElement)
  }

  fragment.appendChild(select)

  return fragment
}

function elementForCheckbox (namespace, name, value) {
  let keyPath = `${namespace}.${name}`

  const div = document.createElement('div')
  div.classList.add('checkbox')

  const label = document.createElement('label')
  label.for = keyPath

  const input = document.createElement('input')
  input.id = keyPath
  input.type = 'checkbox'
  input.classList.add('input-checkbox')
  label.appendChild(input)

  const titleDiv = document.createElement('div')
  titleDiv.classList.add('setting-title')
  titleDiv.textContent = getSettingTitle(keyPath, name)
  label.appendChild(titleDiv)
  div.appendChild(label)

  const descriptionDiv = document.createElement('div')
  descriptionDiv.classList.add('setting-description')
  descriptionDiv.innerHTML = getSettingDescription(keyPath)
  div.appendChild(descriptionDiv)

  return div
}

function elementForColor (namespace, name, value) {
  let keyPath = `${namespace}.${name}`

  const div = document.createElement('div')
  div.classList.add('color')

  const label = document.createElement('label')
  label.for = keyPath

  const input = document.createElement('input')
  input.id = keyPath
  input.type = 'color'
  label.appendChild(input)

  const titleDiv = document.createElement('div')
  titleDiv.classList.add('setting-title')
  titleDiv.textContent = getSettingTitle(keyPath, name)
  label.appendChild(titleDiv)
  div.appendChild(label)

  const descriptionDiv = document.createElement('div')
  descriptionDiv.classList.add('setting-description')
  descriptionDiv.innerHTML = getSettingDescription(keyPath)
  div.appendChild(descriptionDiv)

  return div
}

function elementForEditor (namespace, name, value) {
  let keyPath = `${namespace}.${name}`
  let type = _.isNumber(value) ? 'number' : 'string'

  const fragment = document.createDocumentFragment()

  const label = document.createElement('label')
  label.classList.add('control-label')

  const titleDiv = document.createElement('div')
  titleDiv.classList.add('setting-title')
  titleDiv.textContent = getSettingTitle(keyPath, name)
  label.appendChild(titleDiv)

  const descriptionDiv = document.createElement('div')
  descriptionDiv.classList.add('setting-description')
  descriptionDiv.innerHTML = getSettingDescription(keyPath)
  label.appendChild(descriptionDiv)
  fragment.appendChild(label)

  const controls = document.createElement('div')
  controls.classList.add('controls')

  const editorContainer = document.createElement('div')
  editorContainer.classList.add('editor-container')

  const editor = new TextEditor({mini: true})
  editor.element.id = keyPath
  editor.element.setAttribute('type', type)
  editorContainer.appendChild(editor.element)
  controls.appendChild(editorContainer)
  fragment.appendChild(controls)

  return fragment
}

function elementForArray (namespace, name, value) {
  let keyPath = `${namespace}.${name}`

  const fragment = document.createDocumentFragment()

  const label = document.createElement('label')
  label.classList.add('control-label')

  const titleDiv = document.createElement('div')
  titleDiv.classList.add('setting-title')
  titleDiv.textContent = getSettingTitle(keyPath, name)
  label.appendChild(titleDiv)

  const descriptionDiv = document.createElement('div')
  descriptionDiv.classList.add('setting-description')
  descriptionDiv.innerHTML = getSettingDescription(keyPath)
  label.appendChild(descriptionDiv)
  fragment.appendChild(label)

  const controls = document.createElement('div')
  controls.classList.add('controls')

  const editorContainer = document.createElement('div')
  editorContainer.classList.add('editor-container')

  const editor = new TextEditor({mini: true})
  editor.element.id = keyPath
  editor.element.setAttribute('type', 'array')
  editorContainer.appendChild(editor.element)
  controls.appendChild(editorContainer)
  fragment.appendChild(controls)

  return fragment
}

function elementForObject (namespace, name, value) {
  if (_.keys(value).length === 0) {
    return document.createDocumentFragment()
  } else {
    let keyPath = `${namespace}.${name}`
    let schema = atom.config.getSchema(keyPath)
    let isCollapsed = schema.collapsed === true

    const section = document.createElement('section')
    section.classList.add('sub-section')
    if (isCollapsed) {
      section.classList.add('collapsed')
    }

    const h3 = document.createElement('h3')
    h3.classList.add('sub-section-heading', 'has-items')
    h3.textContent = getSettingTitle(keyPath, name)
    section.appendChild(h3)

    const div = document.createElement('div')
    div.classList.add('sub-section-body')
    for (const key of sortSettings(keyPath, value)) {
      div.appendChild(elementForSetting(namespace, `${name}.${key}`, value[key]))
    }
    section.appendChild(div)

    return div
  }
}
