// DeepL integration is disabled for now due to its CORS policy
// @see https://github.com/sveltia/sveltia-cms/issues/437

/**
 * @import { TranslateOptions, TranslationService } from '$lib/types/private';
 */

const serviceId = 'deepl';
const serviceLabel = 'DeepL';
const apiLabel = 'DeepL API';
const developerURL = 'https://www.deepl.com/pro-api';
const apiKeyURL = 'https://www.deepl.com/account/summary';
const apiKeyPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?::fx)?/;

/**
 * Supported source languages listed in the DeepL API document.
 * @see https://developers.deepl.com/docs/resources/supported-languages
 */
const SOURCE_LANGUAGES = [
  'AR',
  'BG',
  'CS',
  'DA',
  'DE',
  'EL',
  'EN',
  'ES',
  'ET',
  'FI',
  'FR',
  'HU',
  'ID',
  'IT',
  'JA',
  'KO',
  'LT',
  'LV',
  'NB',
  'NL',
  'PL',
  'PT',
  'RO',
  'RU',
  'SK',
  'SL',
  'SV',
  'TR',
  'UK',
  'ZH',
];

/**
 * Supported target languages listed in the DeepL API document.
 * @see https://developers.deepl.com/docs/resources/supported-languages
 */
const TARGET_LANGUAGES = [
  'AR',
  'BG',
  'CS',
  'DA',
  'DE',
  'EL',
  'EN',
  'EN-GB',
  'EN-US',
  'ES',
  'ET',
  'FI',
  'FR',
  'HU',
  'ID',
  'IT',
  'JA',
  'KO',
  'LT',
  'LV',
  'NB',
  'NL',
  'PL',
  'PT',
  'PT-BR',
  'PT-PT',
  'RO',
  'RU',
  'SK',
  'SL',
  'SV',
  'TR',
  'UK',
  'ZH',
  'ZH-HANS',
  'ZH-HANT',
];

/**
 * Get a supported source language that matches the given locale code.
 * @param {string} locale Locale code.
 * @returns {string | undefined} Supported language.
 */
export const getSourceLanguage = (locale) => {
  const [language] = locale.toUpperCase().split('-');

  if (SOURCE_LANGUAGES.includes(language)) {
    return language;
  }

  return undefined;
};

/**
 * Get a supported target language that matches the given locale code.
 * @param {string} locale Locale code.
 * @returns {string | undefined} Supported language.
 */
export const getTargetLanguage = (locale) => {
  let language = locale.toUpperCase();

  if (TARGET_LANGUAGES.includes(language)) {
    return language;
  }

  // Simplified Chinese
  if (['ZH-CN', 'ZH-SG'].includes(language)) {
    return 'ZH-HANS';
  }

  // Traditional Chinese
  if (['ZH-HK', 'ZH-MO', 'ZH-TW'].includes(language)) {
    return 'ZH-HANT';
  }

  [language] = language.split('-');

  if (TARGET_LANGUAGES.includes(language)) {
    return language;
  }

  return undefined;
};

/**
 * Translate the given text with DeepL API. Note that the API request uses the GET method, because
 * POST doesn’t work due to a CORS issue. Too long URL params may lead to an HTTP error.
 * @param {string[]} texts Array of original texts.
 * @param {TranslateOptions} options Options.
 * @returns {Promise<string[]>} Translated strings in the original order.
 * @throws {Error} When the source or target locale is not supported.
 * @see https://developers.deepl.com/docs/api-reference/translate
 * @see https://developers.deepl.com/docs/best-practices/cors-requests
 * @todo Implement an error handling.
 * @todo Send multiple requests if there are too many texts.
 */
const translate = async (texts, { sourceLocale, targetLocale, apiKey }) => {
  const sourceLanguage = getSourceLanguage(sourceLocale);
  const targetLanguage = getTargetLanguage(targetLocale);

  if (!sourceLanguage) {
    throw new Error('Source locale is not supported.');
  }

  if (!targetLanguage) {
    throw new Error('Target locale is not supported.');
  }

  const params = new URLSearchParams([
    ...texts.map((text) => ['text', text]),
    ['source_lang', sourceLanguage],
    ['target_lang', targetLanguage],
    ['tag_handling', 'html'],
    ['split_sentences', '1'],
    ['auth_key', apiKey],
  ]);

  const hostname = apiKey.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
  const url = `https://${hostname}/v2/translate?${params}`;

  const { translations } = /** @type {{ translations: { text: string }[] }} */ (
    await fetch(url).then((r) => r.json())
  );

  return translations.map((t) => t.text);
};

/**
 * @type {TranslationService}
 */
export default {
  serviceId,
  serviceLabel,
  apiLabel,
  developerURL,
  apiKeyURL,
  apiKeyPattern,
  markdownSupported: false,
  getSourceLanguage,
  getTargetLanguage,
  translate,
};
