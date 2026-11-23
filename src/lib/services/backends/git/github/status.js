import { createStatusChecker } from '$lib/services/backends/git/shared/status';

/**
 * @import { BackendServiceStatus } from '$lib/types/private';
 */

/**
 * The URL of the GitHub status dashboard.
 */
export const STATUS_DASHBOARD_URL = 'https://www.githubstatus.com/';

/**
 * Check the GitHub service status.
 * @returns {Promise<BackendServiceStatus>} Current status.
 * @see https://www.githubstatus.com/api
 */
export const checkStatus = createStatusChecker(
  'https://www.githubstatus.com/api/v2/status.json',
  /**
   * Map the status API response to a level.
   * @param {{ status: { indicator: string } }} response Response.
   * @returns {BackendServiceStatus | undefined} Level.
   */
  ({ status: { indicator } }) =>
    indicator === 'critical'
      ? 'major'
      : ['none', 'minor', 'major'].includes(indicator)
        ? /** @type {BackendServiceStatus} */ (indicator)
        : undefined,
);
