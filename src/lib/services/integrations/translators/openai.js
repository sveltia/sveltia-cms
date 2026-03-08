import { complete } from '$lib/services/integrations/ai/openai';

import {
  createTranslationSystemPrompt,
  createTranslationUserPrompt,
  normalizeLanguage,
  parseAiTranslationResponse,
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

  try {
    const content = await complete({
      apiKey,
      model,
      systemPrompt: createTranslationSystemPrompt(sourceLanguageName, targetLanguageName),
      userMessage: createTranslationUserPrompt(texts),
    });

    return parseAiTranslationResponse(content, texts.length, 'OpenAI API');
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
