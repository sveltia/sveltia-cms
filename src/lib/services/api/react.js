/**
 * @import { ComponentType } from 'react';
 */

/**
 * Types of the objects React’s `forwardRef()` and `memo()` return, which are components but not
 * functions.
 */
const WRAPPED_COMPONENT_TYPES = [Symbol.for('react.forward_ref'), Symbol.for('react.memo')];

/**
 * Check if the given value is a React component the CMS can render: a function or class component,
 * or a component wrapped with `forwardRef()` or `memo()`.
 * @param {any} value Value to check.
 * @returns {value is ComponentType<any>} Result.
 */
export const isReactComponent = (value) =>
  typeof value === 'function' || WRAPPED_COMPONENT_TYPES.includes(value?.$$typeof);
