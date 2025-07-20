import { sendRequest } from '$lib/services/utils/networking';

/**
 * @import { BackendServiceStatus } from '$lib/types/private';
 */

/**
 * The URL of the GitHub status dashboard.
 */
export const STATUS_DASHBOARD_URL = 'https://www.githubstatus.com/';

/**
 * The URL to check the GitHub service status.
 */
const STATUS_CHECK_URL = 'https://www.githubstatus.com/api/v2/status.json';

/**
 * Check the GitHub service status.
 * @returns {Promise<BackendServiceStatus>} Current status.
 * @see https://www.githubstatus.com/api
 */
export const checkStatus = async () => {
  try {
    const {
      status: { indicator },
    } = /** @type {{ status: { indicator: string }}} */ (await sendRequest(STATUS_CHECK_URL));

    if (indicator === 'none') {
      return 'none';
    }

    if (indicator === 'minor') {
      return 'minor';
    }

    if (indicator === 'major' || indicator === 'critical') {
      return 'major';
    }
  } catch {
    //
  }

  return 'unknown';
};
