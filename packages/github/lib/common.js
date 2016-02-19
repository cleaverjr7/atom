/* @flow */

export const DiffURI = 'atom://git-proto/diff/'

export type FromStringable<T> = {fromString: (s: string) => T}

export function createObjectsFromString <T> (diffString: string, markerString: string, classToCreate: FromStringable<T>): Array<T> {
  let objects = []
  let lines = diffString.split('\n')
  let objectLines = null

  function createObject (lines) {
    if (!lines) return

    let obj = classToCreate.fromString(lines.join('\n'))
    objects.push(obj)
  }

  for (let line of lines) {
    if (line.startsWith(markerString)) {
      createObject(objectLines)
      objectLines = []
    }
    if (objectLines) objectLines.push(line)
  }
  createObject(objectLines)

  return objects
}

export type ObjectMap<V> = { [key: string]: V }
