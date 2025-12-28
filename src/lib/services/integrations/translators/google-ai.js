import {
  createTranslationSystemPrompt,
  createTranslationUserPrompt,
  normalizeLanguage,
} from './shared.js';

/**
 * @import { LanguagePair, TranslationOptions, TranslationService } from '$lib/types/private';
 */

const serviceId = 'google-ai';
const serviceLabel = 'Google Gemini';
const apiLabel = 'Google AI Studio API';
const developerURL = 'https://ai.google.dev/gemini-api/docs';
const apiKeyURL = 'https://aistudio.google.com/api-keys';
const apiKeyPattern = /AIza[a-zA-Z0-9_-]{35}/;
const model = 'gemini-2.5-flash-lite';

/**
 * Check if the given source and target languages are supported.
 * @param {LanguagePair} languages Language pair.
 * @returns {Promise<boolean>} True if both source and target languages are supported.
 */
export const availability = async ({ sourceLanguage, targetLanguage }) =>
  !!normalizeLanguage(sourceLanguage) && !!normalizeLanguage(targetLanguage);

/**
 * Translate the given text with Google Gemini 2.5 Flash Lite.
 * Supports markdown content and preserves formatting.
 * @param {string[]} texts Array of original texts.
 * @param {TranslationOptions} options Options.
 * @returns {Promise<string[]>} Translated strings in the original order.
 * @throws {Error} When the source or target locale is not supported or API call fails.
 * @see https://ai.google.dev/gemini-api/docs/models/gemini
 * @see https://ai.google.dev/api/generate-content
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

  // Gemini API endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const systemPrompt = createTranslationSystemPrompt(sourceLanguageName, targetLanguageName);
  const userPrompt = createTranslationUserPrompt(texts);

  const requestBody = {
    system_instruction: {
      parts: [
        {
          text: systemPrompt,
        },
      ],
    },
    contents: [
      {
        parts: [
          {
            text: userPrompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3, // Lower temperature for more consistent translations
      maxOutputTokens: 4000,
      responseMimeType: 'application/json',
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText}` +
          `${errorData.error?.message ? ` - ${errorData.error.message}` : ''}`,
      );
    }

    const data = await response.json();

    if (
      !data.candidates ||
      !Array.isArray(data.candidates) ||
      !data.candidates[0] ||
      !data.candidates[0].content ||
      !data.candidates[0].content.parts ||
      !data.candidates[0].content.parts[0]
    ) {
      throw new Error('Invalid response format from Gemini API.');
    }

    const content = data.candidates[0].content.parts[0].text.trim();
    // Parse the JSON response
    let translations;

    try {
      translations = JSON.parse(content);
    } catch {
      throw new Error('Failed to parse JSON response from Gemini API.');
    }

    // Validate the response structure
    if (!Array.isArray(translations)) {
      throw new Error('Invalid JSON structure in Gemini API response.');
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

    throw new Error('Failed to translate text with Gemini API.');
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
