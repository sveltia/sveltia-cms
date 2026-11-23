import { fetchWithSecret } from '$lib/services/additions/setup.svelte';

/**
 * A site served by the same Sveltia CMS Additions service, which the service calls a tenant. Each
 * has its own users, settings and GitHub App.
 * @typedef {object} Tenant
 * @property {string} id ID, which appears in its URL.
 * @property {string} name Name.
 * @property {string} created_at When it was created, as an ISO 8601 string.
 * @property {string} url URL of the site’s service, which is the `base_url` of its CMS
 * configuration.
 */

/**
 * A valid tenant ID: 1 to 32 lower-case letters, digits and hyphens, starting and ending with a
 * letter or a digit. The service checks it too.
 */
const TENANT_ID_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
/**
 * ID of the site served at the root of the service, which can’t be used for another site.
 */
const DEFAULT_TENANT = 'default';

/**
 * Longest site name the service accepts.
 */
export const MAX_TENANT_NAME_LENGTH = 100;

/**
 * Check whether a site ID can be used for a new site.
 * @param {string} id ID.
 * @returns {boolean} Result.
 */
export const isValidTenantId = (id) => TENANT_ID_REGEX.test(id) && id !== DEFAULT_TENANT;

/**
 * List the other sites the service serves, with the admin secret the setup wizard has been
 * unlocked with. Only the site served at the root of the service can manage them: under another
 * site’s path, the service doesn’t know the request, and the platforms that don’t support several
 * sites don’t either. A version of the service older than this CMS may not let the browser read
 * the response at all, which looks like a network error; the wizard has just reached the service,
 * so that’s taken as not supported either.
 * @returns {Promise<Tenant[] | null>} Sites, or `null` if they can’t be managed from this site.
 * @throws {Error} When the service refuses the request for another reason.
 */
export const listTenants = async () => {
  try {
    return (await fetchWithSecret('/v1/tenants')).tenants;
  } catch (/** @type {any} */ ex) {
    if (ex.cause?.status === 404 || ex.cause?.status === undefined) {
      return null;
    }

    throw ex;
  }
};

/**
 * Add a site.
 * @param {object} args Arguments.
 * @param {string} args.id ID.
 * @param {string} [args.name] Name. The ID is used without one.
 * @returns {Promise<Tenant>} New site.
 * @throws {Error} When the service refuses the request, e.g. the ID is taken.
 */
export const createTenant = async ({ id, name }) =>
  (
    await fetchWithSecret('/v1/tenants', {
      method: 'POST',
      body: { id, ...(name ? { name } : {}) },
    })
  ).tenant;

/**
 * Delete a site with all its data, which can’t be undone. A site that’s already gone, e.g. deleted
 * from the command line meanwhile, counts as deleted.
 * @param {string} id ID.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses the request.
 */
export const deleteTenant = async (id) => {
  try {
    await fetchWithSecret(`/v1/tenants/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (/** @type {any} */ ex) {
    if (ex.cause?.code !== 'tenant_not_found') {
      throw ex;
    }
  }
};
