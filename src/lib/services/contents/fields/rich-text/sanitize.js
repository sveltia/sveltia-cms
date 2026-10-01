import { sanitize } from 'isomorphic-dompurify';

/**
 * Sanitization options for DOMPurify to allow `blob` URLs for images, which are commonly used for
 * local previews of uploaded images. Also allow `iframe` tags with strict sandboxing for embedded
 * media previews.
 *
 * The preview is rendered in the app’s own document, so content written by other users must not be
 * able to restyle or cover the app, e.g. with a fake sign-in form asking for an access token. A
 * `<style>` element would apply to the whole app, and form controls could collect and send data, so
 * they’re removed. Inline styles are kept, because the syntax highlighting relies on them, but
 * filtered by {@link filterInlineStyle}.
 * @see https://github.com/cure53/DOMPurify/issues/549
 * @see https://github.com/cure53/DOMPurify#control-permitted-attribute-values.
 * @see https://github.com/cure53/DOMPurify/wiki/Default-TAGs-ATTRIBUTEs-allow-list-&-blocklist
 */
export const SANITIZE_OPTIONS = {
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['allow', 'allowfullscreen', 'referrerpolicy', 'sandbox'],
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option'],
};

/**
 * CSS properties an element can keep in its inline style in the preview. These cover the output of
 * the Shiki syntax highlighter (colors and font styles) and the sizing and alignment commonly used
 * in content, e.g. `<img style="width: 50%">`. Anything else is dropped, including `position`,
 * `inset`, `transform`, `z-index` and `background-image`, which could move content over the app or
 * load a remote resource. The browser expands a shorthand like `background` into its individual
 * properties when parsing the style, so only the harmless part of a shorthand is kept.
 * `text-decoration` is also listed for a DOM implementation that doesn’t expand it; it can’t load
 * anything either way.
 */
const ALLOWED_STYLE_PROPERTIES = [
  'color',
  'background-color',
  'font-style',
  'font-weight',
  'text-decoration',
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-color',
  'text-decoration-thickness',
  'text-align',
  'width',
  'height',
  'max-width',
  'max-height',
];

/**
 * Remove any CSS property that’s not in {@link ALLOWED_STYLE_PROPERTIES} from the inline style of
 * the given element, and remove the `style` attribute altogether if nothing is left.
 * @param {HTMLElement} element Element with a `style` attribute.
 */
const filterInlineStyle = (element) => {
  const { style } = element;

  Array.from(style)
    .filter((name) => !ALLOWED_STYLE_PROPERTIES.includes(name))
    .forEach((name) => {
      style.removeProperty(name);
    });

  if (!style.length) {
    element.removeAttribute('style');
  }
};

/**
 * Sandbox tokens an embedded iframe can keep in the preview. Any other token supplied in the
 * content is dropped, including `allow-top-navigation`, which would let the embed take over the
 * CMS tab, and `allow-popups-to-escape-sandbox`, `allow-modals` and `allow-downloads`. It’s an
 * allowlist, so a token added to browsers in the future is dropped until it’s been reviewed.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox
 */
const ALLOWED_SANDBOX_TOKENS = [
  'allow-forms',
  'allow-orientation-lock',
  'allow-pointer-lock',
  'allow-popups',
  'allow-presentation',
  'allow-same-origin',
  'allow-scripts',
  'allow-storage-access-by-user-activation',
];

/**
 * Permissions Policy features an embedded iframe can be granted in the preview with the `allow`
 * attribute. These cover the embed codes of common media services such as YouTube and Vimeo. Other
 * features, like `camera`, `microphone` and `geolocation`, are dropped, because the permission
 * prompt would name the CMS origin, and a permission the user has already granted to the CMS would
 * pass to the embed without a prompt.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy
 */
const ALLOWED_PERMISSIONS_POLICY_FEATURES = [
  'accelerometer',
  'autoplay',
  'clipboard-write',
  'encrypted-media',
  'fullscreen',
  'gyroscope',
  'picture-in-picture',
  'web-share',
];

/**
 * Filter the `allow` attribute of an iframe, keeping only the directives for the features in
 * {@link ALLOWED_PERMISSIONS_POLICY_FEATURES}. A directive can have an allowlist of origins after
 * the feature name, e.g. `autoplay 'self' https://example.com`, which is kept as is.
 * @param {HTMLIFrameElement} iframe The iframe element to update.
 */
const filterPermissionsPolicy = (iframe) => {
  const allow = iframe.getAttribute('allow');

  if (allow === null) {
    return;
  }

  const directives = allow
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) =>
      ALLOWED_PERMISSIONS_POLICY_FEATURES.includes(directive.split(/\s+/)[0].toLowerCase()),
    );

  if (directives.length) {
    iframe.setAttribute('allow', directives.join('; '));
  } else {
    iframe.removeAttribute('allow');
  }
};

/**
 * Validate and secure an iframe element.
 * @param {HTMLIFrameElement} iframe The iframe element to validate.
 * @returns {boolean} `true` if the iframe is safe and should be kept, `false` if it should be
 * removed.
 */
const validateIframe = (iframe) => {
  const src = iframe.getAttribute('src')?.trim() || '';

  // Require HTTPS (blocks dangerous schemes, relative paths, and HTTP)
  if (!src.startsWith('https://')) {
    return false;
  }

  try {
    const url = new URL(src);

    // Get current origin (handle cases where window might not be fully initialized)
    const currentOrigin =
      typeof window !== 'undefined' && window.location ? window.location.origin : '';

    // Block same-origin iframes to prevent parent window access
    if (currentOrigin && url.origin === currentOrigin) {
      return false;
    }
  } catch {
    // Invalid URL
    return false;
  }

  // Enforce restrictive sandbox for cross-origin iframes. Since we already block same-origin
  // iframes above, it’s safe to allow both `allow-scripts` and `allow-same-origin` here: the iframe
  // can only access its own origin’s APIs (like Cache Storage for YouTube embeds), not the parent
  // window. Sandbox tokens are ASCII case-insensitive, so they’re compared in lowercase.
  const currentSandbox = iframe.getAttribute('sandbox') || '';

  const sandboxTokens = new Set(
    currentSandbox
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => ALLOWED_SANDBOX_TOKENS.includes(token)),
  );

  // Required for embed functionality
  sandboxTokens.add('allow-scripts');
  sandboxTokens.add('allow-same-origin');

  // Set the enforced sandbox attribute
  iframe.setAttribute('sandbox', Array.from(sandboxTokens).join(' '));
  filterPermissionsPolicy(iframe);

  return true;
};

/**
 * Sanitize HTML with DOMPurify and enforce iframe security policies. This wrapper function handles
 * post-processing of iframes to ensure they are secure.
 * @param {string} html The HTML string to sanitize.
 * @param {object} [options] Additional DOMPurify options.
 * @returns {string} The sanitized HTML string with secure iframes.
 */
export const sanitizeRichTextHTML = (html, options = {}) => {
  // First pass: sanitize with DOMPurify, returning a DOM element
  const body = /** @type {HTMLBodyElement} */ (
    sanitize(html, { ...SANITIZE_OPTIONS, ...options, RETURN_DOM: true })
  );

  // Second pass: validate and secure all iframes
  const iframes = Array.from(body.querySelectorAll('iframe'));

  iframes.forEach((iframe) => {
    if (!validateIframe(iframe)) {
      iframe.remove();
    }
  });

  // Third pass: remove any CSS that could move content outside the preview
  body.querySelectorAll('[style]').forEach((element) => {
    filterInlineStyle(/** @type {HTMLElement} */ (element));
  });

  // Return the body’s HTML
  return body.innerHTML;
};
