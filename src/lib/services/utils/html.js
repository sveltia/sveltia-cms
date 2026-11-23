/**
 * Parse an HTML fragment into the content of a `<template>` element, which is inert: unlike an
 * element in the document, it doesn’t load the media or run the scripts and event handlers found in
 * the HTML, which comes from untrusted field values.
 * @param {string} value HTML.
 * @returns {HTMLTemplateElement} Template holding the parsed nodes.
 */
export const parseHTMLFragment = (value) => {
  const template = document.createElement('template');

  template.innerHTML = value;

  return template;
};

/**
 * Parse the start tag of an element, e.g. `<img src="a.png">`.
 * @param {string} tag Start tag.
 * @returns {Element} Element, without content.
 */
export const parseStartTag = (tag) =>
  /** @type {Element} */ (parseHTMLFragment(tag).content.firstElementChild);

/**
 * Serialize the start tag of an element parsed with {@link parseStartTag}. The serialization
 * escapes the attribute values as needed, but may differ from the original tag in formatting, e.g.
 * the quotes around attribute values.
 * @param {Element} element Element, without content.
 * @returns {string} Start tag.
 */
export const serializeStartTag = (element) => {
  const { outerHTML } = element;
  const endTag = `</${element.localName}>`;

  // A void element like `<img>` has no end tag
  return outerHTML.endsWith(endTag) ? outerHTML.slice(0, -endTag.length) : outerHTML;
};

/**
 * Check if a tag found in a Markdown or HTML text sits inside another tag, e.g. in an attribute
 * value as in `<a title='<img src="a.png">'>`, where it’s text rather than an element. Such a tag
 * isn’t a reference, and must not be serialized again either, as that may change its quotes and
 * break out of the attribute value it’s in.
 * @param {string} value Markdown or HTML.
 * @param {number} index Position of the tag.
 * @returns {boolean} Result.
 */
export const isInsideTag = (value, index) => {
  const start = value.lastIndexOf('<', index - 1);

  // A `<` not followed by a letter, as in `a < b`, doesn’t start a tag
  return (
    index > 0 && start > value.lastIndexOf('>', index - 1) && /[a-z]/i.test(value[start + 1] ?? '')
  );
};
