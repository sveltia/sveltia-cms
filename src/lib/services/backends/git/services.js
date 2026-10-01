import gitea from '$lib/services/backends/git/gitea';
import github from '$lib/services/backends/git/github';
import gitlab from '$lib/services/backends/git/gitlab';

/**
 * @import { BackendService } from '$lib/types/private';
 */

/**
 * List of all the Git backend services. This lives apart from the full list of backend services in
 * the parent module so that the local backend, which wraps one of these, can look its remote up
 * without a circular import.
 * @type {Record<string, BackendService>}
 */
export const gitBackendServices = { github, gitlab, gitea };
