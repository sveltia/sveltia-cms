import {
  markdown,
  MULTILINGUAL_CONFIG,
  MULTILINGUAL_FILES,
} from '../../fixtures/configs/multilingual.js';
import { expect, test } from '../../fixtures/test.js';

import { getEditPane, save, showLocale } from './helpers.js';

/**
 * @import { Page, Request } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 */

/**
 * @typedef {object} Provider
 * @property {string} label Service name in the Settings dialog.
 * @property {string} endpoint URL the CMS sends the request to.
 * @property {string} apiKey A made-up API key, in the format the CMS accepts for the service.
 * @property {(request: Request) => string | undefined} getKey Get the API key a request carries.
 * @property {(body: Record<string, any>) => { system: string, user: string }} getPrompts Get the
 * system prompt and the user message from a request body.
 * @property {(text: string) => Record<string, any>} reply Wrap the reply text the way the service
 * returns it.
 */

/* eslint-disable jsdoc/require-jsdoc -- the functions are documented with the `Provider` type */
/**
 * The AI services the CMS can translate with, each with its own API.
 * @type {Provider[]}
 */
const PROVIDERS = [
  {
    label: 'Anthropic Claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    apiKey: `sk-ant-api03-${'a'.repeat(80)}`,
    getKey: (request) => request.headers()['x-api-key'],
    getPrompts: ({ system, messages }) => ({ system, user: messages[0].content }),
    reply: (text) => ({ content: [{ type: 'text', text }] }),
  },
  {
    label: 'OpenAI GPT',
    endpoint: 'https://api.openai.com/v1/responses',
    apiKey: `sk-${'a'.repeat(48)}`,
    getKey: (request) => request.headers().authorization?.replace('Bearer ', ''),
    getPrompts: ({ instructions, input }) => ({ system: instructions, user: input }),
    reply: (text) => ({
      output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
    }),
  },
  {
    label: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/*:generateContent',
    apiKey: `AIza${'a'.repeat(35)}`,
    getKey: (request) => request.headers()['x-goog-api-key'],
    getPrompts: ({ system_instruction: system, contents }) => ({
      system: system.parts[0].text,
      user: contents[0].parts[0].text,
    }),
    reply: (text) => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  },
  {
    label: 'Mistral',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    apiKey: 'a'.repeat(32),
    getKey: (request) => request.headers().authorization?.replace('Bearer ', ''),
    getPrompts: ({ messages }) => ({ system: messages[0].content, user: messages[1].content }),
    reply: (text) => ({ choices: [{ message: { role: 'assistant', content: text } }] }),
  },
  {
    label: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    apiKey: `sk-${'a'.repeat(32)}`,
    getKey: (request) => request.headers().authorization?.replace('Bearer ', ''),
    getPrompts: ({ messages }) => ({ system: messages[0].content, user: messages[1].content }),
    reply: (text) => ({ choices: [{ message: { role: 'assistant', content: text } }] }),
  },
];
/* eslint-enable jsdoc/require-jsdoc */

/**
 * Pick the default translation service in the Settings dialog.
 * @param {CMS} cms CMS.
 * @param {Page} page Page.
 * @param {string} label Service name.
 */
const selectService = async (cms, page, label) => {
  const dialog = page.getByRole('dialog', { name: 'Settings' });

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Account Menu' }),
    page.getByRole('menuitem', { name: 'Settings' }),
  );
  await dialog.getByRole('tab', { name: 'Internationalization' }).click();
  await cms.chooseMenuItem(
    dialog.getByRole('combobox', { name: 'Select Service' }),
    page.getByRole('option', { name: label }),
  );
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
};

test.use({ config: MULTILINGUAL_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(MULTILINGUAL_FILES);
  await cms.signIn();
});

PROVIDERS.forEach(({ label, endpoint, apiKey, getKey, getPrompts, reply }) => {
  test.describe(label, () => {
    /**
     * Answer the service’s requests: translate each text by tagging it with the target language,
     * as the system prompt names it, and keep the requests to check them.
     * @param {Page} page Page.
     * @param {object} [options] Options.
     * @param {number} [options.status] HTTP status, to make the request fail.
     * @returns {Promise<{ key?: string, system: string, texts: string[] }[]>} Requests received
     * so far.
     */
    const mockService = async (page, { status = 200 } = {}) => {
      /** @type {{ key?: string, system: string, texts: string[] }[]} */
      const requests = [];

      await page.route(endpoint, (route) => {
        const request = route.request();
        const { system, user } = getPrompts(request.postDataJSON());
        // The user message holds the texts as a JSON array, on its second line
        const texts = JSON.parse(user.split('\n')[1]);
        const target = system.match(/ to (\w+)\./)?.[1] ?? '';

        requests.push({ key: getKey(request), system, texts });

        if (status !== 200) {
          return route.fulfill({ status, json: { error: { message: 'Invalid API key' } } });
        }

        return route.fulfill({
          json: reply(
            JSON.stringify(texts.map((/** @type {string} */ text) => `${target}: ${text}`)),
          ),
        });
      });

      return requests;
    };

    test('translates a field with the service picked in the settings', async ({ cms, page }) => {
      const requests = await mockService(page);

      await selectService(cms, page, label);
      await page.getByRole('button', { name: 'Create New Entry' }).first().click();

      const english = getEditPane(page, 'English');

      await english.getByRole('textbox', { name: 'Title' }).fill('Night Markets');
      await english.getByRole('textbox', { name: 'Date' }).fill('2026-05-01');
      await english.getByRole('textbox', { name: 'Author' }).fill('Lina Saleh');
      await english.getByRole('textbox', { name: 'Summary' }).fill('Eat after dark.');
      await english.getByRole('textbox', { name: 'Body' }).click();
      await page.keyboard.type('Follow the lanterns.');

      const french = await showLocale(page, 1, 'French');
      const field = french.getByRole('group', { name: /Summary.*Field/ });

      await cms.chooseMenuItem(
        field.getByRole('button', { name: 'Translate' }),
        page.getByRole('menuitem', { name: /Translate from.*English/ }),
      );
      await page
        .getByRole('alertdialog', { name: 'Translate Field' })
        .getByRole('textbox', { name: 'API Key' })
        .fill(apiKey);
      await expect(
        page.getByRole('status').filter({ hasText: /Field translated from/ }),
      ).toBeVisible();
      await expect(field.getByRole('textbox', { name: 'Summary' })).toHaveValue(
        'French: Eat after dark.',
      );

      // The prompt names the languages, and the key goes with the request
      expect(requests).toEqual([
        {
          key: apiKey,
          system: expect.stringContaining('Translate the given texts from English to French.'),
          texts: ['Eat after dark.'],
        },
      ]);

      await french.getByRole('textbox', { name: 'Title' }).fill('Marchés de nuit');
      await french.getByRole('textbox', { name: 'Body' }).click();
      await page.keyboard.type('Suivez les lanternes.');

      const arabic = await showLocale(page, 1, 'Arabic');

      await arabic.getByRole('textbox', { name: 'Title' }).fill('أسواق الليل');
      await arabic.getByRole('textbox', { name: 'Body' }).click();
      await page.keyboard.type('اتبع الفوانيس.');
      await save(page);

      expect((await cms.readRepo())['content/articles/night-markets.fr.md']).toBe(
        markdown(
          {
            title: 'Marchés de nuit',
            date: '2026-05-01',
            tags: [],
            summary: 'French: Eat after dark.',
          },
          'Suivez les lanternes.',
        ),
      );
    });

    test('says when the service refuses the request', async ({ cms, page }) => {
      const requests = await mockService(page, { status: 401 });

      await selectService(cms, page, label);
      await page.getByRole('button', { name: 'Create New Entry' }).first().click();
      await getEditPane(page, 'English').getByRole('textbox', { name: 'Summary' }).fill('Hi.');

      const french = await showLocale(page, 1, 'French');
      const field = french.getByRole('group', { name: /Summary.*Field/ });

      await cms.chooseMenuItem(
        field.getByRole('button', { name: 'Translate' }),
        page.getByRole('menuitem', { name: /Translate from.*English/ }),
      );
      await page
        .getByRole('alertdialog', { name: 'Translate Field' })
        .getByRole('textbox', { name: 'API Key' })
        .fill(apiKey);

      await expect(
        page.getByRole('alert').filter({ hasText: 'Translation failed.' }),
      ).toBeVisible();
      await expect(field.getByRole('textbox', { name: 'Summary' })).toHaveValue('');
      // The failure is the selected service’s answer
      expect(requests).toHaveLength(1);
    });
  });
});
