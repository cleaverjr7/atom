path = require 'path'

PackageDetailView = require '../lib/package-detail-view'
PackageManager = require '../lib/package-manager'

describe "PackageDetailView", ->
  packageManager = null
  view = null

  createClientSpy = ->
    jasmine.createSpyObj('client', ['package', 'avatar'])

  beforeEach ->
    packageManager = new PackageManager
    view = null

  loadPackageFromRemote = (opts) ->
    opts ?= {}
    packageManager.client = createClientSpy()
    packageManager.client.package.andCallFake (name, cb) ->
      cb(null, require(path.join(__dirname, 'fixtures', 'package-with-readme', 'package.json')))
    view = new PackageDetailView({name: 'package-with-readme'}, packageManager)
    view.beforeShow(opts)


  it "Renders a package when provided in `initialize`", ->
    atom.packages.loadPackage(path.join(__dirname, 'fixtures', 'package-with-config'))
    pack = atom.packages.getLoadedPackage('package-with-config')
    view = new PackageDetailView(pack, packageManager)

    # Perhaps there are more things to assert here.
    expect(view.title.text()).toBe('Package With Config')

  it "Does not call the atom.io api for package metadata when present", ->
    packageManager.client = createClientSpy()
    view = new PackageDetailView({name: 'package-with-config'}, packageManager)

    # PackageCard is a subview, and it calls AtomIoClient::package once to load
    # metadata from the cache.
    expect(packageManager.client.package.callCount).toBe(1)

  it "Shows a loading message and calls out to atom.io when package metadata is missing", ->
    loadPackageFromRemote()
    expect(view.loadingMessage).not.toBe(null)
    expect(view.loadingMessage[0].classList.contains('hidden')).not.toBe(true)
    expect(packageManager.client.package).toHaveBeenCalled()

  it "Shows an error when package metadata cannot be loaded", ->
    packageManager.client = createClientSpy()
    packageManager.client.package.andCallFake (name, cb) ->
      error = new Error('API or cache error')
      cb(error, null)

    view = new PackageDetailView({name: 'nonexistent-package'}, packageManager)

    expect(view.errorMessage[0].classList.contains('hidden')).not.toBe(true)
    expect(view.loadingMessage[0].classList.contains('hidden')).toBe(true)
    expect(view.find('.package-card').length).toBe(0)

  xit "Renders the package successfully after a call to the atom.io api"

  it "Should show 'Install' as the first breadcrumb by default", ->
    loadPackageFromRemote()
    expect(view.breadcrumb.text()).toBe('Install')
