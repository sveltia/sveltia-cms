import { createContext } from 'react';

/**
 * @import { Context } from 'react';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * @typedef {object} FieldState
 * @property {string} [locale] Current pane’s locale.
 * @property {FieldKeyPath} [keyPath] Field key path.
 * @property {boolean} [required] Whether the field is required.
 * @property {boolean} [readonly] Whether the field is read-only.
 * @property {boolean} [invalid] Whether the field is invalid.
 */

/**
 * React context that carries the state of the field being edited down to a built-in field component
 * reused within a custom field control. The field configuration passed to such a component is often
 * an ad hoc one that only describes how to render the input, so the state of the actual field has
 * to come from here. Otherwise a built-in editor wouldn’t know, for example, that the field is
 * required, and a Select editor would offer an “unselected” option that the CMS then rejects as
 * invalid.
 * @type {Context<FieldState>}
 */
export const fieldStateContext = createContext(/** @type {FieldState} */ ({}));
