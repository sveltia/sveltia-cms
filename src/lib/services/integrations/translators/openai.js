import {
  createTranslationSystemPrompt,
  createTranslationUserPrompt,
  normalizeLanguage,
} from './shared.js';

/**
 * @import { LanguagePair, TranslationOptions, TranslationService } from '$lib/types/private';
 */

const serviceId = 'openai';
const serviceLabel = 'OpenAI GPT';
const apiLabel = 'OpenAI API';
const developerURL = 'https://platform.openai.com/docs/overview';
const apiKeyURL = 'https://platform.openai.com/api-keys';
const apiKeyPattern = /sk-[a-zA-Z0-9-_]{40,}/;
const model = 'gpt-4o-mini';

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
  const sourceLanguageName = normalizeLanguage(sourceLanguage);
  const targetLanguageName = normalizeLanguage(targetLanguage);

  if (!sourceLanguageName) {
    throw new Error('Source locale is not supported.');
  }

  if (!targetLanguageName) {
    throw new Error('Target locale is not supported.');
  }

  // OpenAI Chat Completions API endpoint
  const url = 'https://api.openai.com/v1/chat/completions';
  const systemPrompt = createTranslationSystemPrompt(sourceLanguageName, targetLanguageName);
  const userPrompt = createTranslationUserPrompt(texts);

  const requestBody = {
    model,
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
    let translations;

    try {
      translations = JSON.parse(content);
    } catch {
      throw new Error('Failed to parse JSON response from OpenAI API.');
    }

    // Validate the response structure
    if (!Array.isArray(translations)) {
      throw new Error('Invalid JSON structure in OpenAI API response.');
    }

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
