const path = require('path');

const {Toolkit} = require('actions-toolkit');
const fetchSchema = require('./fetch-schema');

Toolkit.run(async tools => {
  tools.log.info('Fetching the latest GraphQL schema changes.');
  await fetchSchema();

  const {exitCode: hasSchemaChanges} = await tools.runInWorkspace(
    'git', ['diff', '--quiet', '--', 'graphql/schema.graphql'],
    {reject: false},
  );
  if (hasSchemaChanges === 0) {
    tools.log.info('No schema changes to fetch.');
    tools.exit.neutral('Nothing to do.');
  }

  tools.log.info('Committing schema changes.');
  await tools.runInWorkspace('git', ['commit', '--all', '--message=":arrow_up: GraphQL schema"']);

  tools.log.info('Re-running relay compiler.');
  await tools.runInWorkspace(
    path.resolve(__dirname, 'node_modules', '.bin', 'relay-compiler'),
    ['--src', './lib', '--schema', 'graphql/schema.graphql'],
  );

  const {exitCode: hasRelayChanges} = await tools.runInWorkspace(
    'git', ['diff', '--quiet', '--', '**/__generated__/*.graphql.js'],
    {reject: false},
  );
  if (hasRelayChanges === 0) {
    tools.log.info('Generated relay files are unchanged.');
    await tools.runInWorkspace('git', ['push']);
    tools.exit.success('Schema is up to date on master.');
  }

  tools.log.info('Checking for unmerged schema update pull requests.');
  const {data: openSchemaUpdatePRs} = await tools.github.graphql(`
    query OpenPullRequests($owner: String!, $repo: String!) {
      repository(owner: $owner, name: repo) {
        pullRequests(first: 1, states: [OPEN], labels: ["schema update"]) {
          totalCount
        }
      }
    }
  `, {...tools.context.repo});

  if (openSchemaUpdatePRs.repository.pullRequests.totalCount > 0) {
    tools.exit.failure('One or more schema update pull requests are already open. Please resolve those first.');
  }

  const branchName = `schema-update/${Date.now()}`;
  tools.log.info(`Commiting relay-compiler changes to a new branch ${branchName}.`);
  await tools.runInWorkspace('git', ['checkout', '-b', branchName]);
  await tools.runInWorkspace('git', ['commit', '--all', '--message=":gear: relay-compiler changes"']);
  await tools.runInWorkspace('git', ['push', 'origin', branchName]);

  tools.log.info('Creating a pull request.');

  const body = `:robot: _This automated pull request brought to you by a GitHub action_ :robot:

The GraphQL schema has been automatically updated and relay-compiler has been re-run on the package source. This
pull request will be automatically merged if all status checks are :white_check_mark:.`;

  const {data: createPR} = await tools.github.graphql(`
    mutation CreatePullRequest($owner: String!, $repo: String!, $body: String!, $headRefName: String!) {
      createPullRequest(input: {
        title: "GraphQL schema update"
        body: $body
        headRefName: $headRefName
      }) {
        pullRequest {
          id
          number
        }
      }
    }
  `, {...tools.context.repo, body, headRefName: branchName});

  const createdPullRequest = createPR.createPullRequest.pullRequest;
  tools.log.info(
    `Pull request #${createdPullRequest.number} has been opened with the changes from this schema upgrade.`);

  await tools.github.graphql(`
    mutation LabelPullRequest($id: ID!, $labelIDs: [ID!]!) {
      addLabelsToLabelable(input: {
        labelableId: $id,
        labelIds: []
      }) {
        labelable {
          id
        }
      }
    }
  `, {id: createdPullRequest.id, labelIDs: ['MDU6TGFiZWwxMzQyMzM1MjQ2']});
}, {
  secrets: ['GITHUB_TOKEN'],
});
