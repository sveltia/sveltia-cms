/**
 * A community garden site, with a collection for each of the collection- and field-level options
 * that restrict or shape what an editor can do: announcements that can be neither created nor
 * deleted, FAQs limited in number and ordered by hand, events and workshops sharing one folder told
 * apart by a `filter`, a hidden collection of plots that a relation field still refers to, and
 * journal posts with a custom slug and path, a read-only field and no preview pane. A divider
 * separates the collections an editor works with day to day from the others.
 */
export const COLLECTION_OPTIONS_CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  public_folder: '/uploads',
  collections: [
    {
      name: 'announcements',
      label: 'Announcements',
      label_singular: 'Announcement',
      folder: 'content/announcements',
      create: false,
      delete: false,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'body', label: 'Body', widget: 'text' },
      ],
    },
    {
      name: 'faqs',
      label: 'FAQs',
      label_singular: 'FAQ',
      folder: 'content/faqs',
      identifier_field: 'question',
      limit: 4,
      reorder: true,
      fields: [
        { name: 'question', label: 'Question' },
        { name: 'answer', label: 'Answer', widget: 'text' },
      ],
    },
    { divider: true },
    {
      name: 'events',
      label: 'Events',
      label_singular: 'Event',
      folder: 'content/activities',
      filter: { field: 'type', value: 'event' },
      fields: [
        { name: 'type', widget: 'hidden', default: 'event' },
        { name: 'title', label: 'Title' },
        {
          name: 'notes',
          label: 'Organizer Notes',
          widget: 'text',
          required: false,
          preview: false,
        },
        { name: 'place', label: 'Place', required: false },
      ],
    },
    {
      name: 'workshops',
      label: 'Workshops',
      label_singular: 'Workshop',
      folder: 'content/activities',
      filter: { field: 'type', value: 'workshop' },
      fields: [
        { name: 'type', widget: 'hidden', default: 'workshop' },
        { name: 'title', label: 'Title' },
      ],
    },
    {
      name: 'journal',
      label: 'Journal',
      label_singular: 'Journal Post',
      folder: 'content/journal',
      slug: '{{month}}{{day}}-{{title}}',
      path: '{{year}}/{{slug}}',
      editor: { preview: false },
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'season', label: 'Season', readonly: true, default: 'spring' },
        {
          name: 'plot',
          label: 'Plot',
          widget: 'relation',
          collection: 'plots',
          value_field: '{{slug}}',
          search_fields: ['name'],
          display_fields: ['name'],
        },
        { name: 'body', label: 'Body', widget: 'text' },
      ],
    },
    {
      name: 'plots',
      label: 'Plots',
      label_singular: 'Plot',
      folder: 'content/plots',
      extension: 'json',
      identifier_field: 'name',
      hide: true,
      fields: [{ name: 'name', label: 'Name' }],
    },
  ],
};

/**
 * Create the Markdown front matter of an entry, with an optional body.
 * @param {Record<string, string | number>} data Fields.
 * @param {string} [body] Body.
 * @returns {string} File content.
 */
const markdown = (data, body) =>
  `---\n${Object.entries(data)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')}\n---\n${body === undefined ? '' : `\n${body}\n`}`;

/**
 * Repository files for {@link COLLECTION_OPTIONS_CONFIG}. The FAQs are one short of their limit
 * and numbered in an order that isn’t alphabetical, so a list sorted by hand can be told from one
 * sorted by title. Their `order` comes first, where the CMS writes it.
 */
export const COLLECTION_OPTIONS_FILES = {
  'content/announcements/opening-day.md': markdown(
    { title: 'Opening Day' },
    'The gates open at nine.',
  ),
  'content/faqs/when-can-i-water.md': markdown({
    order: 1,
    question: 'When can I water?',
    answer: 'Before ten.',
  }),
  'content/faqs/who-can-join.md': markdown({
    order: 2,
    question: 'Who can join?',
    answer: 'Anyone nearby.',
  }),
  'content/faqs/are-tools-provided.md': markdown({
    order: 3,
    question: 'Are tools provided?',
    answer: 'Yes.',
  }),
  'content/activities/seed-swap.md': markdown({
    type: 'event',
    title: 'Seed Swap',
    notes: 'Bring extra envelopes.',
    place: 'Tool Shed',
  }),
  'content/activities/harvest-fair.md': markdown({ type: 'event', title: 'Harvest Fair' }),
  'content/activities/composting-101.md': markdown({ type: 'workshop', title: 'Composting 101' }),
  'content/journal/2026/0301-first-sowing.md': markdown(
    { title: 'First Sowing', season: 'spring', plot: 'north-bed' },
    'Peas went in today.',
  ),
  'content/plots/north-bed.json': '{\n  "name": "North Bed"\n}\n',
  'content/plots/herb-spiral.json': '{\n  "name": "Herb Spiral"\n}\n',
};
