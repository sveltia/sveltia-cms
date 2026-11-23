// cspell:ignore Montréal

/**
 * Options of a select field, enough of them to be shown as a dropdown rather than radio buttons.
 */
const COUNTRIES = [
  { label: 'Brazil', value: 'br' },
  { label: 'Canada', value: 'ca' },
  { label: 'Egypt', value: 'eg' },
  { label: 'France', value: 'fr' },
  { label: 'India', value: 'in' },
  { label: 'Japan', value: 'jp' },
  { label: 'Kenya', value: 'ke' },
  { label: 'Mexico', value: 'mx' },
  { label: 'Norway', value: 'no' },
  { label: 'Peru', value: 'pe' },
];

/**
 * A single collection of events, with the field types and list and object options that
 * `MONOLINGUAL_CONFIG` doesn’t cover, and a collection of venues for a relation field with many
 * options.
 */
export const FIELD_TYPES_CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  public_folder: '/uploads',
  output: { omit_empty_optional_fields: true },
  collections: [
    {
      name: 'events',
      label: 'Events',
      label_singular: 'Event',
      folder: 'content/events',
      extension: 'yml',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'id', label: 'ID', widget: 'uuid' },
        { name: 'kind', label: 'Kind', widget: 'hidden', default: 'event' },
        {
          name: 'starts_at',
          label: 'Starts At',
          widget: 'datetime',
          required: false,
        },
        {
          name: 'countries',
          label: 'Countries',
          widget: 'select',
          multiple: true,
          options: COUNTRIES,
          required: false,
        },
        {
          name: 'country',
          label: 'Country',
          widget: 'select',
          options: COUNTRIES,
          required: false,
        },
        {
          name: 'venue',
          label: 'Venue',
          widget: 'relation',
          collection: 'venues',
          value_field: '{{slug}}',
          search_fields: ['name', 'city'],
          display_fields: ['{{name}} ({{city}})'],
          required: false,
        },
        {
          name: 'location',
          label: 'Location',
          widget: 'map',
          type: 'Point',
          required: false,
        },
        { name: 'color', label: 'Color', widget: 'color', required: false },
        {
          name: 'snippet',
          label: 'Embed Code',
          widget: 'code',
          default_language: 'html',
          output_code_only: true,
          required: false,
        },
        {
          name: 'metadata',
          label: 'Metadata',
          widget: 'keyvalue',
          required: false,
        },
        { name: 'flyer', label: 'Flyer', widget: 'file', required: false },
        {
          name: 'slug_preview',
          label: 'Slug Preview',
          widget: 'compute',
          value: '{{fields.title}} ({{fields.country}})',
        },
        {
          name: 'speakers',
          label: 'Speakers',
          label_singular: 'Speaker',
          widget: 'list',
          min: 1,
          max: 3,
          summary: '{{name}} ({{role}})',
          fields: [
            { name: 'name', label: 'Name' },
            { name: 'role', label: 'Role', required: false },
          ],
        },
        {
          name: 'sections',
          label: 'Sections',
          label_singular: 'Section',
          widget: 'list',
          required: false,
          types: [
            {
              name: 'text',
              label: 'Text',
              widget: 'object',
              fields: [{ name: 'body', label: 'Body', widget: 'text' }],
            },
            {
              // A type doesn’t need `widget: object`; the other one has it, to cover both
              name: 'quote',
              label: 'Quote',
              summary: '{{author}}',
              fields: [
                { name: 'quote', label: 'Quote', widget: 'text' },
                { name: 'author', label: 'Author' },
              ],
            },
          ],
        },
        {
          name: 'organizer',
          label: 'Organizer',
          widget: 'object',
          collapsed: true,
          summary: '{{name}} <{{email}}>',
          required: false,
          fields: [
            { name: 'name', label: 'Name' },
            { name: 'email', label: 'Email' },
          ],
        },
        { name: 'notes', label: 'Notes', widget: 'richtext', required: false },
      ],
    },
    {
      name: 'venues',
      label: 'Venues',
      label_singular: 'Venue',
      folder: 'content/venues',
      extension: 'yml',
      create: true,
      identifier_field: 'name',
      fields: [
        { name: 'name', label: 'Name' },
        { name: 'city', label: 'City' },
      ],
    },
  ],
};

/**
 * Venues for the relation field, more than the few a relation field shows as radio buttons.
 */
const VENUES = [
  ['blue-hall', 'Blue Hall', 'Toronto'],
  ['city-arena', 'City Arena', 'Montréal'],
  ['dome-theatre', 'Dome Theatre', 'Vancouver'],
  ['east-pavilion', 'East Pavilion', 'Halifax'],
  ['glass-house', 'Glass House', 'Calgary'],
  ['harbour-stage', 'Harbour Stage', 'Victoria'],
  ['old-mill', 'Old Mill', 'Ottawa'],
  ['river-club', 'River Club', 'Winnipeg'],
  ['north-studio', 'North Studio', 'Yellowknife'],
  ['sky-lounge', 'Sky Lounge', 'Edmonton'],
];

/**
 * Repository files matching {@link FIELD_TYPES_CONFIG}, for `cms.seed()`.
 */
export const FIELD_TYPES_FILES = {
  ...Object.fromEntries(
    VENUES.map(([slug, name, city]) => [
      `content/venues/${slug}.yml`,
      `name: ${name}\ncity: ${city}\n`,
    ]),
  ),
  'content/events/star-party.yml': [
    'title: Star Party',
    'id: 0b8b6c2e-5b52-4f4e-9d59-0f7b6a1c2d3e',
    'kind: event',
    'country: ca',
    'speakers:',
    '  - name: Jane Doe',
    '    role: Host',
    '  - name: John Smith',
    '    role: Astronomer',
    '  - name: Ana Lima',
    'sections:',
    '  - type: text',
    '    body: Bring warm clothes.',
    '  - type: quote',
    '    quote: The sky is the limit.',
    '    author: Someone',
    'organizer:',
    '  name: Night Sky Club',
    '  email: club@example.com',
    '',
  ].join('\n'),
};
