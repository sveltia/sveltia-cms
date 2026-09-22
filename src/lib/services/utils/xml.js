/**
 * Parse XML response to JSON.
 * @param {string} xml XML string.
 * @returns {any} Parsed object.
 */
export const parseXml = (xml) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  /**
   * Convert XML node to object.
   * @param {Element} node XML node.
   * @returns {any} Object.
   */
  const nodeToObject = (node) => {
    if (node.children.length === 0) {
      return node.textContent;
    }

    /** @type {Record<string, any>} */
    const obj = {};

    Array.from(node.children).forEach((child) => {
      const key = child.tagName;
      const value = nodeToObject(child);

      if (obj[key]) {
        if (Array.isArray(obj[key])) {
          obj[key].push(value);
        } else {
          obj[key] = [obj[key], value];
        }
      } else {
        obj[key] = value;
      }
    });

    return obj;
  };

  return nodeToObject(doc.documentElement);
};

/**
 * Normalize a value parsed with {@link parseXml} to an array. An element that appears once is
 * parsed as a single value, and one that is missing or empty as `undefined` or an empty string.
 * @param {any} value Parsed value.
 * @returns {any[]} Array.
 */
export const toArray = (value) => (value ? (Array.isArray(value) ? value : [value]) : []);
