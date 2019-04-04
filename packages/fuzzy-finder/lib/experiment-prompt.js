const etch = require('etch')
const $ = etch.dom
const SCORING_SYSTEMS = require('./scoring-systems')

/**
 * For how long to show the "NEW" badge in the prompt since the first time
 * it was seen (24h).
 */
const TimeToShowNewBadge = 24 * 60 * 10 * 1000
const FirstTimeShownKey = 'fuzzy-finder:prompt-first-time-shown'

function shouldShowBadge () {
  const firstTimeShown = localStorage.getItem(FirstTimeShownKey)
  const now = new Date().getTime()

  if (!firstTimeShown) {
    localStorage.setItem(FirstTimeShownKey, now)

    return true
  }

  return now - firstTimeShown <= TimeToShowNewBadge
}

function showNotification (message, {detail, confirmBtn, cancelBtn, confirmFn, cancelFn}) {
  const notification = atom.notifications.addInfo(
    message,
    {
      detail,
      dismissable: true,
      buttons: [
        {
          text: confirmBtn,
          onDidClick: () => {
            confirmFn && confirmFn()
            notification.dismiss()
          },
          className: 'btn btn-info btn-primary'
        },
        {
          text: cancelBtn,
          onDidClick: () => {
            cancelFn && cancelFn()
            notification.dismiss()
          }
        }
      ],
      icon: 'rocket'
    }
  )
}

function enableExperimentalFuzzyFinder () {
  showNotification(
    'Do you want to enable the new experimental fast mode for the quick open menu?',
    {
      detail: 'This mode can be disabled from the fuzzy finder later',
      confirmBtn: 'Enable experimental fast mode',
      confirmFn: () => {
        atom.config.set('fuzzy-finder.useRipGrep', true)
        atom.config.set('fuzzy-finder.scoringSystem', SCORING_SYSTEMS.FAST)
      },
      cancelBtn: 'No, thanks',
    }
  )
}

function disableExperimentalFuzzyFinder () {
  showNotification(
    'Do you want to enable the new experimental fast mode for the quick open menu?',
    {
      detail: 'You can reenable it later from the fuzzy finder',
      confirmBtn: 'Disable experimental fast mode',
      confirmFn: () => {
        atom.config.set('fuzzy-finder.useRipGrep', false)
        atom.config.set('fuzzy-finder.scoringSystem', SCORING_SYSTEMS.ALTERNATE)
      },
      cancelBtn: 'No, thanks'
    }
  )
}


function isFastModeEnabled () {
  return (
    atom.config.get('fuzzy-finder.scoringSystem') === SCORING_SYSTEMS.FAST &&
    atom.config.get('fuzzy-finder.useRipGrep') === true
  )
}

function renderExperimentPrompt () {
  if (isFastModeEnabled()) {
    return (
      $.span({className: 'experiment-prompt'}, [
        $.a({onmousedown: disableExperimentalFuzzyFinder}, [
          $.span({className: ''}, 'Having issues with the fast mode?'),
          $.span({className: 'icon icon-rocket'}, '')
        ])
      ])
    )
  }

  return (
    $.span({className: 'experiment-prompt'}, [
      $.a({onmousedown: enableExperimentalFuzzyFinder}, [
        shouldShowBadge() ? $.span({className: 'badge badge-info'}, 'NEW') : null,
        $.span({className: ''}, 'Try experimental fast mode?'),
        $.span({className: 'icon icon-microscope'}, '')
      ])
    ])
  )
}

module.exports = {
  renderExperimentPrompt
}
