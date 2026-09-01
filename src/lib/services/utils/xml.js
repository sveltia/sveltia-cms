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
