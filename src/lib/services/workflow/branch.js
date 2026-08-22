import { get } from 'svelte/store';

import { forkedRepository } from '$lib/services/workflow/open-authoring';

/**
 * Prefix for Editorial Workflow branch names. Branches are named
 * `cms/[COLLECTION_NAME]/[SLUG]`, which is compatible with Netlify/Decap CMS.
 * @see https://decapcms.org/docs/editorial-workflows/
 */
export const WORKFLOW_BRANCH_PREFIX = 'cms';

/**
 * Get the prefix that every Editorial Workflow branch name starts with, including the trailing
 * slash. With Open Authoring the branches live in the contributor’s fork, which can hold the
 * branches of more than one project, so the fork’s path is inserted to keep them apart. That’s the
 * naming Netlify/Decap CMS uses as well, so a contributor who has used another CMS on the same fork
 * keeps their work in progress.
 * @returns {string} Branch name prefix, e.g. `cms/` or `cms/contributor/repo/`.
 */
export const getBranchPrefix = () => {
  const fork = get(forkedRepository);

  return fork
    ? `${WORKFLOW_BRANCH_PREFIX}/${fork.owner}/${fork.repo}/`
    : `${WORKFLOW_BRANCH_PREFIX}/`;
};

/**
 * Get the Editorial Workflow branch name for the given entry.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} args.slug Entry slug. It can be a path containing slashes.
 * @returns {string} Branch name, e.g. `cms/posts/hello-world`.
 */
export const getBranchName = ({ collectionName, slug }) =>
  `${getBranchPrefix()}${collectionName}/${slug}`;

/**
 * Parse an Editorial Workflow branch name to get the collection name and entry slug. The slug part
 * may contain slashes when the collection has a `path` configuration, so everything after the
 * collection name belongs to it.
 * @param {string} branch Branch name.
 * @returns {{ collectionName: string, slug: string } | undefined} Parsed result, or `undefined` if
 * the branch name is not managed by the CMS.
 */
export const parseBranchName = (branch) => {
  const prefix = getBranchPrefix();

  if (!branch.startsWith(prefix)) {
    return undefined;
  }

  const rest = branch.slice(prefix.length);
  const index = rest.indexOf('/');

  // Both parts have to be non-empty for the branch to address an entry
  if (index < 1 || index === rest.length - 1) {
    return undefined;
  }

  return { collectionName: rest.slice(0, index), slug: rest.slice(index + 1) };
};
