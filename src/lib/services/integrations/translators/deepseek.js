import {
  apiKeyPattern,
  apiKeyURL,
  apiLabel,
  complete,
  developerURL,
} from '$lib/services/integrations/ai/deepseek';

import {
  createTranslationSystemPrompt,
  createTranslationUserPrompt,
  normalizeLanguage,
  parseAiTranslationResponse,
} from './shared.js';

/**
 * @import { LanguagePair, TranslationOptions, TranslationService } from '$lib/types/private';
 */

const serviceId = 'deepseek';
const serviceLabel = 'DeepSeek';
const model = 'deepseek-chat';

/**
 * Check if the given source and target languages are supported.
 * @param {LanguagePair} languages Language pair.
 * @returns {Promise<boolean>} True if both source and target languages are supported.
 */
export const availability = async ({ sourceLanguage, targetLanguage }) =>
  !!normalizeLanguage(sourceLanguage) && !!normalizeLanguage(targetLanguage);

/**
 * Translate the given text with DeepSeek.
 * Supports markdown content and preserves formatting.
 * @param {string[]} texts Array of original texts.
 * @param {TranslationOptions} options Options.
 * @returns {Promise<string[]>} Translated strings in the original order.
 * @throws {Error} When the source or target locale is not supported or API call fails.
 * @see https://api-docs.deepseek.com/api/create-chat-completion
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

    return parseAiTranslationResponse(content, texts.length, 'DeepSeek API');
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to translate text with DeepSeek API.');
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
