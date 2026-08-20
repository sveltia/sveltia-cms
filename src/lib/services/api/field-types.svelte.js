import equal from 'fast-deep-equal';

/**
 * @typedef {object} SvelteProps
 * @property {Record<string, any>} values Reactive state holding the current prop values.
 * @property {Record<string, any>} props Object to be passed to Svelte’s `mount()` function, where
 * each property is backed by {@link SvelteProps.values}.
 */

/**
 * Create a props object for a Svelte component to be mounted. Each property is defined with a
 * getter reading reactive state, so that the component is updated whenever the state is updated,
 * just like a prop passed from a Svelte parent. The `currentValue` property also gets a setter,
 * because editor components write back to that prop, which is bindable.
 * @param {object} args Arguments.
 * @param {Record<string, any>} args.initialProps Initial prop values.
 * @param {Record<string, (value: any) => any>} [args.transforms] Functions to convert stored values
 * when they are read, keyed by prop name. The conversion is done on read rather than on write, so
 * that the state holds the original value, which can be compared with a new one to detect a change.
 * @param {(value: any) => void} args.onValueChange Function to be called when the component writes
 * to the `currentValue` prop.
 * @returns {SvelteProps} Reactive state and props object.
 */
export const createSvelteProps = ({ initialProps, transforms = {}, onValueChange }) => {
  const values = $state({ ...initialProps });
  /** @type {Record<string, any>} */
  const props = {};

  Object.keys(initialProps).forEach((key) => {
    const transform = transforms[key];

    Object.defineProperty(props, key, {
      enumerable: true,
      get: transform ? () => transform(values[key]) : () => values[key],
      set: key === 'currentValue' ? onValueChange : undefined,
    });
  });

  return { values, props };
};

/**
 * Update the reactive state of a mounted Svelte component with new prop values. Only the changed
 * properties are written, so that the component is not invalidated unnecessarily.
 * @param {Record<string, any>} values Reactive state to be updated.
 * @param {Record<string, any>} newValues New prop values.
 */
export const updateSvelteProps = (values, newValues) => {
  Object.entries(newValues).forEach(([key, value]) => {
    if (!equal(values[key], value)) {
      values[key] = value;
    }
  });
};
