/**
 * Local storage key of the signed-in user.
 */
export const USER_STORAGE_KEY = 'sveltia-cms.user';

/**
 * Local storage keys of the signed-in user written by Netlify/Decap CMS. The CMS reads these for
 * backward compatibility, so they have to be removed along with its own key.
 * @type {string[]}
 */
export const LEGACY_USER_STORAGE_KEYS = ['decap-cms-user', 'netlify-cms-user'];
