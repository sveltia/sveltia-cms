import { createPNG } from '../files.js';

/**
 * A site with two nested collections: pages that each live in a folder of their own as an
 * `index.md` file, with a summary and a thumbnail in the entry list, and Hugo-style docs whose
 * entries are regular files, with a `_index.md` section page at the top of the collection.
 */
export const NESTED_CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  public_folder: '/uploads',
  collections: [
    {
      name: 'pages',
      label: 'Pages',
      label_singular: 'Page',
      folder: 'content/pages',
      create: true,
      nested: { depth: 4, summary: '{{title}}' },
      meta: { path: { widget: 'string', label: 'Path', index_file: 'index' } },
      summary: '{{title}} – {{description}}',
      thumbnail: 'cover',
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'description', label: 'Description', required: false },
        { name: 'cover', label: 'Cover', widget: 'image', required: false },
        { name: 'body', label: 'Body', widget: 'text', required: false },
      ],
    },
    {
      name: 'docs',
      label: 'Docs',
      label_singular: 'Doc',
      folder: 'content/docs',
      create: true,
      nested: { depth: 2, subfolders: false },
      meta: { path: { index_file: '_index' } },
      index_file: { name: '_index', label: 'Section Page' },
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'body', label: 'Body', widget: 'text', required: false },
      ],
    },
  ],
};

/**
 * Create the Markdown front matter of a page.
 * @param {Record<string, string>} data Fields.
 * @returns {string} File content.
 */
const page = (data) =>
  `---\n${Object.entries(data)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')}\n---\n`;

/**
 * Repository files for {@link NESTED_CONFIG}. The docs have no section page at the top, so one can
 * be created with the New button’s menu.
 */
export const NESTED_FILES = {
  'content/pages/index.md': page({ title: 'Home', description: 'Welcome' }),
  'content/pages/about/index.md': page({
    title: 'About Us',
    description: 'Who we are',
    cover: '/uploads/team.png',
  }),
  'content/pages/about/team/index.md': page({ title: 'Our Team', description: 'The people' }),
  'content/pages/about/team/alumni/index.md': page({ title: 'Alumni', description: 'Past' }),
  // Deeper than the collection’s `depth` of 4, so it isn’t part of the collection
  'content/pages/about/team/alumni/2020/index.md': page({ title: 'Class of 2020' }),
  'content/pages/contact/index.md': page({ title: 'Contact', description: 'Get in touch' }),
  'static/uploads/team.png': createPNG({ color: [0, 128, 255] }),
  'content/docs/guide/_index.md': page({ title: 'Guide' }),
  'content/docs/guide/install.md': page({ title: 'Installation' }),
  'content/docs/guide/usage.md': page({ title: 'Usage' }),
  'content/docs/reference/api.md': page({ title: 'API' }),
  'content/docs/faq.md': page({ title: 'FAQ' }),
};
