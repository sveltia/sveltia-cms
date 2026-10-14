import { expect, test } from '../../fixtures/test.js';
import { getEntryGroups, getEntryList, openCollection } from '../../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * The current time the clock is pinned to, in the time zone of the browser: mid-morning on the day
 * of two of the events, one of which has started and one of which hasn’t yet.
 */
const NOW = '2026-06-15T10:00:00-04:00';

/**
 * Fields of an event: a date-only DateTime field, a DateTime field with a time, a number, a Select
 * field, a List field of tags and an optional venue.
 */
const FIELDS = [
  { name: 'title', label: 'Title' },
  { name: 'date', label: 'Date', widget: 'datetime', time_format: false, format: 'YYYY-MM-DD' },
  { name: 'starts', label: 'Starts', widget: 'datetime' },
  { name: 'price', label: 'Price', widget: 'number', value_type: 'int' },
  {
    name: 'status',
    label: 'Status',
    widget: 'select',
    options: ['draft', 'published', 'archived'],
  },
  { name: 'tags', label: 'Tags', widget: 'list', required: false },
  { name: 'venue', label: 'Venue', required: false },
];

/**
 * A garden club’s events, listed twice: with the view filters and groups for every comparison
 * option, and with the Static CMS-style object forms of `view_filters`, `view_groups` and
 * `sortable_fields`, whose `default` applies when the list is first shown.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  collections: [
    {
      name: 'events',
      label: 'Events',
      label_singular: 'Event',
      folder: 'content/events',
      create: true,
      sortable_fields: ['title', 'date', 'price'],
      view_filters: [
        { label: 'Upcoming', field: 'date', gte: '{{today}}' },
        { label: 'Until Today', field: 'date', lte: '{{today}}' },
        { label: 'Started', field: 'starts', lt: '{{now}}' },
        { label: 'Not Started', field: 'starts', gt: '{{now}}' },
        { label: 'Before July', field: 'date', lt: '2026-07-01' },
        { label: 'Free', field: 'price', eq: 0 },
        { label: 'Up to 30', field: 'price', gt: 0, lte: 30 },
        { label: 'From 25', field: 'price', gte: 25 },
        { label: 'Under 10', field: 'price', lt: 10 },
        { label: 'Drafts', field: 'status', eq: 'draft' },
        { label: 'Not Drafts', field: 'status', ne: 'draft' },
        { label: 'Drafts or Archived', field: 'status', in: ['draft', 'archived'] },
        { label: 'Free or Formal', field: 'tags', in: ['free', 'formal'] },
        { label: 'Not Outdoor', field: 'tags', not_in: ['outdoor'] },
        { label: 'No Venue', field: 'venue', empty: true },
        { label: 'With Venue', field: 'venue', empty: false },
      ],
      view_groups: [
        { label: 'Status', field: 'status' },
        { label: 'Coming Up', field: 'date', gte: '{{today}}' },
        { label: 'No Charge', field: 'price', in: [0] },
      ],
      fields: FIELDS,
    },
    {
      name: 'agenda',
      label: 'Agenda',
      label_singular: 'Event',
      folder: 'content/events',
      create: true,
      sortable_fields: {
        fields: ['title', 'price'],
        // Title case, as Static CMS writes it
        default: { field: 'price', direction: 'Descending' },
      },
      view_filters: {
        filters: [
          { name: 'upcoming', label: 'Upcoming', field: 'date', gte: '{{today}}' },
          { name: 'free', label: 'Free', field: 'price', eq: 0 },
        ],
        default: 'upcoming',
      },
      view_groups: {
        groups: [
          { name: 'status', label: 'Status', field: 'status' },
          { name: 'venue', label: 'Venue', field: 'venue' },
        ],
        default: 'status',
      },
      fields: FIELDS,
    },
  ],
};

/**
 * Four events around the pinned date: one in the spring, two on the day itself, one before and one
 * after the current time, and one in the summer. The second has an empty venue and the third none
 * at all, along with no tags.
 */
const FILES = {
  'content/events/spring-gala.md':
    '---\ntitle: Spring Gala\ndate: 2026-04-10\nstarts: 2026-04-10T19:00\nprice: 50\n' +
    'status: published\ntags:\n  - formal\nvenue: Hall\n---\n',
  'content/events/garden-tour.md':
    '---\ntitle: Garden Tour\ndate: 2026-06-15\nstarts: 2026-06-15T09:00\nprice: 0\n' +
    "status: published\ntags:\n  - outdoor\n  - free\nvenue: ''\n---\n",
  'content/events/evening-talk.md':
    '---\ntitle: Evening Talk\ndate: 2026-06-15\nstarts: 2026-06-15T18:00\nprice: 10\n' +
    'status: draft\ntags: []\n---\n',
  'content/events/summer-fair.md':
    '---\ntitle: Summer Fair\ndate: 2026-07-01\nstarts: 2026-07-01T11:00\nprice: 25\n' +
    'status: archived\ntags:\n  - outdoor\nvenue: Park\n---\n',
};

