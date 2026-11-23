/**
 * A monolingual magazine site: a folder collection of posts using most field types, a JSON folder
 * collection of authors the posts refer to, a file collection of pages in different formats, and
 * a singleton for the site settings.
 */
export const MONOLINGUAL_CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  public_folder: '/uploads',
  slug: { encoding: 'ascii', clean_accents: true },
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      create: true,
      slug: '{{year}}-{{month}}-{{slug}}',
      summary: '{{title}} ({{category}})',
      sortable_fields: ['title', 'date'],
      view_filters: [
        { label: 'Drafts', field: 'draft', pattern: true },
        { label: 'Published', field: 'draft', pattern: false },
      ],
      view_groups: [{ label: 'Category', field: 'category' }],
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'date',
          label: 'Date',
          widget: 'datetime',
          date_format: 'YYYY-MM-DD',
          time_format: false,
        },
        { name: 'draft', label: 'Draft', widget: 'boolean', default: false },
        {
          name: 'category',
          label: 'Category',
          widget: 'select',
          options: [
            { label: 'News', value: 'news' },
            { label: 'Review', value: 'review' },
            { label: 'Interview', value: 'interview' },
          ],
        },
        { name: 'tags', label: 'Tags', widget: 'list', required: false },
        {
          name: 'author',
          label: 'Author',
          widget: 'relation',
          collection: 'authors',
          value_field: '{{slug}}',
          search_fields: ['name'],
          display_fields: ['name'],
        },
        {
          name: 'rating',
          label: 'Rating',
          widget: 'number',
          value_type: 'int',
          min: 1,
          max: 5,
          required: false,
        },
        { name: 'cover', label: 'Cover Image', widget: 'image', required: false },
        { name: 'excerpt', label: 'Excerpt', widget: 'text', required: false },
        { name: 'body', label: 'Body', widget: 'markdown' },
      ],
    },
    {
      name: 'authors',
      label: 'Authors',
      label_singular: 'Author',
      folder: 'content/authors',
      extension: 'json',
      create: true,
      identifier_field: 'name',
      fields: [
        { name: 'name', label: 'Name' },
        {
          name: 'email',
          label: 'Email',
          pattern: ['^[^@\\s]+@[^@\\s]+\\.[a-z]+$', 'Enter a valid email address'],
        },
        { name: 'bio', label: 'Bio', widget: 'text', required: false },
        {
          name: 'links',
          label: 'Links',
          widget: 'list',
          required: false,
          summary: '{{label}}',
          fields: [
            { name: 'label', label: 'Label' },
            { name: 'url', label: 'URL' },
          ],
        },
      ],
    },
    {
      name: 'pages',
      label: 'Pages',
      files: [
        {
          name: 'about',
          label: 'About Page',
          file: 'content/pages/about.md',
          fields: [
            { name: 'title', label: 'Title' },
            { name: 'body', label: 'Body', widget: 'markdown' },
          ],
        },
        {
          name: 'contact',
          label: 'Contact Page',
          file: 'content/pages/contact.yml',
          fields: [
            { name: 'email', label: 'Email' },
            {
              name: 'office',
              label: 'Office',
              widget: 'object',
              fields: [
                { name: 'street', label: 'Street' },
                { name: 'city', label: 'City' },
              ],
            },
          ],
        },
      ],
    },
  ],
  singletons: [
    {
      name: 'settings',
      label: 'Site Settings',
      file: 'data/settings.json',
      fields: [
        { name: 'site_name', label: 'Site Name' },
        { name: 'accent_color', label: 'Accent Color', widget: 'color' },
        { name: 'posts_per_page', label: 'Posts per Page', widget: 'number', value_type: 'int' },
        { name: 'show_comments', label: 'Show Comments', widget: 'boolean' },
      ],
    },
  ],
};

/**
 * Repository files matching {@link MONOLINGUAL_CONFIG}, for `cms.seed()`.
 */
export const MONOLINGUAL_FILES = {
  'content/authors/jane-doe.json': `${JSON.stringify(
    {
      name: 'Jane Doe',
      email: 'jane@example.com',
      bio: 'Editor in chief.',
      links: [{ label: 'Website', url: 'https://jane.example.com' }],
    },
    null,
    2,
  )}\n`,
  'content/authors/john-smith.json': `${JSON.stringify(
    { name: 'John Smith', email: 'john@example.com' },
    null,
    2,
  )}\n`,
  'content/posts/2026-01-first-light.md': [
    '---',
    'title: First Light',
    'date: 2026-01-15',
    'draft: false',
    'category: news',
    'tags:',
    '  - astronomy',
    '  - events',
    'author: jane-doe',
    '---',
    '',
    'The observatory opens its doors.',
    '',
  ].join('\n'),
  'content/posts/2026-02-a-quiet-review.md': [
    '---',
    'title: A Quiet Review',
    'date: 2026-02-03',
    'draft: true',
    'category: review',
    'author: john-smith',
    'rating: 4',
    '---',
    '',
    'A calm and careful look.',
    '',
  ].join('\n'),
  'content/posts/2026-03-talking-to-jane.md': [
    '---',
    'title: Talking to Jane',
    'date: 2026-03-20',
    'draft: false',
    'category: interview',
    'author: jane-doe',
    '---',
    '',
    'Questions and answers.',
    '',
  ].join('\n'),
  'content/pages/about.md': '---\ntitle: About Us\n---\n\nWe write about the sky.\n',
  'content/pages/contact.yml': [
    'email: hello@example.com',
    'office:',
    '  street: 1 Main Street',
    '  city: Toronto',
    '',
  ].join('\n'),
  'data/settings.json': `${JSON.stringify(
    { site_name: 'Night Sky', accent_color: '#336699', posts_per_page: 10, show_comments: true },
    null,
    2,
  )}\n`,
};
