'use strict';

const core = require('@actions/core'),
    github = require('@actions/github'),
    board = core.getInput('project'),
    ignoredColumns = (core.getInput('ignoredColumns') || '').split(',').map((columnName) => columnName.trim()),
    token = core.getInput('token'),
    octokit = github.getOctokit(token);

if(!github.context.issue) {
    core.info('Not running after an issue was closed.');
    return;
}

async function findBoardId(name) {
    const boards = await octokit.paginate(octokit.projects.listForRepo.endpoint.merge(github.context.repo));
    return boards.find((project) => project.name === name)?.id;
}

async function forEachCard(projectId, callback, ignoredColumns = []) {
    const columns = await octokit.paginate(octokit.projects.listColumns.endpoint.merge({ project_id: projectId })),
        managedColumns = columns.filter((column) => !ignoredColumns.includes(column.name));
    for(const column of managedColumns) {
        const cards = await octokit.paginate(octokit.projects.listCards.endpoint.merge({ column_id: column.id }));
        for(const card of cards) {
            await callback(card);
        }
    }
}

async function doStuff() {
    const boardId = await findBoardId(board);
    if(!boardId) {
        core.info(`No project with name "${board}" found.`);
        return;
    }
    forEachCard(boardId, async (card) => {
        const issueId = /\/(?:issue|pull-request)s\/(\d+)$/.exec(card.content_url);
        if(issueId?.[1] == github.context.issue.number) {
            await octokit.projects.deleteCard({ card_id: card.id });
        }
    }, ignoredColumns);
}

doStuff().catch((error) => core.setFailed(error.message));
