/**
 * URL for documentation on unsupported features and compatibility between Netlify/Decap CMS and
 * Sveltia CMS. When users call an unsupported API function, they will see a warning in the console
 * with a link to this documentation.
 */
export const COMPATIBILITY_URL =
  'https://sveltiacms.app/en/docs/migration/netlify-decap-cms#features-not-to-be-implemented';

/**
 * List of API functions in Netlify/Decap CMS that we don’t plan to support in Sveltia CMS, either
 * because they are undocumented or because they are incompatible with Sveltia CMS’s architecture
 * and design principles.
 */
export const UNSUPPORTED_FUNC_NAMES = [
  // Undocumented
  'getBackend',
  'getCustomFormats',
  'getCustomFormatsExtensions',
  'getCustomFormatsFormatters',
  'getEditorComponents',
  'getEventListeners',
  'getLocale',
  'getMediaLibrary',
  'getPreviewStyles',
  'getPreviewTemplate',
  'getRemarkPlugins',
  'getWidgetValueSerializer',
  'getWidgets',
  'invokeEvent',
  'moment', // Removed in Decap CMS 3.1.1 as it switched from Moment.js to Day.js
  'registerBackend',
  'registerMediaLibrary',
  'registerWidgetValueSerializer',
  'removeEventListener',
  'resolveWidget',
  // Documented but not planned for implementation
  'registerLocale', // https://decapcms.org/docs/configuration-options/#locale
  'registerRemarkPlugin', // https://decapcms.org/docs/widgets/#Markdown
  // Note: `getWidget` is also undocumented, but we’ve added support for it as requested
  // https://github.com/sveltia/sveltia-cms/issues/915
];
