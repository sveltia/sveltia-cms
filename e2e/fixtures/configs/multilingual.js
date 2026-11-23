import { stringify } from 'yaml';

/**
 * A multilingual travel magazine in French, English and Arabic, the last written right to left.
 * English is the default locale, although it isn’t the first one listed. Each collection uses
 * another i18n structure. The articles use `multiple_files`, e.g. `content/articles/lyon.fr.md`,
 * with fields of every `i18n` option. The guides use `multiple_folders` through the `{{locale}}`
 * placeholder in the folder, e.g. `content/fr/guides/…`, with a slug localized from the title; a
 * new guide starts in English only, and a locale can be enabled or disabled for each guide. The
 * destinations use `single_file`, e.g. `data/destinations/paris.yml`, with a top-level key for each
 * locale. The file collection of pages has a `multiple_files` Markdown page and a `single_file`
 * YAML file, and the site settings singleton is stored as `single_file` JSON.
 */
export const MULTILINGUAL_CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  public_folder: '/uploads',
  i18n: {
    structure: 'multiple_files',
    locales: ['fr', 'en', 'ar'],
    default_locale: 'en',
  },
  collections: [
    {
      name: 'articles',
      label: 'Articles',
      label_singular: 'Article',
      folder: 'content/articles',
      create: true,
      i18n: true,
      summary: '{{title}}',
      fields: [
        { name: 'title', label: 'Title', i18n: true },
        {
          name: 'date',
          label: 'Date',
          widget: 'datetime',
          date_format: 'YYYY-MM-DD',
          time_format: false,
          i18n: 'duplicate',
        },
        { name: 'author', label: 'Author', i18n: false },
        { name: 'tags', label: 'Tags', widget: 'list', required: false, i18n: 'duplicate' },
        { name: 'summary', label: 'Summary', widget: 'text', required: false, i18n: true },
        { name: 'body', label: 'Body', widget: 'markdown', i18n: true },
      ],
    },
    {
      name: 'guides',
      label: 'Guides',
      label_singular: 'Guide',
      folder: 'content/{{locale}}/guides',
      create: true,
      slug: '{{title | localize}}',
      i18n: { initial_locales: 'default' },
      fields: [
        { name: 'title', label: 'Title', i18n: true },
        {
          name: 'region',
          label: 'Region',
          widget: 'select',
          options: ['Europe', 'Africa', 'Asia'],
          i18n: 'duplicate',
        },
        { name: 'body', label: 'Body', widget: 'markdown', i18n: true },
      ],
    },
    {
      name: 'destinations',
      label: 'Destinations',
      label_singular: 'Destination',
      folder: 'data/destinations',
      extension: 'yml',
      create: true,
      identifier_field: 'name',
      i18n: { structure: 'single_file' },
      fields: [
        { name: 'name', label: 'Name', i18n: true },
        { name: 'description', label: 'Description', widget: 'text', i18n: true },
        { name: 'currency', label: 'Currency', i18n: 'duplicate' },
        { name: 'population', label: 'Population', widget: 'number', i18n: false },
      ],
    },
    {
      name: 'pages',
      label: 'Pages',
      i18n: true,
      files: [
        {
          name: 'about',
          label: 'About Page',
          file: 'content/pages/about.{{locale}}.md',
          i18n: true,
          fields: [
            { name: 'title', label: 'Title', i18n: true },
            { name: 'body', label: 'Body', widget: 'markdown', i18n: true },
          ],
        },
        {
          name: 'contact',
          label: 'Contact Page',
          file: 'data/contact.yml',
          i18n: true,
          fields: [
            { name: 'email', label: 'Email', i18n: false },
            { name: 'address', label: 'Address', i18n: true },
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
      i18n: true,
      fields: [
        { name: 'site_name', label: 'Site Name', i18n: true },
        { name: 'tagline', label: 'Tagline', i18n: true },
        { name: 'posts_per_page', label: 'Posts per Page', widget: 'number', i18n: false },
      ],
    },
  ],
};

/**
 * Build a Markdown file with front matter, quoted the way the CMS writes it.
 * @param {Record<string, any>} data Front matter.
 * @param {string} body Body.
 * @returns {string} File content.
 */
export const markdown = (data, body) =>
  `---\n${stringify(data, { singleQuote: true })}---\n\n${body}\n`;

/**
 * Repository files matching {@link MULTILINGUAL_CONFIG}, for `cms.seed()`.
 */
export const MULTILINGUAL_FILES = {
  'content/articles/lyon.en.md': markdown(
    {
      title: 'A Weekend in Lyon',
      date: '2026-03-14',
      author: 'Camille Martin',
      tags: ['food', 'france'],
      summary: 'Markets and bistros.',
    },
    'Start at the covered market.',
  ),
  'content/articles/lyon.fr.md': markdown(
    {
      title: 'Un week-end à Lyon',
      date: '2026-03-14',
      tags: ['food', 'france'],
      summary: 'Marchés et bouchons.',
    },
    'Commencez par les halles.',
  ),
  'content/articles/lyon.ar.md': markdown(
    {
      title: 'عطلة نهاية الأسبوع في ليون',
      date: '2026-03-14',
      tags: ['food', 'france'],
      summary: 'أسواق ومطاعم.',
    },
    'ابدأ بالسوق المغطى.',
  ),
  'content/articles/petra.en.md': markdown(
    {
      title: 'Walking to Petra',
      date: '2026-04-02',
      author: 'Omar Haddad',
      tags: ['hiking'],
      summary: 'The trail through the Siq.',
    },
    'Leave before sunrise.',
  ),
  'content/articles/petra.fr.md': markdown(
    {
      title: 'Marcher jusqu’à Pétra',
      date: '2026-04-02',
      tags: ['hiking'],
      summary: 'Le sentier du Siq.',
    },
    'Partez avant l’aube.',
  ),
  'content/articles/petra.ar.md': markdown(
    {
      title: 'المشي إلى البتراء',
      date: '2026-04-02',
      tags: ['hiking'],
      summary: 'الطريق عبر السيق.',
    },
    'انطلق قبل شروق الشمس.',
  ),
  'content/en/guides/marrakesh-souks.md': markdown(
    { translationKey: 'marrakesh-souks', title: 'Marrakesh Souks', region: 'Africa' },
    'Bargain with a smile.',
  ),
  'content/fr/guides/souks-de-marrakech.md': markdown(
    { translationKey: 'marrakesh-souks', title: 'Souks de Marrakech', region: 'Africa' },
    'Marchandez avec le sourire.',
  ),
  'content/en/guides/kyoto-temples.md': markdown(
    { translationKey: 'kyoto-temples', title: 'Kyoto Temples', region: 'Asia' },
    'Go early to avoid the crowds.',
  ),
  'data/destinations/paris.yml': stringify({
    fr: { name: 'Paris', description: 'La ville lumière.', currency: 'EUR' },
    en: { name: 'Paris', description: 'The city of light.', currency: 'EUR', population: 2100000 },
    ar: { name: 'باريس', description: 'مدينة النور.', currency: 'EUR' },
  }),
  'content/pages/about.en.md': markdown({ title: 'About Us' }, 'We travel slowly.'),
  'content/pages/about.fr.md': markdown({ title: 'À propos' }, 'Nous voyageons lentement.'),
  'content/pages/about.ar.md': markdown({ title: 'من نحن' }, 'نسافر ببطء.'),
  'data/contact.yml': stringify({
    fr: { address: '1 rue de la Paix, Paris' },
    en: { email: 'hello@example.com', address: '1 Peace Street, Paris' },
    ar: { address: '١ شارع السلام، باريس' },
  }),
  'data/settings.json': `${JSON.stringify(
    {
      fr: { site_name: 'Vagabond', tagline: 'Voyager lentement' },
      en: { site_name: 'Wanderer', tagline: 'Travel slowly', posts_per_page: 10 },
      ar: { site_name: 'الرحّالة', tagline: 'سافر ببطء' },
    },
    null,
    2,
  )}\n`,
};
