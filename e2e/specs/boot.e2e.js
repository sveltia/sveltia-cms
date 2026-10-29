import { BASE_CONFIG, expect, test } from '../fixtures/test.js';

test.describe('with a valid config', () => {
  test('shows the sign-in screen, then the collection', async ({ cms, page }) => {
    await cms.open();
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeVisible();
    await cms.signIn();
    await expect(page.getByRole('main', { name: /Posts.*Collection/ })).toBeVisible();
  });
});

test.describe('on a subdomain of localhost', () => {
  test('loads the config over HTTP, as the page is a secure context', async ({
    adminPath,
    baseURL,
    cms,
    page,
  }) => {
    // Chromium resolves any `*.localhost` name to the loopback address. The bundle loads the config
    // from next to the page, on the subdomain too; the dev server always loads it from `127.0.0.1`
    const url = new URL(adminPath, baseURL);

    url.hostname = 'e2e.localhost';
    await page.goto(url.href);
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeVisible();
    await cms.signIn();
    await expect(page.getByRole('main', { name: /Posts.*Collection/ })).toBeVisible();
  });
});

test.describe('in an outdated browser', () => {
  test('asks to update the browser instead of leaving the page blank', async ({ cms, page }) => {
    // Act like Safari 16, which lacks the `v` regular expression flag the bundle uses, along with
    // the Base64 conversion the browser check looks for. The bundle turns a `v`-flag literal into
    // a `RegExp()` call, which throws there, so one created while the bundle loads would stop it
    // before the message is shown
    await page.addInitScript(() => {
      /**
       * Throw like a browser lacking the `v` flag if it’s given.
       * @param {any[]} args `RegExp()` arguments.
       * @throws {SyntaxError} If the flags include `v`.
       */
      const checkFlags = ([, flags]) => {
        if (String(flags ?? '').includes('v')) {
          throw new SyntaxError('Invalid regular expression: invalid flags');
        }
      };

      globalThis.RegExp = new Proxy(RegExp, {
        /**
         * Check the flags of `new RegExp()`.
         * @param {RegExpConstructor} target `RegExp`.
         * @param {any[]} args Arguments.
         * @param {NewableFunction} newTarget Constructor.
         * @returns {RegExp} Regular expression.
         */
        construct: (target, args, newTarget) => {
          checkFlags(args);

          return Reflect.construct(target, args, newTarget);
        },
        /**
         * Check the flags of `RegExp()` called without `new`.
         * @param {RegExpConstructor} target `RegExp`.
         * @param {any} thisArg `this`.
         * @param {any[]} args Arguments.
         * @returns {RegExp} Regular expression.
         */
        apply: (target, thisArg, args) => {
          checkFlags(args);

          return Reflect.apply(target, thisArg, args);
        },
      });

      // @ts-ignore
      delete Uint8Array.fromBase64;
    });

    await cms.open();
    await expect(
      page.getByText(
        'Your browser is not supported. Please update it to the latest version or use another ' +
          'browser.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeHidden();
  });
});

test.describe('in a browser that can’t write to the origin private file system', () => {
  test('explains why the test repository is unavailable', async ({ cms, page }) => {
    // Act like Safari before version 26
    await page.addInitScript(() => {
      // @ts-ignore
      delete FileSystemFileHandle.prototype.createWritable;
    });

    await cms.open();
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeDisabled();
    await expect(
      page.getByText(
        'Your browser can’t save the files of the test repository. Please update it to the ' +
          'latest version or use another browser.',
      ),
    ).toBeVisible();
  });
});

test.describe('with an invalid config', () => {
  test.use({ config: { backend: { name: 'test-repo' }, media_folder: 'static/images' } });

  test('shows the config error', async ({ cms, page }) => {
    await cms.open();
    await expect(page.getByText('Collections are not defined.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeHidden();
  });
});

test.describe('with the legacy `media_library` option', () => {
  /**
   * Legacy Cloudinary options, as written for Netlify/Decap CMS.
   */
  const CLOUDINARY = { name: 'cloudinary', config: { cloud_name: 'acme', api_key: '123' } };

  test.describe('with an option Sveltia CMS doesn’t support', () => {
    test.use({
      config: { ...BASE_CONFIG, media_library: { ...CLOUDINARY, use_secure_url: true } },
    });

    test('only warns about that option', async ({ cms, page }) => {
      /** @type {string[]} */
      const warnings = [];

      page.on('console', (message) => {
        if (message.type() === 'warning') {
          warnings.push(message.text());
        }
      });

      await cms.open();
      await cms.signIn();
      await expect(page.getByRole('main', { name: /Posts.*Collection/ })).toBeVisible();

      // The Cloudinary options are checked against the Cloudinary storage, so the credentials in
      // `config` aren’t taken for unknown options of the default storage
      expect(warnings.filter((warning) => warning.includes('media_library'))).toEqual([
        expect.stringContaining('`\u2068media_library.use_secure_url\u2069` option is not defined'),
      ]);
    });
  });

  test.describe('on a field, overriding some of the global options', () => {
    const [collection] = BASE_CONFIG.collections;

    test.use({
      config: {
        ...BASE_CONFIG,
        media_library: { name: 'aws_s3', bucket: 'acme', region: 'us-east-1' },
        collections: [
          {
            ...collection,
            fields: [
              ...collection.fields,
              // The bucket is left to the global options
              {
                name: 'cover',
                widget: 'image',
                media_library: { name: 'aws_s3', prefix: 'covers/' },
              },
            ],
          },
        ],
      },
    });

    test('accepts the options the storage requires being left out', async ({ cms, page }) => {
      await cms.open();
      await cms.signIn();
      await expect(page.getByRole('main', { name: /Posts.*Collection/ })).toBeVisible();
    });
  });

  test.describe('with an invalid option value', () => {
    test.use({
      config: { ...BASE_CONFIG, media_library: { ...CLOUDINARY, output_filename_only: 'yes' } },
    });

    test('shows the config error', async ({ cms, page }) => {
      await cms.open();
      await expect(page.getByText(/output_filename_only/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeHidden();
    });
  });
});
