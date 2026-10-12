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
 * Selector for finding unprocessed media elements in the rendered HTML, used by the
 * `MutationObserver` to identify images, videos and audio that need to be processed (e.g. Converted
 * to `blob` URLs for local previews). The `data-processed` attribute is added to elements that have
 * already been processed to avoid reprocessing on subsequent mutations.
 */
export const MEDIA_QUERY_SELECTOR = `:is(${Object.entries(MEDIA_URL_ATTRIBUTES)
  .flatMap(([tagName, names]) => names.map((name) => `${tagName}[${name}]`))
  .join(', ')}):not([data-processed])`;

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
 * is displayed in the preview. A path that can’t be resolved is left as is. Once a `<source>` of a
 * video or audio element is updated, the media is loaded again, as the element doesn’t pick up the
 * change by itself.
 * @param {Element} element Media element, matching {@link MEDIA_QUERY_SELECTOR}.
 * @param {(value: string) => Promise<string | undefined>} resolve Function resolving a path to a
 * URL, if any.
 * @returns {Promise<void>} Promise resolving once all the attributes have been updated.
 */
export const resolveMediaURLs = async (element, resolve) => {
  const names = MEDIA_URL_ATTRIBUTES[element.localName] ?? [];
  let updated = false;

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

  await Promise.all(
    names.map(async (name) => {
      const value = element.getAttribute(name);

      if (!value) {
        return;
      }

      if (name === 'srcset') {
        const candidates = parseSrcset(value);
        const urls = await Promise.all(candidates.map(({ url }) => resolveURL(url)));

        // Leave the attribute as written unless a URL has been resolved
        if (urls.some((url, index) => url !== candidates[index].url)) {
          element.setAttribute(
            name,
            candidates
              .map(({ descriptor }, index) => [urls[index], descriptor].filter(Boolean).join(' '))
              .join(', '),
          );
          updated = true;
        }

        return;
      }

      const url = await resolveURL(value);

      if (url !== value) {
        element.setAttribute(name, url);
        updated = true;
      }
    }),
  );

  const { localName, parentElement: parent } = element;

  if (updated && localName === 'source' && /^(?:audio|video)$/.test(parent?.localName ?? '')) {
    /** @type {HTMLMediaElement} */ (parent).load();
  }
};
