import { fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';

/**
 * Split the given list into chunks of the given size.
 * @template T
 * @param {T[]} items Items to split.
 * @param {number} size Maximum number of items per chunk.
 * @returns {T[][]} Chunks, in the original order.
 */
export const splitIntoChunks = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

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

  await runConcurrently(splitIntoChunks(parts, chunkSize), async (chunk) => {
    const data = /** @type {{ repository?: Record<string, any> | null }} */ (
      // Copy the variables, as `fetchGraphQL` adds the common ones to the given object
      await fetchGraphQL(
        buildAliasedQuery(/** @type {{ index: number, fragment: string }[]} */ (chunk), alias, {
          useBranch,
        }),
        { ...variables },
      )
    );

    chunk.forEach(({ index }) => {
      results[index] = data?.repository?.[`${alias}_${index}`];
    });
  });

  return results;
};
