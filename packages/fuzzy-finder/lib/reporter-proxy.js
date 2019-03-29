const _ = require('underscore-plus')

module.exports = class ReporterProxy {
  constructor () {
    this.reporter = null
    this.timingsQueue = []

    this.eventType = 'fuzzy-finder-v1'

    this._addTimingThrottled = _.throttle(this._addTiming.bind(this), 60 * 1000)
  }

  setReporter (reporter) {
    this.reporter = reporter
    let timingsEvent

    while ((timingsEvent = this.timingsQueue.shift())) {
      this.reporter.addTiming(this.eventType, timingsEvent[0], timingsEvent[1])
    }
  }

  unsetReporter () {
    this._addTimingThrottled.cancel()

    delete this.reporter
  }

  sendCrawlEvent (duration, numFiles, crawlerType) {
    const metadata = {
      ec: 'time-to-crawl',
      el: crawlerType,
      ev: numFiles
    }

    this._addTiming(duration, metadata)
  }

  sendFilterEvent (duration, numFiles, scoringSystem) {
    const metadata = {
      ec: 'time-to-filter',
      el: scoringSystem,
      ev: numFiles
    }

    this._addTimingThrottled(duration, metadata)
  }

  _addTiming (duration, metadata) {
    if (this.reporter) {
      this.reporter.addTiming(this.eventType, duration, metadata)
    } else {
      this.timingsQueue.push([duration, metadata])
    }
  }
}
