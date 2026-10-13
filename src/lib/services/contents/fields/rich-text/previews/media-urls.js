/**
 * Attributes of a media element that can refer to a file, which may have to be resolved to a blob
 * URL in the preview, keyed by the tag name. `srcset` holds a list of URLs with descriptors.
 * @type {Record<string, string[]>}
 */
const MEDIA_URL_ATTRIBUTES = {
  img: ['src', 'srcset'],
  source: ['src', 'srcset'],
  video: ['src', 'poster'],
  audio: ['src'],
};

/**
 * Selector for the media elements, regardless of their attributes.
 */
const MEDIA_TAG_SELECTOR = Object.keys(MEDIA_URL_ATTRIBUTES).join(', ');

/**
 * Regular expression testing if an HTML string may contain a media element.
 */
const MEDIA_TAG_REGEX = new RegExp(
  `<(?:${Object.keys(MEDIA_URL_ATTRIBUTES).join('|')})[\\s/>]`,
  'i',
);

/**
 * Prefix of the inert attribute a media URL attribute is moved to by {@link deferMediaURLs}, e.g.
 * `data-deferred-src` for `src`.
 */
const DEFERRED_ATTRIBUTE_PREFIX = 'data-deferred-';

/**
 * Selector for the media elements that have a URL attribute, as written or deferred.
 */
const MEDIA_ELEMENT_SELECTOR = Object.entries(MEDIA_URL_ATTRIBUTES)
  .flatMap(([tagName, names]) =>
    names.flatMap((name) => [
      `${tagName}[${name}]`,
      `${tagName}[${DEFERRED_ATTRIBUTE_PREFIX}${name}]`,
    ]),
  )
  .join(', ');

/**
 * Selector for finding unprocessed media elements in the rendered HTML, used by the
 * `MutationObserver` to identify images, videos and audio that need to be processed (e.g. Converted
 * to `blob` URLs for local previews). The `data-processed` attribute is added to elements that have
 * already been processed to avoid reprocessing on subsequent mutations. An element can have its
 * URL attributes deferred with {@link deferMediaURLs}, or as written, e.g. in the DOM element
 * preview of a custom editor component.
 */
export const MEDIA_QUERY_SELECTOR = `:is(${MEDIA_ELEMENT_SELECTOR}):not([data-processed])`;

/**
 * Move the URL attributes of the media elements in the given HTML, e.g. an image `src`, to inert
 * attributes like `data-deferred-src`, so the browser doesn’t load a file as soon as the HTML is
 * inserted into the document. A path like `/images/photo.jpg` refers to the file in the repository,
 * which may not have been deployed to the site, or even saved yet, so requesting it from the CMS
 * origin would be a wasted request, often failing with 404. The attributes are set again by
 * {@link resolveMediaURLs} once the paths are resolved, leaving any URL the CMS can’t resolve, like
 * an external one, as is. Any deferred attribute already in the HTML is removed, so the content
 * can’t sneak in a URL that has bypassed sanitization.
 * @param {string} html HTML, which should be sanitized beforehand if needed.
 * @returns {string} HTML with the URL attributes deferred.
 */
export const deferMediaURLs = (html) => {
  // Avoid parsing the HTML again if there’s no media element
  if (!MEDIA_TAG_REGEX.test(html)) {
    return html;
  }

  const template = document.createElement('template');

  // The content of a template is inert, so nothing is loaded here
  template.innerHTML = html;

  template.content.querySelectorAll(MEDIA_TAG_SELECTOR).forEach((element) => {
    MEDIA_URL_ATTRIBUTES[element.localName].forEach((name) => {
      const value = element.getAttribute(name);

      element.removeAttribute(`${DEFERRED_ATTRIBUTE_PREFIX}${name}`);

      if (value !== null) {
        element.setAttribute(`${DEFERRED_ATTRIBUTE_PREFIX}${name}`, value);
        element.removeAttribute(name);
      }
    });
  });

  return template.innerHTML;
};

/**
 * Parse the value of a `srcset` attribute into image candidates. Like browsers, a URL is a run of
 * non-whitespace characters, so it can contain a comma, as in a `data:` URL, unless the comma ends
 * it; the descriptor, e.g. `2x` or `800w`, follows it up to the next comma.
 * @param {string} srcset Attribute value.
 * @returns {{ url: string, descriptor: string }[]} Candidates.
 * @see https://html.spec.whatwg.org/multipage/images.html#parsing-a-srcset-attribute
 */
