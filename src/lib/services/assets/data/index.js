import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { createDeepState } from '$lib/services/utils/state.svelte';

/**
 * @import { UpdateToastState } from '$lib/types/private';
 */

/**
 * State of the asset updates toast notification.
 * @type {{ current: UpdateToastState }}
 */
export const assetUpdatesToast = createDeepState({ ...UPDATE_TOAST_DEFAULT_STATE });
