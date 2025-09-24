/**
 * @import { LanguagePair, TranslationOptions, TranslationService } from '$lib/types/private';
 */

import { createTranslationSystemPrompt, createTranslationUserPrompt } from './shared.js';

const serviceId = 'openai';
const serviceLabel = 'OpenAI GPT';
const apiLabel = 'OpenAI API';
const developerURL = 'https://platform.openai.com/docs/overview';
const apiKeyURL = 'https://platform.openai.com/api-keys';
const apiKeyPattern = /sk-[a-zA-Z0-9-_]{40,}/;

/**
 * Common languages supported by GPT.
 * OpenAI's GPT models support a wide range of languages, but we'll focus on the most common ones.
 * The model can translate between virtually any language pair.
 * @see https://platform.openai.com/docs/guides/text-generation
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
 * Translate the given text with OpenAI GPT.
 * Supports markdown content and preserves formatting.
 * @param {string[]} texts Array of original texts.
 * @param {TranslationOptions} options Options.
 * @returns {Promise<string[]>} Translated strings in the original order.
 * @throws {Error} When the source or target locale is not supported or API call fails.
 * @see https://platform.openai.com/docs/api-reference/chat/create
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

  // OpenAI Chat Completions API endpoint
  const url = 'https://api.openai.com/v1/chat/completions';
  const systemPrompt = createTranslationSystemPrompt(sourceLanguage, targetLanguage);
  const userPrompt = createTranslationUserPrompt(texts);

  const requestBody = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature: 0.3, // Lower temperature for more consistent translations
    max_tokens: 4000,
    response_format: { type: 'json_object' }, // Enable JSON mode
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}` +
          `${errorData.error?.message ? ` - ${errorData.error.message}` : ''}`,
      );
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenAI API.');
    }

    const content = data.choices[0].message.content.trim();
    // Parse the JSON response
    let parsedResponse;

    try {
      parsedResponse = JSON.parse(content);
    } catch {
      throw new Error('Failed to parse JSON response from OpenAI API.');
    }

    // Validate the response structure
    if (!parsedResponse || !Array.isArray(parsedResponse.translations)) {
      throw new Error('Invalid JSON structure in OpenAI API response.');
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

    throw new Error('Failed to translate text with OpenAI API.');
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
