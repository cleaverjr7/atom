fs = require 'fs-plus'
path = require 'path'

app = require('remote').require('app')
glob = require 'glob'
request = require 'request'

module.exports =
class AtomIoClient
  constructor: (@baseURL) ->
    @baseURL ?= 'https://atom.io/api/'
    # 12 hour expiry
    @expiry = 1000 * 60 * 60 * 12
    @createAvatarCache()

  # Public: Get an avatar image from the filesystem, fetching it first if necessary
  avatar: (login, callback) ->
    @cachedAvatar login, (err, cached) =>
      # TODO this code currently doesn't ever refresh the cache.
      if cached
        callback null, cached
      else
        @fetchAndCacheAvatar(login, callback)

  # Public: get a package from the atom.io API, with the appropriate level of
  # caching.
  package: (name, callback) ->
    packagePath = "packages/#{name}"
    @fetchFromCache packagePath, {}, (err, data) =>
      if data
        callback(null, data)
      else
        @request("#{@baseURL}#{packagePath}", callback)

  request: (path, callback) ->
    request path, (err, res, body) =>
      data = JSON.parse(body)
      delete data['versions'] if data['versions']
      cached =
        data: data
        createdOn: Date.now()
      localStorage.setItem(@cacheKeyForPath(packagePath), JSON.stringify(cached))
      callback(err, cached.data) # TODO handle parse error

  cacheKeyForPath: (path) ->
    "settings-view:#{path}"

  online: ->
    navigator.onLine

  fetchFromCache: (packagePath, options, callback) ->
    unless callback
      callback = options
      options = {}

    unless options.force
      # Set `force` to true if we can't reach the network.
      options.force = !@online()

    cached = localStorage.getItem(@cacheKeyForPath(packagePath))
    cached = if cached then JSON.parse(cached)
    # TODO - Needs to always return cached data when api is unreachable
    if cached? and (options.force or (Date.now() - cached.createdOn < @expiry))
      cached ?=  {data: {}}
      callback(null, cached.data)
    else
      callback(null, null)

  createAvatarCache: () ->
    cachePath = path.join(app.getDataPath(), 'Cache')
    fs.exists cachePath, (exists) ->
      fs.mkdirSync(cachePath) unless exists
      fs.exists path.join(cachePath, 'settings-view'), (exists) ->
        fs.mkdirSync(path.join(cachePath, 'settings-view')) unless exists

  avatarPath: (login) ->
    path.join app.getDataPath(), 'Cache/settings-view', "#{login}-#{Date.now()}"

  cachedAvatar: (login, callback) ->
    glob @avatarGlob(login), (err, files) =>
      files.sort().reverse()
      for imagePath in files
        filename = path.basename(imagePath)
        [..., createdOn] = filename.split('-')
        # TODO don't check expiry if network connection is not avail
        if Date.now() - parseInt(createdOn) < @expiry
          return callback(null, imagePath)
          break
      callback(null, null)

  avatarGlob: (login) ->
    path.join app.getDataPath(), 'Cache/settings-view', "#{login}-*"

  fetchAndCacheAvatar: (login, callback) ->
    # TODO clean up cache
    imagePath = @avatarPath login
    stream = fs.createWriteStream imagePath
    stream.on 'finish', () -> callback(null, imagePath)
    # TODO stream.on error
    request("https://github.com/#{login}.png").pipe(stream)
