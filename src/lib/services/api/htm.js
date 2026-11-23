import htm from 'htm';
import { createElement } from 'react';

/**
 * @import { ReactElement } from 'react';
 */

/**
 * Convert an inline style string, which Preact accepts but React rejects, to a style object. The
 * string is split into declarations rather than parsed by the browser, which would expand a
 * shorthand into its individual properties and lose those of a shorthand referring to a custom
 * property, e.g. `padding: var(--x)`. A semicolon within parentheses or quotes, e.g. in a data URL,
 * doesn’t end a declaration. `!important` is dropped, as React can’t set a priority.
 * @param {string} cssText Inline style string, e.g. `color: red; font-size: 2em`.
 * @returns {Record<string, string>} Style object, e.g. `{ color: 'red', fontSize: '2em' }`.
 */
export const parseStyle = (cssText) => {
  /** @type {Record<string, string>} */
  const style = {};
  let declaration = '';
  let depth = 0;
  let quote = '';

  /**
   * Add the declaration read so far to the style object, unless it’s incomplete.
   */
  const addDeclaration = () => {
    const index = declaration.indexOf(':');
    const name = declaration.slice(0, index).trim();

    // React can’t set a priority, and a value with one would be rejected altogether
    const value = declaration
      .slice(index + 1)
      .replace(/!\s*important\s*$/i, '')
      .trim();

    if (index > 0 && name && value) {
      style[
        name.startsWith('--')
          ? name
          : name.toLowerCase().replace(/-([a-z])/g, (_, char) => char.toUpperCase())
      ] = value;
    }

    declaration = '';
  };

  [...cssText].forEach((char) => {
    if (quote) {
      quote = char === quote ? '' : quote;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (char === ';' && depth <= 0) {
      addDeclaration();

      return;
    }

    declaration += char;
  });

  addDeclaration();

  return style;
};

/**
 * Create a React element from what HTM parsed. Same as `React.createElement()`, except that a
 * string `style` prop is converted to an object, so markup copied from HTML or a Preact example
 * doesn’t crash. Other HTML attribute names like `class` and `for` already work in React 19.
 * @param {any} type Element type.
 * @param {Record<string, any> | null} props Props.
 * @param {any[]} children Children.
 * @returns {ReactElement} React element.
 */
const h = (type, props, ...children) =>
  createElement(
    type,
    typeof props?.style === 'string' ? { ...props, style: parseStyle(props.style) } : props,
    ...children,
  );

/**
 * Tagged template that creates React elements from HTML-like markup, powered by HTM. It lets you
 * write custom preview templates, field types and editor component previews in a JSX-like syntax
 * without a build step. Components are embedded with `<${Component} prop=${value} />`.
 * @type {(strings: TemplateStringsArray, ...values: any[]) => ReactElement | ReactElement[]}
 * @see https://github.com/developit/htm
 */
export const html = htm.bind(h);
