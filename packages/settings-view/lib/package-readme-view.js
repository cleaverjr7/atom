/** @babel */

import roaster from 'roaster'

const ATTRIBUTES_TO_REMOVE = [
  'onabort',
  'onblur',
  'onchange',
  'onclick',
  'ondbclick',
  'onerror',
  'onfocus',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'onload',
  'onmousedown',
  'onmousemove',
  'onmouseover',
  'onmouseout',
  'onmouseup',
  'onreset',
  'onresize',
  'onscroll',
  'onselect',
  'onsubmit',
  'onunload'
]

function sanitize (html) {
  const temporaryContainer = document.createElement('div')
  temporaryContainer.innerHTML = html

  for (const script of temporaryContainer.querySelectorAll('script')) {
    script.remove()
  }

  for (const element of temporaryContainer.querySelectorAll('*')) {
    for (const attribute of ATTRIBUTES_TO_REMOVE) {
      element.removeAttribute(attribute)
    }
  }

  for (const checkbox of temporaryContainer.querySelectorAll('input[type="checkbox"]')) {
    checkbox.setAttribute('disabled', true)
  }

  return temporaryContainer.innerHTML
}

// Displays the readme for a package, if it has one
// TODO Decide to keep this or current button-to-new-tab view
export default class PackageReadmeView {
  constructor (readme) {
    this.element = document.createElement('section')
    this.element.classList.add('section')

    const container = document.createElement('div')
    container.classList.add('section-container')

    const heading = document.createElement('div')
    heading.classList.add('section-heading', 'icon', 'icon-book')
    heading.textContent = 'README'
    container.appendChild(heading)

    this.packageReadme = document.createElement('div')
    this.packageReadme.classList.add('package-readme', 'native-key-bindings')
    this.packageReadme.tabIndex = -1
    container.appendChild(this.packageReadme)
    this.element.appendChild(container)

    roaster(readme || '### No README.', (err, content) => {
      if (err) {
        this.packageReadme.innerHTML = '<h3>Error parsing README</h3>'
      } else {
        this.packageReadme.innerHTML = sanitize(content)
      }
    })
  }

  destroy () {
    this.element.remove()
  }
}
