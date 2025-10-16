/**
 * @import { LanguagePair, TranslationOptions, TranslationService } from '$lib/types/private';
 */

import {
  createTranslationSystemPrompt,
  createTranslationUserPrompt,
  normalizeLanguage,
} from './shared.js';

const serviceId = 'anthropic';
const serviceLabel = 'Anthropic Claude';
const apiLabel = 'Anthropic API';
const developerURL = 'https://docs.claude.com/en/api/overview';
const apiKeyURL = 'https://platform.claude.com/settings/keys';
const apiKeyPattern = /sk-ant-api03-[a-zA-Z0-9-_]{80,}/;

/**
 * Check if the given source and target languages are supported.
 * @param {LanguagePair} languages Language pair.
 * @returns {Promise<boolean>} True if both source and target languages are supported.
 */
export const availability = async ({ sourceLanguage, targetLanguage }) =>
  !!normalizeLanguage(sourceLanguage) && !!normalizeLanguage(targetLanguage);

/**
 * Translate the given text with Anthropic Claude Haiku 4.5.
 * Supports markdown content and preserves formatting.
 * @param {string[]} texts Array of original texts.
 * @param {TranslationOptions} options Options.
 * @returns {Promise<string[]>} Translated strings in the original order.
 * @throws {Error} When the source or target locale is not supported or API call fails.
 * @see https://docs.claude.com/en/docs/about-claude/models/overview
 * @see https://docs.claude.com/en/api/messages
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

  // Anthropic Messages API endpoint
  const url = 'https://api.anthropic.com/v1/messages';
  const systemPrompt = createTranslationSystemPrompt(sourceLanguageName, targetLanguageName);
  const userPrompt = createTranslationUserPrompt(texts);

  const requestBody = {
    model: 'claude-haiku-4-5',
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
    let translations;

    try {
      translations = JSON.parse(content);
    } catch {
      throw new Error('Failed to parse JSON response from Anthropic API.');
    }

    // Validate the response structure
    if (!Array.isArray(translations)) {
      throw new Error('Invalid JSON structure in Anthropic API response.');
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
