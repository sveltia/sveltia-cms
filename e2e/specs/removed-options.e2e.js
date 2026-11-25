import { BASE_CONFIG, expect, test } from '../fixtures/test.js';

const MIGRATION_URL = 'https://sveltiacms.app/docs/migration/earlier-versions';

test.describe('with the options removed in Sveltia CMS 5.0', () => {
  test.use({
    config: {
      ...BASE_CONFIG,
      backend: { ...BASE_CONFIG.backend, automatic_deployments: false },
      i18n: {
        structure: 'multiple_folders_i18n_root',
        locales: ['en', 'fr'],
        save_all_locales: false,
        omit_default_locale_from_filename: true,
      },
      collections: [
        {
          ...BASE_CONFIG.collections[0],
          i18n: true,
          slug: '{{fields._slug | localize}}',
          slug_length: 50,
          yaml_quote: true,
          fields: [{ name: 'title', label: 'Title', i18n: true }],
        },
      ],
    },
  });

  test('reports each of them with its replacement', async ({ cms, page }) => {
    /** @type {string[]} */
    const warnings = [];

    page.on('console', (message) => {
      if (message.type() === 'warning') {
        warnings.push(message.text());
      }
    });

    await cms.open();

    const errors = page.getByRole('alert').getByRole('listitem');

    await Promise.all(
      [
        'The automatic_deployments backend option was removed in Sveltia CMS 5.0. Use the ' +
          'skip_ci option instead.',
        'The save_all_locales i18n option was removed in Sveltia CMS 5.0. Use the ' +
          'initial_locales option instead.',
        'The omit_default_locale_from_filename i18n option was removed in Sveltia CMS 5.0. ' +
          'Use the omit_default_locale_from_file_path option instead.',
        'The multiple_folders_i18n_root i18n structure was removed in Sveltia CMS 5.0. Use ' +
          'the multiple_root_folders structure instead',
        'slug template tags were removed in Sveltia CMS 5.0. Use the editable and i18n slug ' +
          'options instead.',
        'The slug_length collection option was removed in Sveltia CMS 5.0. Use the ' +
          'maxlength option in the global slug options instead.',
        'The yaml_quote collection option was removed in Sveltia CMS 5.0. Use the quote ' +
          'option in the global output.yaml options instead.',
      ].map((text) =>
        expect(
          errors.filter({ hasText: text }).getByRole('link', { name: MIGRATION_URL }),
        ).toHaveAttribute('href', MIGRATION_URL),
      ),
    );

    // The schema doesn’t report them on top of that
    await expect(errors.filter({ hasText: 'must be one of these values' })).toHaveCount(0);
    expect(warnings).not.toContainEqual(expect.stringContaining('configuration schema'));
    await expect(page.getByRole('button', { name: /^(Sign In|Work with)/ })).toHaveCount(0);
  });
});
