const marked = require('marked')

const renderer = new marked.Renderer()
renderer.code = () => ''
renderer.blockquote = () => ''
renderer.heading = () => ''
renderer.html = () => ''
renderer.image = () => ''
renderer.list = () => ''

const markdown = text => marked(text, {renderer}).replace(/<p>(.*)<\/p>/, "$1").trim()

module.exports = {
  getSettingDescription(keyPath) {
    const schema = atom.config.getSchema(keyPath)
    let description = ''
    if (schema && schema.description) {
      description = schema.description
    }
    return markdown(description)
  }
}
