const serviceId = 'deepl';
const serviceLabel = 'DeepL';
const landingURL = 'https://www.deepl.com/pro-api';
const apiKeyURL = 'https://www.deepl.com/account/summary';
const apiKeyPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?::fx)?/;

/**
 * Supported source languages extracted from the `source_lang` parameter in the DeepL API document.
 */
export const sourceLanguages = [
  'BG,CS,DA,DE,EL,EN,ES,ET,FI,FR,HU,ID,IT,JA,KO,LT,LV,NB,NL,PL,PT,RO,RU,SK,SL,SV,TR,UK,ZH',
]
  .join(',')
  .split(',');

/**
 * Supported target languages extracted from the `target_lang` parameter in the DeepL API document.
 */
export const targetLanguages = [
  'BG,CS,DA,DE,EL,EN,EN-GB,EN-US,ES,ET,FI,FR,HU,ID,IT,JA,KO,LT,LV,NB,NL,PL,PT,PT-BR,PT-PT,RO,RU,SK',
  'SL,SV,TR,UK,ZH',
]
  .join(',')
  .split(',');

/**
 * Translate the given text with DeepL API. Note that the API request uses the GET method, because
 * POST doesn’t work due to a CORS issue. Too long URL params may lead to an HTTP error.
 * @param {string[]} texts Array of original texts.
 * @param {object} options Options.
 * @param {string} [options.sourceLocale] Source language. Detect automatically if omitted.
 * @param {string} options.targetLocale Target language.
 * @param {string} options.apiKey API authentication key.
 * @returns {Promise<string[]>} Translated strings in the original order.
 * @see https://www.deepl.com/docs-api
 */
export const translate = async (texts, { sourceLocale = '', targetLocale, apiKey }) => {
  const params = new URLSearchParams([
    ...texts.map((text) => ['text', text]),
    ['source_lang', sourceLocale.toUpperCase()],
    ['target_lang', targetLocale.toUpperCase()],
    ['tag_handling', 'html'],
    ['split_sentences', '1'],
    ['auth_key', apiKey],
  ]);

  const hostname = apiKey.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
  const url = `https://${hostname}/v2/translate?${params.toString()}`;
  const { translations } = await fetch(url).then((r) => r.json());

  return translations.map((t) => t.text);
};

export default {
  serviceId,
  serviceLabel,
  landingURL,
  apiKeyURL,
  apiKeyPattern,
  sourceLanguages,
  targetLanguages,
  translate,
};
