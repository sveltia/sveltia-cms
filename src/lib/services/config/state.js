import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { InternalCmsConfig } from '$lib/types/private';
 */

/**
 * Parsed CMS configuration. This lives in its own module, apart from the loader and parser in
 * `$lib/services/config`, so that a service object created at module evaluation time, such as an
 * S3-compatible media library service, can read the configuration without a circular dependency:
 * the config parser imports the list of media library services. Note that a test mocking
 * `$lib/services/config` doesn’t affect the modules that import the state from here; mock this
 * module instead when testing those.
 * @type {{ current: InternalCmsConfig | undefined }}
 */
export const cmsConfig = createRawState();
