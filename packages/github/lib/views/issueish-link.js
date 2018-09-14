import url from 'url';
import {shell} from 'electron';

import React from 'react';
import PropTypes from 'prop-types';

import IssueishDetailItem from '../items/issueish-detail-item';
import {addEvent} from '../reporter-proxy';

// eslint-disable-next-line no-shadow
export default function IssueishLink({url, children, ...others}) {
  function clickHandler(event) {
    handleClickEvent(event, url);
  }

  return <a {...others} onClick={clickHandler}>{children}</a>;
}

IssueishLink.propTypes = {
  url: PropTypes.string.isRequired,
  children: PropTypes.node,
};


// eslint-disable-next-line no-shadow
export function handleClickEvent(event, url) {
  if (!event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    openIssueishLinkInNewTab(url, {activate: !(event.metaKey || event.ctrlKey)});
  } else {
    // Open in browser if shift key held
    openLinkInBrowser(url);
  }
}

// eslint-disable-next-line no-shadow
export function openIssueishLinkInNewTab(url, options = {}) {
  const uri = getAtomUriForGithubUrl(url);
  if (uri) {
    openInNewTab(uri, options);
  }
}

export function openLinkInBrowser(uri) {
  shell.openExternal(uri);
  addEvent('open-issueish-in-browser', {package: 'github', from: 'issueish-link'});
}

function getAtomUriForGithubUrl(githubUrl) {
  return getUriForData(getDataFromGithubUrl(githubUrl));
}

export function getDataFromGithubUrl(githubUrl) {
  const {hostname, pathname} = url.parse(githubUrl);
  const [repoOwner, repoName, type, issueishNumber] = pathname.split('/').filter(s => s);
  return {hostname, repoOwner, repoName, type, issueishNumber: parseInt(issueishNumber, 10)};
}

function getUriForData({hostname, repoOwner, repoName, type, issueishNumber}) {
  if (hostname !== 'github.com' || !['pull', 'issues'].includes(type) || !issueishNumber || isNaN(issueishNumber)) {
    return null;
  } else {
    return IssueishDetailItem.buildURI('https://api.github.com', repoOwner, repoName, issueishNumber);
  }
}

function openInNewTab(uri, {activate} = {activate: true}) {
  let promise;
  if (activate) {
    promise = atom.workspace.open(uri, {activateItem: activate});
  } else {
    const item = IssueishDetailItem.opener(uri);
    promise = atom.workspace.getActivePane().addItem(item);
  }
  promise.then(() => {
    addEvent('open-issueish-in-pane', {package: 'github', from: 'issueish-link', target: 'new-tab'});
  });
}