test.use({ config: CONFIG, timezoneId: 'America/Toronto' });

test.beforeEach(async ({ cms, page }) => {
  await page.clock.install({ time: new Date(NOW) });
  await cms.open();
  await cms.seed(FILES);
  await cms.signIn();
});

/**
 * Get the entry rows of the entry list or one of its groups, leaving out the group headers.
 * @param {Page} page Page.
 * @param {string} [group] Group label.
 * @returns {Locator} Rows.
 */
const getRows = (page, group) => {
  const grid = getEntryList(page);

  return (group ? grid.getByRole('rowgroup', { name: group, exact: true }) : grid)
    .getByRole('row')
    .filter({ has: page.getByRole('gridcell') });
};

/**
 * Turn a view filter on or off.
 * @param {any} cms `cms` fixture.
 * @param {Page} page Page.
 * @param {string} label Filter label.
 */
const toggleFilter = async (cms, page, label) => {
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Filter', exact: true }),
    page.getByRole('menuitemcheckbox', { name: label, exact: true }),
  );
};

/**
 * Turn each view filter on, check the entries it lists, and turn it off again.
 * @param {any} cms `cms` fixture.
 * @param {Page} page Page.
 * @param {[string, RegExp[]][]} expectations Filter labels and the rows each one lists.
 */
const checkFilters = async (cms, page, expectations) => {
  const rows = getRows(page);

  // One filter after another, as the menu can only be used for one at a time
  await expectations.reduce(async (previous, [label, expected]) => {
    await previous;
    await toggleFilter(cms, page, label);
    await expect(rows, label).toHaveText(expected);
    await toggleFilter(cms, page, label);
    await expect(rows).toHaveCount(4);
  }, Promise.resolve());
};

test.describe('with comparison options', () => {
  test.beforeEach(async ({ page }) => {
    await openCollection(page, 'Events');
    // Sorted by title by default
    await expect(getRows(page)).toHaveText([
      /Evening Talk/,
      /Garden Tour/,
      /Spring Gala/,
      /Summer Fair/,
    ]);
  });

  test('filters by date with the `{{today}}` tag, including the events of the day', async ({
    cms,
    page,
  }) => {
    await checkFilters(cms, page, [
      // Both comparisons include the events of the day, as `{{today}}` has no time
      ['Upcoming', [/Evening Talk/, /Garden Tour/, /Summer Fair/]],
      ['Until Today', [/Evening Talk/, /Garden Tour/, /Spring Gala/]],
    ]);
  });

  test('filters by date and time with the `{{now}}` tag and by a given date', async ({
    cms,
    page,
  }) => {
    await checkFilters(cms, page, [
      // `{{now}}` tells apart the events of the day by their start time
      ['Started', [/Garden Tour/, /Spring Gala/]],
      ['Not Started', [/Evening Talk/, /Summer Fair/]],
      ['Before July', [/Evening Talk/, /Garden Tour/, /Spring Gala/]],
    ]);
  });

  test('filters by number, combining comparisons in a filter', async ({ cms, page }) => {
    await checkFilters(cms, page, [
      ['Free', [/Garden Tour/]],
      ['Up to 30', [/Evening Talk/, /Summer Fair/]],
      ['From 25', [/Spring Gala/, /Summer Fair/]],
      ['Under 10', [/Garden Tour/]],
    ]);
  });

  test('filters by equality and by a list of values', async ({ cms, page }) => {
    await checkFilters(cms, page, [
      ['Drafts', [/Evening Talk/]],
      ['Not Drafts', [/Garden Tour/, /Spring Gala/, /Summer Fair/]],
      ['Drafts or Archived', [/Evening Talk/, /Summer Fair/]],
    ]);
  });

  test('filters a List field by a list of values item by item', async ({ cms, page }) => {
    await checkFilters(cms, page, [
      // An entry matches `in` when one of its tags is listed
      ['Free or Formal', [/Garden Tour/, /Spring Gala/]],
      // and `not_in` when none of them is, which includes an entry without tags
      ['Not Outdoor', [/Evening Talk/, /Spring Gala/]],
    ]);
  });

  test('filters by whether a field is empty, including a missing field', async ({ cms, page }) => {
    await checkFilters(cms, page, [
      // An empty string and a field missing from the file are both empty
      ['No Venue', [/Evening Talk/, /Garden Tour/]],
      ['With Venue', [/Spring Gala/, /Summer Fair/]],
    ]);
  });

  test('lists only the entries matching every filter turned on', async ({ cms, page }) => {
    const rows = getRows(page);

    await toggleFilter(cms, page, 'Upcoming');
    await expect(rows).toHaveText([/Evening Talk/, /Garden Tour/, /Summer Fair/]);
    await toggleFilter(cms, page, 'With Venue');
    await expect(rows).toHaveText([/Summer Fair/]);
    await toggleFilter(cms, page, 'Free');
    await expect(page.getByText('No entries found.')).toBeVisible();
    await expect(rows).toHaveCount(0);

    await toggleFilter(cms, page, 'Upcoming');
    await toggleFilter(cms, page, 'With Venue');
    await expect(rows).toHaveText([/Garden Tour/]);
  });

  test('groups the entries satisfying a comparison under its label and the rest under “Other”', async ({
    cms,
    page,
  }) => {
    const grid = getEntryList(page);
    const groupButton = page.getByRole('button', { name: 'Group', exact: true });

    await cms.chooseMenuItem(groupButton, page.getByRole('menuitemradio', { name: 'Coming Up' }));
    await expect(getEntryGroups(page)).toHaveCount(2);
    // The matching entries come first
    await expect(getEntryGroups(page).first()).toHaveAccessibleName('Coming Up');
    await expect(getRows(page, 'Coming Up')).toHaveText([
      /Evening Talk/,
      /Garden Tour/,
      /Summer Fair/,
    ]);
    await expect(getRows(page, 'Other')).toHaveText([/Spring Gala/]);

    await cms.chooseMenuItem(groupButton, page.getByRole('menuitemradio', { name: 'No Charge' }));
    await expect(getRows(page, 'No Charge')).toHaveText([/Garden Tour/]);
    await expect(getRows(page, 'Other')).toHaveText([/Evening Talk/, /Spring Gala/, /Summer Fair/]);

    // With no entry left for “Other”, the group isn’t shown
    await cms.chooseMenuItem(groupButton, page.getByRole('menuitemradio', { name: 'Coming Up' }));
    await toggleFilter(cms, page, 'Upcoming');
    await expect(getEntryGroups(page)).toHaveCount(1);
    await expect(getRows(page, 'Coming Up')).toHaveCount(3);
    await expect(grid.getByRole('rowgroup', { name: 'Other' })).toHaveCount(0);
  });
});

