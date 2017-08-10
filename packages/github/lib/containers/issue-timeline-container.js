import {graphql, createPaginationContainer} from 'react-relay/compat';

import IssueishTimelineView from '../views/issueish-timeline-view';
import CommitsContainer from './../containers/timeline-items/commits-container.js';
import IssueCommentContainer from './../containers/timeline-items/issue-comment-container.js';

const IssueTimelineContainer = createPaginationContainer(IssueishTimelineView, {
  issue: graphql`
    fragment IssueTimelineContainer_issue on Issue {
      url
      timeline(
        first: $timelineCount after: $timelineCursor
      ) @connection(key: "IssueTimelineContainer_timeline") {
        pageInfo { endCursor hasNextPage }
        edges {
          cursor
          node {
            __typename
            ...CommitsContainer_nodes
            ...IssueCommentContainer_item
          }
        }
      }
    }
  `,
}, {
  direction: 'forward',
  getConnectionFromProps(props) {
    return props.issue.timeline;
  },
  getFragmentVariables(prevVars, totalCount) {
    return {
      ...prevVars,
      timelineCount: totalCount,
    };
  },
  getVariables(props, {count, cursor}, fragmentVariables) {
    return {
      url: props.issue.url,
      timelineCount: count,
      timelineCursor: cursor,
    };
  },
  query: graphql`
    query IssueTimelineContainerQuery($timelineCount: Int! $timelineCursor: String $url: URI!) {
      resource(url: $url) {
        ... on Issue {
          ...IssueTimelineContainer_issue
        }
      }
    }
  `,
});

export default IssueTimelineContainer;
