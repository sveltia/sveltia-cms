import { createLazyModule } from '$lib/services/api/lazy-module';
import { loadChunk } from '$lib/services/app/dependencies';
import github from '$lib/services/backends/git/github';
import { scopeBackendService } from '$lib/services/backends/git/shared/scope';

/**
 * @import { BackendService } from '$lib/types/private';
 */

/**
 * List of all the Git backend services, keyed by name. This lives apart from the full list of
 * backend services in the parent module so that the local backend, which wraps one of these, can
 * look its remote up without a circular import. Each service is wrapped so the paths the CMS deals
 * with are relative to the `root_dir` backend option, if configured. GitHub, the most common, is
 * bundled with the app, while the others are kept in chunks of their own, see
 * {@link SERVICE_CHUNK_NAMES}: such a service is `undefined` until it’s loaded with
 * {@link loadGitBackendService}.
 * @type {Record<string, BackendService | undefined>}
 */
export const gitBackendServices = {
  github: scopeBackendService(github),
  gitlab: undefined,
  gitea: undefined,
  forgejo: undefined,
};

/**
 * Chunk holding each Git backend service that isn’t bundled with the app, keyed by service name.
 * @type {Record<string, string>}
 */
const SERVICE_CHUNK_NAMES = {
  gitlab: 'gitlab',
  gitea: 'gitea',
  forgejo: 'gitea',
};

/**
 * Loaders of the chunks holding the Git backend services that aren’t bundled with the app, keyed by
 * chunk name. A chunk exports its services under their names: the `gitea` chunk has both Gitea and
 * Forgejo.
 */
const serviceChunks = Object.fromEntries(
  [...new Set(Object.values(SERVICE_CHUNK_NAMES))].map((chunkName) => [
    chunkName,
    createLazyModule({
      /**
       * Fetch the chunk.
       * @returns {Promise<Record<string, BackendService>>} Services.
       */
      loader: () => loadChunk(chunkName),
      notLoadedMessage: `The ${chunkName} chunk is not loaded yet.`,
    }),
  ]),
);

/**
 * Get a Git backend service, loading its chunk first if it’s not bundled with the app. The services
 * of the chunk are added to {@link gitBackendServices}.
 * @param {string} name Service name, e.g. `gitlab`.
 * @returns {Promise<BackendService | undefined>} Service, or `undefined` if there’s no Git backend
 * with the name.
 * @throws {Error} If the chunk can’t be loaded.
 */
export const loadGitBackendService = async (name) => {
  if (!gitBackendServices[name] && name in SERVICE_CHUNK_NAMES) {
    const services = await serviceChunks[SERVICE_CHUNK_NAMES[name]].load();

    Object.entries(services).forEach(([serviceName, service]) => {
      // Another call may have added them while the chunk was being loaded
      gitBackendServices[serviceName] ??= scopeBackendService(service);
    });
  }

  return gitBackendServices[name];
};
