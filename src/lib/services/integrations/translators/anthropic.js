import { complete } from '$lib/services/integrations/ai/anthropic';

import {
  createTranslationSystemPrompt,
  createTranslationUserPrompt,
  normalizeLanguage,
  parseAiTranslationResponse,
} from './shared.js';

/**
 * @import { LanguagePair, TranslationOptions, TranslationService } from '$lib/types/private';
 */

const serviceId = 'anthropic';
const serviceLabel = 'Anthropic Claude';
const apiLabel = 'Anthropic API';
const developerURL = 'https://docs.claude.com/en/api/overview';
const apiKeyURL = 'https://platform.claude.com/settings/keys';
const apiKeyPattern = /sk-ant-api03-[a-zA-Z0-9-_]{80,}/;
const model = 'claude-haiku-4-5';

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

  try {
    const content = await complete({
      apiKey,
      model,
      systemPrompt: createTranslationSystemPrompt(sourceLanguageName, targetLanguageName),
      userMessage: createTranslationUserPrompt(texts),
    });

    return parseAiTranslationResponse(content, texts.length, 'Anthropic API');
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
