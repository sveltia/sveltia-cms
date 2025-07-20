import { sendRequest } from '$lib/services/utils/networking';

/**
 * @import { BackendServiceStatus } from '$lib/types/private';
 */

/**
 * The URL of the GitLab status dashboard.
 */
export const STATUS_DASHBOARD_URL = 'https://status.gitlab.com/';

/**
 * The URL to check the GitLab service status.
 */
const STATUS_CHECK_URL = 'https://status-api.hostedstatus.com/1.0/status/5b36dc6502d06804c08349f7';

/**
 * Check the GitLab service status.
 * @returns {Promise<BackendServiceStatus>} Current status.
 * @see https://kb.status.io/developers/public-status-api/
 */
export const checkStatus = async () => {
  try {
    const {
      result: {
        status_overall: { status_code: status },
      },
    } = /** @type {{ result: { status_overall: { status_code: number } } }} */ (
      await sendRequest(STATUS_CHECK_URL)
    );

    if (status === 100) {
      return 'none';
    }

    if ([200, 300, 400].includes(status)) {
      return 'minor';
    }

    if ([500, 600].includes(status)) {
      return 'major';
    }
  } catch {
    //
  }

  return 'unknown';
};
