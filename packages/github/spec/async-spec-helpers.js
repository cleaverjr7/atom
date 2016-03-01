// Lifted from Atom

exports.beforeEach = function (fn) {
  global.beforeEach(function () {
    var result = fn()
    if (result instanceof Promise) {
      waitsForPromise(function () { return result })
    }
  })
}

exports.afterEach = function (fn) {
  global.afterEach(function () {
    var result = fn()
    if (result instanceof Promise) {
      waitsForPromise(function () { return result })
    }
  })
}

exports.runs = function (fn) {
  global.runs(function () {
    var result = fn()
    if (result instanceof Promise) {
      waitsForPromise(function () { return result })
    }
  })
}

var matchers = ['it', 'fit', 'ffit', 'fffit'] // inlining this makes things fail wtf.
matchers.forEach(function (name) {
  exports[name] = function (description, fn) {
    global[name](description, function () {
      var result = fn()
      if (result instanceof Promise) {
        waitsForPromise(function () { return result })
      }
    })
  }
})

function waitsForPromise (fn) {
  var promise = fn()
  waitsFor('spec promise to resolve', 30000, function (done) {
    promise.then(done, function (error) {
      jasmine.getEnv().currentSpec.fail(error)
      return done()
    })
  })
}

exports.waitsForPromise = waitsForPromise
