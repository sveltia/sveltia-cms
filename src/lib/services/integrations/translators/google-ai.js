import { complete } from '$lib/services/integrations/ai/google';

import {
  createTranslationSystemPrompt,
  createTranslationUserPrompt,
  normalizeLanguage,
  parseAiTranslationResponse,
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

  try {
    const content = await complete({
      apiKey,
      model,
      systemPrompt: createTranslationSystemPrompt(sourceLanguageName, targetLanguageName),
      userMessage: createTranslationUserPrompt(texts),
      responseFormat: 'application/json',
    });

    return parseAiTranslationResponse(content, texts.length, 'Gemini API');
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
