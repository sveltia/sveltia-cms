import { createStatusChecker } from '$lib/services/backends/git/shared/status';

/**
 * @import { BackendServiceStatus } from '$lib/types/private';
 */

/**
 * The URL of the GitLab status dashboard.
 */
export const STATUS_DASHBOARD_URL = 'https://status.gitlab.com/';

/**
 * Check the GitLab service status.
 * @returns {Promise<BackendServiceStatus>} Current status.
 * @see https://kb.status.io/developers/public-status-api/
 */
export const checkStatus = createStatusChecker(
  'https://status-api.hostedstatus.com/1.0/status/5b36dc6502d06804c08349f7',
  /**
   * Map the status API response to a level.
   * @param {{ result: { status_overall: { status_code: number } } }} response Response.
   * @returns {BackendServiceStatus | undefined} Level.
   */
  ({
    result: {
      status_overall: { status_code: status },
    },
  }) =>
    status === 100
      ? 'none'
      : [200, 300, 400].includes(status)
        ? 'minor'
        : [500, 600].includes(status)
          ? 'major'
          : undefined,
);
