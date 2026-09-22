const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Read the given blob as a `data:` URL.
 * @param {Blob} blob Blob.
 * @returns {Promise<string>} `data:` URL.
 */
const readAsDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      resolve(/** @type {string} */ (reader.result));
    });
    reader.addEventListener('error', () => {
      reject(reader.error);
    });
    reader.readAsDataURL(blob);
  });

/**
 * Check if the given `width` or `height` attribute value is a fixed length, rather than missing or
 * a percentage, which doesn’t give the image an intrinsic size.
 * @param {string | null} value Attribute value.
 * @returns {boolean} Result.
 */
const isFixedLength = (value) => !!value?.trim() && !value.trim().endsWith('%');

/**
 * Parse the given `viewBox` attribute value.
 * @param {string | null} value Attribute value.
 * @returns {{ x: number, y: number, width: number, height: number } | undefined} Rectangle, or
 * `undefined` if the value is missing or invalid.
 */
const parseViewBox = (value) => {
  const numbers = (value ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);

  if (numbers.length !== 4 || numbers.some((number) => !Number.isFinite(number))) {
    return undefined;
  }

  const [x, y, width, height] = numbers;

  return width > 0 && height > 0 ? { x, y, width, height } : undefined;
};

/**
 * Create an SVG image that displays the given one without letting it run any script. An object URL
 * has the CMS origin, so an SVG file from the repository opened in a new tab, e.g. with the
 * browser’s “Open Image in New Tab” menu item on a preview, would otherwise run any script in it
 * with access to the user’s token. The wrapper only embeds the original with an `<image>` element,
 * which always renders it in the secure mode where scripts never run, even when the wrapper itself
 * is opened as a document.
 *
 * The wrapper takes the size of the original, so it looks the same in an `<img>` element. When the
 * original has a fixed width and height, those alone define its intrinsic size and aspect ratio;
 * otherwise its `viewBox` does, and the embedded image fills the same box so it isn’t distorted. A
 * file that isn’t valid SVG is still wrapped, to be shown as an empty image.
 * @param {Blob} blob SVG image.
 * @returns {Promise<Blob>} Wrapper SVG image.
 */
export const createInertSVG = async (blob) => {
  const { documentElement: root } = new DOMParser().parseFromString(
    await blob.text(),
    'image/svg+xml',
  );

  const isSVG = root.namespaceURI === SVG_NS && root.localName === 'svg';
  const svg = document.createElementNS(SVG_NS, 'svg');
  const image = document.createElementNS(SVG_NS, 'image');

  const hasFixedSize =
    isSVG && ['width', 'height'].every((n) => isFixedLength(root.getAttribute(n)));

  const attributeNames = hasFixedSize
    ? ['width', 'height']
    : ['width', 'height', 'viewBox', 'preserveAspectRatio'];

  if (isSVG) {
    attributeNames.forEach((name) => {
      const value = root.getAttribute(name);

      if (value !== null) {
        svg.setAttribute(name, value);
      }
    });
  }

  const viewBox = parseViewBox(svg.getAttribute('viewBox'));

  Object.entries(viewBox ?? { width: '100%', height: '100%' }).forEach(([name, value]) => {
    image.setAttribute(name, String(value));
  });

  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('href', await readAsDataURL(new Blob([blob], { type: 'image/svg+xml' })));
  svg.append(image);

  return new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
};
