import { fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { splitIntoChunks } from '$lib/services/utils/array';
import { runConcurrently } from '$lib/services/utils/scheduling';

/**
 * Build a query that asks for one aliased field of the repository per item. GraphQL aliases can’t
 * be variables, so each item gets its own sub-query. The `$branch` variable is only declared when
 * asked for, because the API rejects a query declaring a variable it doesn’t use. It can’t be
 * worked out from the fragments, which embed file paths and branch names that may contain the same
 * text.
 * @param {{ index: number, fragment: string }[]} parts Fragments, along with the index of the
 * item each one belongs to.
 * @param {string} alias Alias prefix. Each fragment is aliased as `${alias}_${index}`.
 * @param {object} [options] Options.
 * @param {boolean} [options.useBranch] Whether the fragments use the `$branch` variable.
 * @returns {string} GraphQL query.
 */
export const buildAliasedQuery = (parts, alias, { useBranch = false } = {}) => {
  const innerQuery = parts
    .map(({ index, fragment }) => `${alias}_${index}: ${fragment}`)
    .join('\n');

  const branchVar = useBranch ? ', $branch: String!' : '';

  return `
    query($owner: String!, $repo: String!${branchVar}) {
      repository(owner: $owner, name: $repo) {
        ${innerQuery}
      }
    }
  `;
};

/**
 * Get the index of the item an alias such as `content_3` stands for.
 * @param {unknown} name Alias, the second segment of a GraphQL error’s `path`.
 * @param {string} alias Alias prefix.
 * @returns {number | undefined} Index, or `undefined` if the name isn’t one of the aliases.
 */
const getAliasIndex = (name, alias) => {
  const prefix = `${alias}_`;

  return typeof name === 'string' &&
    name.startsWith(prefix) &&
    /^\d+$/.test(name.slice(prefix.length))
    ? Number(name.slice(prefix.length))
    : undefined;
};

/**
 * Ask the GraphQL API for one aliased field of the repository per item, a chunk of items per
 * request, with a limited number of requests in flight at once. A big query takes longer to answer
 * and is more likely to time out or to exceed the API’s query cost limits, so a long list is split.
 * Any failed request rejects the whole batch.
 * @template T
 * @param {object} args Arguments.
 * @param {T[]} args.items Items to look up.
 * @param {string} args.alias Alias prefix, such as `content`. The result for each item is read from
 * `${alias}_${index}`, where `index` is the item’s position in `items`.
 * @param {(item: T) => string | undefined} args.getFragment Function to build the field selection
 * for an item, without the alias, e.g. `object(oid: "…") { … }`. It can return an empty string or
 * `undefined` to leave the item out of the query; its result is then `undefined`.
 * @param {number} args.chunkSize Maximum number of items per request.
 * @param {boolean} [args.useBranch] Whether the fragments use the `$branch` variable.
 * @param {Record<string, any>} [args.variables] Query variables. `owner`, `repo` and `branch` are
 * filled in from the configured repository unless given here.
 * @returns {Promise<any[]>} Result for each item, in the same order as `items`.
 */
export const fetchAliasedBatch = async ({
  items,
  alias,
  getFragment,
  chunkSize,
  useBranch = false,
  variables = {},
}) => {
  /** @type {any[]} */
  const results = Array(items.length).fill(undefined);

  const parts = items
    .map((item, index) => ({ index, fragment: getFragment(item) }))
    .filter(({ fragment }) => !!fragment);

  /**
   * Store the answer for each item of a chunk.
   * @param {{ index: number }[]} chunk Items in the chunk.
   * @param {{ repository?: Record<string, any> | null } | undefined} data Response data.
   */
  const storeResults = (chunk, data) => {
    chunk.forEach(({ index }) => {
      results[index] = data?.repository?.[`${alias}_${index}`];
    });
  };

  await runConcurrently(splitIntoChunks(parts, chunkSize), async (chunk) => {
    /** @type {{ repository?: Record<string, any> | null }} */
    let data;

    try {
      // Copy the variables, as `fetchGraphQL` adds the common ones to the given object
      data = await fetchGraphQL(
        buildAliasedQuery(/** @type {{ index: number, fragment: string }[]} */ (chunk), alias, {
          useBranch,
        }),
        { ...variables },
      );
    } catch (ex) {
      const { cause } = /** @type {{ cause?: any }} */ (ex);

      if (!Array.isArray(cause?.errors) || !cause.data?.repository) {
        throw ex;
      }

      storeResults(chunk, cause.data);

      // Added to the original error, which keeps its stack
      Object.assign(cause, {
        // A copy, as the other chunks still in flight go on filling the list
        results: [...results],
        errors: cause.errors.map((/** @type {any} */ error) => ({
          ...error,
          index: getAliasIndex(error?.path?.[1], alias),
        })),
      });

      throw ex;
    }

    storeResults(chunk, data);
  });

  return results;
};