test.describe('with the object forms of the view options', () => {
  test('applies the default filter, group and sort order', async ({ cms, page }) => {
    const grid = getEntryList(page);

    await openCollection(page, 'Agenda');

    // Only the upcoming events, grouped by status, the most expensive first
    await expect(getEntryGroups(page)).toHaveCount(3);
    await expect(getRows(page)).toHaveText([/Summer Fair/, /Evening Talk/, /Garden Tour/]);
    await expect(getRows(page, 'published')).toHaveText([/Garden Tour/]);

    // The menus show the defaults as chosen
    await cms.openPopup(
      page.getByRole('button', { name: 'Sort', exact: true }),
      page.getByRole('menuitemradio', { name: /Price.*large to small/ }),
    );
    await expect(page.getByRole('menuitemradio', { name: /Price.*large to small/ })).toBeChecked();
    await page.keyboard.press('Escape');
    await cms.openPopup(
      page.getByRole('button', { name: 'Filter', exact: true }),
      page.getByRole('menuitemcheckbox', { name: 'Upcoming' }),
    );
    await expect(page.getByRole('menuitemcheckbox', { name: 'Upcoming' })).toBeChecked();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Free' })).not.toBeChecked();
    await page.keyboard.press('Escape');
    await cms.openPopup(
      page.getByRole('button', { name: 'Group', exact: true }),
      page.getByRole('menuitemradio', { name: 'Status' }),
    );
    await expect(page.getByRole('menuitemradio', { name: 'Status' })).toBeChecked();
    await page.keyboard.press('Escape');

    // The default filter can be turned off like any other
    await toggleFilter(cms, page, 'Upcoming');
    await expect(getRows(page)).toHaveCount(4);
    await expect(getRows(page, 'published')).toHaveText([/Spring Gala/, /Garden Tour/]);

    // The other collection on the same folder keeps its own defaults
    await openCollection(page, 'Events');
    await expect(grid.getByRole('rowgroup', { name: 'published' })).toHaveCount(0);
    await expect(getRows(page)).toHaveText([
      /Evening Talk/,
      /Garden Tour/,
      /Spring Gala/,
      /Summer Fair/,
    ]);
  });
});
