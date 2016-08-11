/** @babel */

import fs from 'fs'

export function readFile (absoluteFilePath, encoding = 'utf8') {
  return new Promise((resolve, reject) => {
    fs.readFile(absoluteFilePath, encoding, (err, contents) => {
      if (err) reject(err)
      else resolve(contents)
    })
  })
}

export function writeFile (text, file) {
  return new Promise((resolve, reject) => {
    fs.writeFile(file, text, (err) => {
      if (err) return reject(err)
      else return resolve()
    })
  })
}

export function chmod (file, mode) {
  return new Promise((resolve, reject) => {
    fs.chmod(file, mode, (err) => {
      if (err) return reject(err)
      else return resolve()
    })
  })
}

export function deleteFile (file) {
  return new Promise((resolve, reject) => {
    fs.unlink(file, (err) => {
      if (err) return reject(err)
      else return resolve()
    })
  })
}

export function deleteFolder (folder) {
  return new Promise((resolve, reject) => {
    fs.rmdir(folder, (err) => {
      if (err) return reject(err)
      else return resolve()
    })
  })
}

export function getTempDir (prefix) {
  return new Promise((resolve, reject) => {
    fs.mkdtemp(prefix, (err, folder) => {
      if (err) return reject(err)
      else return resolve(folder)
    })
  })
}
