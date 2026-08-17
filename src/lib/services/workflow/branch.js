/**
 * Prefix for Editorial Workflow branch names. Branches are named
 * `cms/[COLLECTION_NAME]/[SLUG]`, which is compatible with Netlify/Decap CMS.
 * @see https://decapcms.org/docs/editorial-workflows/
 */
export const WORKFLOW_BRANCH_PREFIX = 'cms';

/**
 * Regular expression to parse an Editorial Workflow branch name. The slug part may contain slashes
 * when the collection has a `path` configuration, so it’s matched greedily.
 */
const BRANCH_NAME_REGEX = new RegExp(
  `^${WORKFLOW_BRANCH_PREFIX}/(?<collectionName>[^/]+)/(?<slug>.+)$`,
);

/**
 * Get the Editorial Workflow branch name for the given entry.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} args.slug Entry slug. It can be a path containing slashes.
 * @returns {string} Branch name, e.g. `cms/posts/hello-world`.
 */
export const getBranchName = ({ collectionName, slug }) =>
  `${WORKFLOW_BRANCH_PREFIX}/${collectionName}/${slug}`;

/**
 * Parse an Editorial Workflow branch name to get the collection name and entry slug.
 * @param {string} branch Branch name.
 * @returns {{ collectionName: string, slug: string } | undefined} Parsed result, or `undefined` if
 * the branch name is not managed by the CMS.
 */
export const parseBranchName = (branch) => {
  const { collectionName, slug } = branch.match(BRANCH_NAME_REGEX)?.groups ?? {};

  return collectionName && slug ? { collectionName, slug } : undefined;
};
