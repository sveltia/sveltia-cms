import { isObject } from '@sveltia/utils/object';

import { SUPPORTED_EVENT_TYPES } from '$lib/services/api/events';
import { preloadImmutable } from '$lib/services/api/immutable';
import { eventHookRegistry } from '$lib/services/api/registries';

/**
 * @import { AppEventListener } from '../../../types/public';
 */
// Don’t use `$lib` in `from` above, or type declarations will not be exported

/**
 * Register an event listener. Multiple listeners can be registered for the same event; they are
 * called in the order of registration.
 * @param {AppEventListener} eventListener Event listener.
 * @throws {TypeError} If the event listener is not an object, `name` is not a string, or `handler`
 * is not a function.
 * @throws {RangeError} If the event listener name is not a supported event type.
 * @see https://decapcms.org/docs/registering-events/
 * @see https://sveltiacms.app/en/docs/api/events
 */
const registerEventListener = (eventListener) => {
  if (!isObject(eventListener)) {
    throw new TypeError('The event listener must be an object');
  }

  const { name, handler } = eventListener;

  if (typeof name !== 'string' || typeof handler !== 'function') {
    throw new TypeError(
      'The event listener must have a string `name` property and a function `handler` property',
    );
  }

  if (!SUPPORTED_EVENT_TYPES.includes(name)) {
    throw new RangeError(
      `Unsupported event listener name "${name}". ` +
        `Supported names are: ${SUPPORTED_EVENT_TYPES.join(', ')}`,
    );
  }

  eventHookRegistry.add(eventListener);
  // The handler receives an Immutable Map, so start loading the library now rather than when the
  // event fires
  preloadImmutable();
};

// Export the function this way instead of `export const` to prevent the annotations from being
// stripped in the generated `register-event-listener.d.ts` file
export { registerEventListener };
