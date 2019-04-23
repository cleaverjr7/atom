const { TextEditor } = require('atom')
const path = require('path')
const createDOMPurify = require('dompurify')
const fs = require('fs-plus')
let marked = null // Defer until used

const { scopeForFenceName } = require('./extension-helper')
const { resourcePath } = atom.getLoadSettings()
const packagePath = path.dirname(__dirname)

exports.toDOMFragment = function (text, filePath, grammar, callback) {
  if (text == null) {
    text = ''
  }

  render(text, filePath, function (error, domFragment) {
    if (error != null) {
      return callback(error)
    }
    highlightCodeBlocks(
      domFragment,
      grammar,
      makeAtomEditorNonInteractive
    ).then(() => callback(null, domFragment))
  })
}

exports.toHTML = function (text, filePath, grammar, callback) {
  if (text == null) {
    text = ''
  }

  return render(text, filePath, function (error, domFragment) {
    if (error != null) {
      return callback(error)
    }

    const div = document.createElement('div')
    div.appendChild(domFragment)
    document.body.appendChild(div)

    return highlightCodeBlocks(
      div,
      grammar,
      convertAtomEditorToStandardElement
    ).then(function () {
      callback(null, div.innerHTML)
      return div.remove()
    })
  })
}

var render = function (text, filePath, callback) {
  if (marked == null) {
    marked = require('marked')
  }

  marked.setOptions({
    sanitize: false,
    breaks: atom.config.get('markdown-preview.breakOnSingleNewline')
  })

  let html

  try {
    html = marked(text)
  } catch (error) {
    return callback(error)
  }

  html = createDOMPurify().sanitize(html, {
    ALLOW_UNKNOWN_PROTOCOLS: atom.config.get(
      'markdown-preview.allowUnsafeProtocols'
    )
  })

  const template = document.createElement('template')
  template.innerHTML = html.trim()
  const fragment = template.content.cloneNode(true)

  resolveImagePaths(fragment, filePath)
  callback(null, fragment)
}

var resolveImagePaths = function (element, filePath) {
  const [rootDirectory] = atom.project.relativizePath(filePath)

  const result = []
  for (const img of element.querySelectorAll('img')) {
    // We use the raw attribute instead of the .src property because the value
    // of the property seems to be transformed in some cases.
    let src

    if ((src = img.getAttribute('src'))) {
      if (src.match(/^(https?|atom):\/\//)) {
        continue
      }
      if (src.startsWith(process.resourcesPath)) {
        continue
      }
      if (src.startsWith(resourcePath)) {
        continue
      }
      if (src.startsWith(packagePath)) {
        continue
      }

      if (src[0] === '/') {
        if (!fs.isFileSync(src)) {
          if (rootDirectory) {
            result.push((img.src = path.join(rootDirectory, src.substring(1))))
          } else {
            result.push(undefined)
          }
        } else {
          result.push(undefined)
        }
      } else {
        result.push((img.src = path.resolve(path.dirname(filePath), src)))
      }
    } else {
      result.push(undefined)
    }
  }

  return result
}

var highlightCodeBlocks = function (domFragment, grammar, editorCallback) {
  let defaultLanguage, fontFamily
  if (
    (grammar != null ? grammar.scopeName : undefined) === 'source.litcoffee'
  ) {
    defaultLanguage = 'coffee'
  } else {
    defaultLanguage = 'text'
  }

  if ((fontFamily = atom.config.get('editor.fontFamily'))) {
    for (const codeElement of domFragment.querySelectorAll('code')) {
      codeElement.style.fontFamily = fontFamily
    }
  }

  const promises = []
  for (const preElement of domFragment.querySelectorAll('pre')) {
    const codeBlock =
      preElement.firstElementChild != null
        ? preElement.firstElementChild
        : preElement
    const className = codeBlock.getAttribute('class')
    const fenceName =
      className != null ? className.replace(/^language-/, '') : defaultLanguage

    const editor = new TextEditor({
      readonly: true,
      keyboardInputEnabled: false
    })
    const editorElement = editor.getElement()

    preElement.classList.add('editor-colors', `lang-${fenceName}`)
    editorElement.setUpdatedSynchronously(true)
    preElement.innerHTML = ''
    preElement.parentNode.insertBefore(editorElement, preElement)
    editor.setText(codeBlock.textContent.replace(/\r?\n$/, ''))
    atom.grammars.assignLanguageMode(editor, scopeForFenceName(fenceName))
    editor.setVisible(true)

    promises.push(editorCallback(editorElement, preElement))
  }
  return Promise.all(promises)
}

var makeAtomEditorNonInteractive = function (editorElement, preElement) {
  preElement.remove()
  editorElement.setAttributeNode(document.createAttribute('gutter-hidden')) // Hide gutter
  editorElement.removeAttribute('tabindex') // Make read-only

  // Remove line decorations from code blocks.
  for (const cursorLineDecoration of editorElement.getModel()
    .cursorLineDecorations) {
    cursorLineDecoration.destroy()
  }
}

var convertAtomEditorToStandardElement = (editorElement, preElement) => {
  return new Promise(function (resolve) {
    const editor = editorElement.getModel()
    const done = () =>
      editor.component.getNextUpdatePromise().then(function () {
        for (const line of editorElement.querySelectorAll(
          '.line:not(.dummy)'
        )) {
          const line2 = document.createElement('div')
          line2.className = 'line'
          line2.innerHTML = line.firstChild.innerHTML
          preElement.appendChild(line2)
        }
        editorElement.remove()
        resolve()
      })
    const languageMode = editor.getBuffer().getLanguageMode()
    if (languageMode.fullyTokenized || languageMode.tree) {
      done()
    } else {
      editor.onDidTokenize(done)
    }
  })
}
