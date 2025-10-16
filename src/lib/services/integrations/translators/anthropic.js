/**
 * @import { LanguagePair, TranslationOptions, TranslationService } from '$lib/types/private';
 */

import { createTranslationSystemPrompt, createTranslationUserPrompt } from './shared.js';

const serviceId = 'anthropic';
const serviceLabel = 'Anthropic Claude';
const apiLabel = 'Anthropic API';
const developerURL = 'https://docs.claude.com/en/api/overview';
const apiKeyURL = 'https://platform.claude.com/settings/keys';
const apiKeyPattern = /sk-ant-api03-[a-zA-Z0-9-_]{80,}/;

/**
 * Common languages supported by Claude.
 * Claude supports a wide range of languages for translation tasks.
 * @see https://docs.claude.com/en/docs/build-with-claude/multilingual-support
 */
const SUPPORTED_LANGUAGES = [
  'af,ar,be,bg,bn,bs,ca,cs,cy,da,de,el,en,eo,es,et,eu,fa,fi,fr,ga,gl,gu,he,hi,hr,hu,hy,id,is,it,ja',
  'ka,kk,km,kn,ko,ky,la,lt,lv,mk,ml,mn,mr,ms,mt,my,ne,nl,no,pl,pt,ro,ru,si,sk,sl,sq,sr,sv,sw,ta,te',
  'th,tl,tr,uk,ur,uz,vi,zh',
]
  .join(',')
  .split(',');

/**
 * Normalize a locale code to a supported language code.
 * @param {string} locale Locale code, e.g., 'en', 'fr-FR', 'zh-CN'.
 * @returns {string | undefined} Normalized language code, e.g., 'en', 'fr', 'zh'.
 */
export const normalizeLanguage = (locale) => {
  const [lang] = locale.toLowerCase().split(/[-_]/);

  if (SUPPORTED_LANGUAGES.includes(lang)) {
    return lang;
  }

  return undefined;
};

/**
 * Check if the given source and target languages are supported.
 * @param {LanguagePair} languages Language pair.
 * @returns {Promise<boolean>} True if both source and target languages are supported.
 */
export const availability = async ({ sourceLanguage, targetLanguage }) =>
  !!normalizeLanguage(sourceLanguage) && !!normalizeLanguage(targetLanguage);

/**
 * Translate the given text with Anthropic Claude Haiku 3.5.
 * Supports markdown content and preserves formatting.
 * @param {string[]} texts Array of original texts.
 * @param {TranslationOptions} options Options.
 * @returns {Promise<string[]>} Translated strings in the original order.
 * @throws {Error} When the source or target locale is not supported or API call fails.
 * @see https://docs.claude.com/en/docs/about-claude/models/overview
 * @see https://docs.claude.com/en/api/messages
 */
const translate = async (texts, { sourceLanguage, targetLanguage, apiKey }) => {
  sourceLanguage = normalizeLanguage(sourceLanguage) ?? '';
  targetLanguage = normalizeLanguage(targetLanguage) ?? '';

  if (!sourceLanguage) {
    throw new Error('Source locale is not supported.');
  }

  if (!targetLanguage) {
    throw new Error('Target locale is not supported.');
  }

  // Anthropic Messages API endpoint
  const url = 'https://api.anthropic.com/v1/messages';
  const systemPrompt = createTranslationSystemPrompt(sourceLanguage, targetLanguage);
  const userPrompt = createTranslationUserPrompt(texts);

  const requestBody = {
    model: 'claude-3-5-haiku-latest',
    max_tokens: 4000,
    temperature: 0.3, // Lower temperature for more consistent translations
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Work around for CORS issues in browsers
        // @see https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      throw new Error(
        `Anthropic API error: ${response.status} ${response.statusText}` +
          `${errorData.error?.message ? ` - ${errorData.error.message}` : ''}`,
      );
    }

    const data = await response.json();

    if (!data.content || !Array.isArray(data.content) || !data.content[0]) {
      throw new Error('Invalid response format from Anthropic API.');
    }

    const content = data.content[0].text.trim();
    // Parse the JSON response
    let parsedResponse;

    try {
      parsedResponse = JSON.parse(content);
    } catch {
      throw new Error('Failed to parse JSON response from Anthropic API.');
    }

    // Validate the response structure
    if (!parsedResponse || !Array.isArray(parsedResponse.translations)) {
      throw new Error('Invalid JSON structure in Anthropic API response.');
    }

    const { translations } = parsedResponse;

    // Ensure we have the right number of translations
    if (translations.length !== texts.length) {
      const expectedCount = texts.length;
      const actualCount = translations.length;

      throw new Error(`Translation count mismatch: expected ${expectedCount}, got ${actualCount}`);
    }

    return translations;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to translate text with Anthropic API.');
  }
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
  markdownSupported: true,
  availability,
  translate,
};
