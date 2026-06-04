/**
 * Markdown file extensions that support front matter formats.
 * @type {string[]}
 */
export const MARKDOWN_EXTENSIONS = [
  'markdown',
  'md',
  'mdown',
  'mdwn',
  'mdx',
  'mkd',
  'mkdn',
  'html.md',
];

/**
 * Template engine extensions that support any front matter format.
 * @type {string[]}
 */
export const TEMPLATE_ENGINE_EXTENSIONS = ['astro', 'njk'];

/**
 * Allowed extensions for the `frontmatter` auto-detect format.
 * @type {string[]}
 */
export const ALLOWED_FRONTMATTER_EXTENSIONS = [
  ...MARKDOWN_EXTENSIONS,
  ...TEMPLATE_ENGINE_EXTENSIONS,
];
