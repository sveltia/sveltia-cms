import { DEV_SITE_URL } from '$lib/services/config/constants';
import { cmsConfig as parsedCmsConfig } from '$lib/services/config/state';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { ConfigParserCollectors, InternalCmsConfig } from '$lib/types/private';
 * @import { CmsConfig } from '$lib/types/public';
 */

export { DEV_SITE_URL };

/**
 * Parsed CMS configuration. The state box is defined in the `state` module so that modules the
 * config parser depends on can read it without a circular import. It’s exported here as a constant
 * rather than a re-export, because tests assign `cmsConfig` through the module namespace, which
 * type-checks differently for an alias.
 * @type {{ current: InternalCmsConfig | undefined }}
 */
export const cmsConfig = parsedCmsConfig;

/**
 * @type {Partial<CmsConfig>}
 */
export const rawCmsConfig = {};

/**
 * @type {{ current: string | undefined }}
 */
export const cmsConfigVersion = createRawState();

/**
 * @type {{ current: string[] }}
 */
export const cmsConfigErrors = createRawState([]);

/**
 * Whether the CMS configuration has been loaded, regardless of whether it contains errors.
 */
export const cmsConfigLoaded = createDerivedState(
  () => !!cmsConfig.current || !!cmsConfigErrors.current.length,
);

/**
 * Collectors used during config parsing.
 * @type {ConfigParserCollectors}
 */
export const collectors = {
  errors: new Set(),
  warnings: new Set(),
  mediaFields: new Set(),
  relationFields: new Set(),
};
