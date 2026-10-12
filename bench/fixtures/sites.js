import { stringify } from 'yaml';

import { createPNG } from '../../e2e/fixtures/files.js';

/**
 * Number of entries in the large blog. Set `BENCH_ENTRIES` for a smaller or larger one.
 */
export const ENTRY_COUNT = Number(process.env.BENCH_ENTRIES ?? 5000);

/**
 * Number of images in the media folder. Set `BENCH_ASSETS` for another number.
 */
export const ASSET_COUNT = Number(process.env.BENCH_ASSETS ?? 300);

/**
 * Collection of blog posts with the fields a typical post has.
 */
const POSTS_COLLECTION = {
  name: 'posts',
  label: 'Posts',
  label_singular: 'Post',
  folder: 'content/posts',
  create: true,
  summary: '{{title}}',
  sortable_fields: ['title', 'date'],
  fields: [
    { name: 'title', label: 'Title' },
    { name: 'date', label: 'Date', widget: 'datetime' },
    { name: 'draft', label: 'Draft', widget: 'boolean', required: false },
    { name: 'tags', label: 'Tags', widget: 'list', required: false },
    { name: 'image', label: 'Image', widget: 'image', required: false },
    { name: 'description', label: 'Description', widget: 'text', required: false },
    { name: 'body', label: 'Body', widget: 'markdown' },
  ],
};

/**
 * Collection of pages built from sections, each a variable type with lists and objects nested a
 * few levels deep, which is what makes typing in the editor expensive.
 */
const PAGES_COLLECTION = {
  name: 'pages',
  label: 'Pages',
  label_singular: 'Page',
  folder: 'content/pages',
  create: true,
  fields: [
    { name: 'title', label: 'Title' },
    {
      name: 'slug_preview',
      label: 'Slug Preview',
      widget: 'compute',
      value: '{{fields.title | lower}}',
    },
    {
      name: 'sections',
      label: 'Sections',
      widget: 'list',
      types: [
        {
          name: 'hero',
          label: 'Hero',
          fields: [
            { name: 'heading', label: 'Heading' },
            { name: 'text', label: 'Text', widget: 'text', required: false },
            {
              name: 'buttons',
              label: 'Buttons',
              widget: 'list',
              required: false,
              fields: [
                { name: 'label', label: 'Label' },
                { name: 'url', label: 'URL' },
              ],
            },
          ],
        },
        {
          name: 'features',
          label: 'Features',
          fields: [
            { name: 'heading', label: 'Heading' },
            {
              name: 'items',
              label: 'Items',
              widget: 'list',
              fields: [
                { name: 'title', label: 'Title' },
                { name: 'text', label: 'Text', widget: 'text', required: false },
                {
                  name: 'details',
                  label: 'Details',
                  widget: 'object',
                  required: false,
                  fields: [
                    { name: 'note', label: 'Note', required: false },
                    {
                      name: 'links',
                      label: 'Links',
                      widget: 'list',
                      required: false,
                      fields: [
                        { name: 'label', label: 'Label' },
                        { name: 'url', label: 'URL' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/**
 * CMS config of the benchmark site, for the given backend.
 * @param {object} backend `backend` option.
 * @returns {object} Config.
 */
export const createConfig = (backend) => ({
  backend,
  media_folder: 'static/images',
  public_folder: '/images',
  collections: [POSTS_COLLECTION, PAGES_COLLECTION],
});

/**
 * Paragraph of filler text for the post bodies.
 */
const PARAGRAPH =
  'The quick brown fox jumps over the lazy dog, while the patient editor reviews the draft and ' +
  'checks every link before the article goes live. A typical paragraph runs to a few sentences ' +
  'like these, so each post carries a realistic amount of text to parse.';

/**
 * Create the posts of the large blog, each about 2 KB, like a short article.
 * @param {number} [count] Number of posts.
 * @returns {Record<string, string>} File content keyed by path.
 */
export const createPosts = (count = ENTRY_COUNT) =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => {
      const number = String(index + 1).padStart(5, '0');

      const frontMatter = stringify({
        title: `Post ${number}`,
        date: new Date(Date.UTC(2020, 0, 1) + index * 3_600_000).toISOString(),
        draft: index % 10 === 0,
        tags: ['news', `topic-${index % 25}`],
        image: `/images/photo-${index % 50}.jpg`,
        description: `A short description of post ${number}.`,
      });

      return [
        `content/posts/post-${number}.md`,
        `---\n${frontMatter}---\n\n${Array(5).fill(PARAGRAPH).join('\n\n')}\n`,
      ];
    }),
  );

/**
 * Title of the nested page the editor scenario opens.
 */
export const NESTED_PAGE_TITLE = 'Nested Page';

/**
 * Create a page with many sections, each with nested lists and objects.
 * @param {number} [sectionCount] Number of sections.
 * @returns {Record<string, string>} File content keyed by path.
 */
export const createNestedPage = (sectionCount = 30) => {
  const sections = Array.from({ length: sectionCount }, (_, index) =>
    index % 2
      ? {
          type: 'features',
          heading: `Features ${index}`,
          items: Array.from({ length: 6 }, (__, itemIndex) => ({
            title: `Feature ${index}.${itemIndex}`,
            text: PARAGRAPH,
            details: {
              note: `Note ${itemIndex}`,
              links: [
                { label: 'Docs', url: 'https://example.com/docs' },
                { label: 'Blog', url: 'https://example.com/blog' },
              ],
            },
          })),
        }
      : {
          type: 'hero',
          heading: `Hero ${index}`,
          text: PARAGRAPH,
          buttons: [
            { label: 'Start', url: 'https://example.com/start' },
            { label: 'Learn', url: 'https://example.com/learn' },
          ],
        },
  );

  return {
    'content/pages/nested-page.md': `---\n${stringify({
      title: NESTED_PAGE_TITLE,
      slug_preview: 'nested page',
      sections,
    })}---\n`,
  };
};

/**
 * Create the images of the media folder: photos of 1200 × 800 pixels, each a different color, so
 * every thumbnail is generated from a full-size decode.
 * @param {number} [count] Number of images.
 * @returns {Record<string, Buffer>} File content keyed by path.
 */
export const createImages = (count = ASSET_COUNT) =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `static/images/image-${String(index + 1).padStart(4, '0')}.png`,
      createPNG({
        width: 1200,
        height: 800,
        color: [index % 256, (index * 7) % 256, (index * 13) % 256],
      }),
    ]),
  );
