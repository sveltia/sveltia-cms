import { getRootDir } from '$lib/services/backends/root-dir';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

/**
 * Prefix for Editorial Workflow branch names. Branches are named
 * `cms/[COLLECTION_NAME]/[SLUG]`, which is compatible with Netlify/Decap CMS.
 * @see https://decapcms.org/docs/editorial-workflows/
 */
const WORKFLOW_BRANCH_PREFIX = 'cms';

/**
 * Join the segments of an Editorial Workflow branch name prefix.
 * @param {string} rootDir Root directory, or an empty string to leave it out.
 * @returns {string} Prefix, including the trailing slash.
 */
const joinPrefix = (rootDir) => {
  const fork = forkedRepository.current;

  return [WORKFLOW_BRANCH_PREFIX, fork?.owner, fork?.repo, rootDir]
    .filter(Boolean)
    .map((segment) => `${segment}/`)
    .join('');
};

/**
 * Get the prefix that every Editorial Workflow branch name starts with, including the trailing
 * slash. With Open Authoring the branches live in the contributor’s fork, which can hold the
 * branches of more than one project, so the fork’s path is inserted to keep them apart. That’s the
 * naming Netlify/Decap CMS uses as well, so a contributor who has used another CMS on the same fork
 * keeps their work in progress. Likewise, with the `root_dir` backend option, the directory is
 * inserted, so the sites of a monorepo don’t share a branch for collections of the same name, nor
 * list each other’s unpublished entries.
 * @returns {string} Branch name prefix, e.g. `cms/`, `cms/contributor/repo/` or
 * `cms/apps/blog/`.
 */
const getBranchPrefix = () => joinPrefix(getRootDir());

/**
 * Get the prefix shared by every Editorial Workflow branch the CMS may have to read, which leaves
 * the `root_dir` backend option out. A branch created before the option was set doesn’t have the
 * directory in its name, but it’s still an entry of the site if its files are all in the
 * directory. Used to list the branches of a fork, which are checked one by one afterwards.
 * @returns {string} Branch name prefix, e.g. `cms/` or `cms/contributor/repo/`.
 */
export const getBranchListPrefix = () => joinPrefix('');

/**
 * Encode an entry slug for use in a branch name. A slug in a nested collection is a path, and Git
 * can’t hold a branch `cms/pages/about` alongside `cms/pages/about/us`, because the former would
 * have to be both a ref and a directory. So the slashes are percent-encoded, which keeps each entry
 * to a single path segment. `%` is encoded as well, so the encoding can be reversed exactly.
 * @param {string} slug Entry slug, e.g. `about/us`.
 * @returns {string} Encoded slug, e.g. `about%2Fus`.
 */
const encodeSlug = (slug) => slug.replaceAll('%', '%25').replaceAll('/', '%2F');
/**
 * Reverse {@link encodeSlug}. A slash that wasn’t encoded, as in a branch created by Netlify/Decap
 * CMS or an earlier version of Sveltia CMS, is left as it is, so such a branch still addresses its
 * entry.
 * @param {string} slug Encoded slug, e.g. `about%2Fus`.
 * @returns {string} Entry slug, e.g. `about/us`.
 */
const decodeSlug = (slug) => slug.replaceAll('%2F', '/').replaceAll('%25', '%');

/**
 * Get the Editorial Workflow branch name for the given entry.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} args.slug Entry slug. It can be a path containing slashes, which are encoded.
 * @returns {string} Branch name, e.g. `cms/posts/hello-world` or `cms/pages/about%2Fus`.
 */
export const getBranchName = ({ collectionName, slug }) =>
  `${getBranchPrefix()}${collectionName}/${encodeSlug(slug)}`;

/**
 * Parse an Editorial Workflow branch name to get the collection name and entry slug. The slug part
 * may contain slashes when the branch was created before they were encoded, so everything after the
 * collection name belongs to it. With the `root_dir` backend option, a branch named without the
 * directory, as before the option was set, is parsed as well, but marked as `legacy`: whether it
 * belongs to the site depends on its files, as another site in the monorepo may have created it.
 * @param {string} branch Branch name.
 * @returns {{ collectionName: string, slug: string, legacy?: boolean } | undefined} Parsed result,
 * or `undefined` if the branch name is not managed by the CMS.
 */
export const parseBranchName = (branch) => {
  const prefix = getBranchPrefix();
  const listPrefix = getBranchListPrefix();
  const legacy = !branch.startsWith(prefix);

  if (legacy && (prefix === listPrefix || !branch.startsWith(listPrefix))) {
    return undefined;
  }

  const rest = branch.slice(legacy ? listPrefix.length : prefix.length);
  const index = rest.indexOf('/');

  // Both parts have to be non-empty for the branch to address an entry
  if (index < 1 || index === rest.length - 1) {
    return undefined;
  }

  return {
    collectionName: rest.slice(0, index),
    slug: decodeSlug(rest.slice(index + 1)),
    ...(legacy && { legacy }),
  };
};

/**
 * Check whether the given Editorial Workflow branch addresses the given entry. The branch name is
 * parsed rather than compared with a freshly generated one, so a branch that spells the slug
 * differently, with the slashes left as they are, is matched as well.
 * @param {object} args Arguments.
 * @param {string} args.branch Branch name.
 * @param {string} args.collectionName Collection name.
 * @param {string} args.slug Entry slug.
 * @returns {boolean} `true` if the branch holds the entry.
 */
export const isEntryBranch = ({ branch, collectionName, slug }) => {
  const parsed = parseBranchName(branch);

  return parsed?.collectionName === collectionName && parsed.slug === slug;
};