export const parseSrcset = (srcset) => {
  /** @type {{ url: string, descriptor: string }[]} */
  const candidates = [];
  let position = 0;

  for (;;) {
    // Skip the whitespace and commas between candidates
    const urlStart = srcset.slice(position).search(/[^\s,]/);

    if (urlStart === -1) {
      break;
    }

    position += urlStart;

    const url = /** @type {string} */ (srcset.slice(position).match(/^\S+/)?.[0]);

    position += url.length;

    if (url.endsWith(',')) {
      // A URL ending with a comma has no descriptor
      candidates.push({ url: url.replace(/,+$/, ''), descriptor: '' });
    } else {
      const descriptorEnd = srcset.indexOf(',', position);
      const end = descriptorEnd === -1 ? srcset.length : descriptorEnd;

      candidates.push({ url, descriptor: srcset.slice(position, end).trim() });
      position = end;
    }
  }

  return candidates;
};

/**
 * Resolve the file paths in the URL attributes of the given media element, e.g. an image `src`, a
 * video `poster` or each URL in a `srcset`, so that a file that hasn’t been published or saved yet
 * is displayed in the preview. A path that can’t be resolved is left as is. An attribute deferred
 * with {@link deferMediaURLs} is set again, once all of them have been resolved, so an image with
 * both a `src` and a `srcset` doesn’t start loading the former. Once a `<source>` of a video or
 * audio element is updated, the media is loaded again, as the element doesn’t pick up the change
 * by itself.
 * @param {Element} element Media element, matching {@link MEDIA_QUERY_SELECTOR}.
 * @param {(value: string) => Promise<string | undefined>} resolve Function resolving a path to a
 * URL, if any.
 * @returns {Promise<void>} Promise resolving once all the attributes have been updated.
 */
export const resolveMediaURLs = async (element, resolve) => {
  const names = MEDIA_URL_ATTRIBUTES[element.localName] ?? [];

  /**
   * Resolve a path, leaving it as is if it can’t be resolved, e.g. because the file can’t be
   * retrieved, so the other URLs are still resolved.
   * @param {string} value Path.
   * @returns {Promise<string>} URL.
   */
  const resolveURL = async (value) => {
    try {
      return (await resolve(value)) ?? value;
    } catch {
      return value;
    }
  };

  /**
   * Resolve the URLs in an attribute value.
   * @param {string} name Attribute name.
   * @param {string} value Attribute value.
   * @returns {Promise<string>} Value with the URLs resolved.
   */
  const resolveValue = async (name, value) => {
    if (!value) {
      return value;
    }

    if (name !== 'srcset') {
      return resolveURL(value);
    }

    const candidates = parseSrcset(value);
    const urls = await Promise.all(candidates.map(({ url }) => resolveURL(url)));

    // Leave the attribute as written unless a URL has been resolved
    if (urls.every((url, index) => url === candidates[index].url)) {
      return value;
    }

    return candidates
      .map(({ descriptor }, index) => [urls[index], descriptor].filter(Boolean).join(' '))
      .join(', ');
  };

  const updates = await Promise.all(
    names.map(async (name) => {
      const deferredName = `${DEFERRED_ATTRIBUTE_PREFIX}${name}`;
      const deferred = element.hasAttribute(deferredName);
      const value = element.getAttribute(deferred ? deferredName : name);

      return value === null
        ? undefined
        : { name, deferredName, deferred, value, url: await resolveValue(name, value) };
    }),
  );

  let updated = false;

  updates.forEach((update) => {
    if (!update) {
      return;
    }

    const { name, deferredName, deferred, value, url } = update;

    if (deferred) {
      element.removeAttribute(deferredName);
    }

    if (deferred || url !== value) {
      element.setAttribute(name, url);
      updated = true;
    }
  });

  const { localName, parentElement: parent } = element;

  if (updated && localName === 'source' && /^(?:audio|video)$/.test(parent?.localName ?? '')) {
    /** @type {HTMLMediaElement} */ (parent).load();
  }
};
