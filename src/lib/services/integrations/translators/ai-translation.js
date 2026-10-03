/**
 * Shared utilities for translation services.
 */

import { getLocaleLabel } from '$lib/services/contents/i18n';

/**
 * @import {
 * AiCompletionOptions,
 * LanguagePair,
 * TranslationOptions,
 * TranslationService,
 * } from '$lib/types/private';
 */

/**
 * Normalize a locale code to a language label in English that AI services can understand.
 * @param {string} locale Locale code, e.g., 'en', 'fr-FR', 'zh-CN'.
 * @returns {string | undefined} Normalized language label, e.g., 'English', 'French', 'Chinese'.
 */
export const normalizeLanguage = (locale) => getLocaleLabel(locale, { displayLocale: 'en' });

/**
 * Generate a standardized system prompt for AI translation services.
 * @param {string} sourceLanguageName Source language name, e.g., 'English', 'Canadian French'.
 * @param {string} targetLanguageName Target language name, e.g., 'French', 'Brazilian Portuguese'.
 * @returns {string} System prompt for translation.
 */
export const createTranslationSystemPrompt = (sourceLanguageName, targetLanguageName) => {
  const baseInstructions = [
    '- CRITICAL: Leave content EXACTLY unchanged within HTML elements that have translate="no"',
    '- CRITICAL: Leave content EXACTLY unchanged within HTML elements that have class="notranslate"',
    '- CRITICAL: Leave content EXACTLY unchanged between "notranslate" and "/notranslate" comments',
    '- Preserve all markdown formatting (headers, links, bold, italic, code blocks, lists, etc.)',
    '- Preserve all HTML tags and attributes exactly as they are',
    '- Maintain the original structure and formatting',
    '- Do not translate code content within code blocks or inline code',
    '- Do not translate URLs, email addresses, or technical identifiers',
    '- If you see translate="no", class="notranslate", or notranslate comments, copy that content verbatim without any changes',
  ];

  const lineBreakInstructions = [
    '- Do not split translations into separate paragraphs or add extra line breaks',
    '- Keep each translation as a single continuous text string in the array',
  ];

  const responseInstructions = [
    '- Return your response as a valid JSON array containing the translated texts',
    '- The array should contain the translated texts in the same order as provided',
    '- VALIDATION: Before responding, double-check that any translate="no", class="notranslate", or notranslate comment content remains EXACTLY the same',
  ];

  const allInstructions = [...baseInstructions, ...lineBreakInstructions, ...responseInstructions];

  return (
    'You are a professional translator. Translate the given texts from ' +
    `${sourceLanguageName} to ${targetLanguageName}. ` +
    'Your response must be valid JSON that can be parsed directly.\n\n' +
    `IMPORTANT INSTRUCTIONS:\n${allInstructions.join('\n')}\n\n` +
    'OUTPUT FORMAT:\n' +
    '- Output ONLY valid JSON, nothing else\n' +
    '- Do NOT use markdown code blocks or formatting\n' +
    '- Do NOT add any explanation or commentary\n' +
    '- Your entire response should be parseable by JSON.parse()\n' +
    '- Start your response with [ and end with ]\n\n' +
    'Required JSON structure:\n' +
    '["translation 1", "translation 2", ...]'
  );
};

/**
 * Create a standardized user prompt for translation requests.
 * @param {string[]} texts Array of texts to translate.
 * @returns {string} User prompt for translation.
 */
export const createTranslationUserPrompt = (texts) =>
  'Translate these texts and return ONLY valid JSON (no markdown, no code blocks):\n' +
  `${JSON.stringify(texts)}\n\n` +
  'Respond with JSON only:';

/**
 * Parse and validate a JSON array of translations from an AI API response.
 * @param {string} content Raw text content from the AI response.
 * @param {number} expectedCount Expected number of translated strings.
 * @param {string} serviceLabel Label for the AI service used in error messages, e.g. `'Anthropic
 * API'`.
 * @returns {string[]} Array of translated strings.
 * @throws {Error} When the content cannot be parsed or the count doesn’t match.
 */
const parseAiTranslationResponse = (content, expectedCount, serviceLabel) => {
  let translations;

  try {
    translations = JSON.parse(content);
  } catch {
    throw new Error(`Failed to parse JSON response from ${serviceLabel}.`);
  }

  if (!Array.isArray(translations)) {
    throw new Error(`Invalid JSON structure in ${serviceLabel} response.`);
  }

  if (translations.length !== expectedCount) {
    throw new Error(
      `Translation count mismatch: expected ${expectedCount}, got ${translations.length}`,
    );
  }

  return translations;
};

/**
 * Check if the given source and target languages are supported.
 * @param {LanguagePair} languages Language pair.
 * @returns {Promise<boolean>} True if both source and target languages are supported.
 */
export const availability = async ({ sourceLanguage, targetLanguage }) =>
  !!normalizeLanguage(sourceLanguage) && !!normalizeLanguage(targetLanguage);

/**
 * Resolve and validate source and target language names from locale codes.
 * @param {string} sourceLanguage Source locale code.
 * @param {string} targetLanguage Target locale code.
 * @returns {[string, string]} Tuple of [sourceLanguageName, targetLanguageName].
 * @throws {Error} When source or target locale is not supported.
 */
export const resolveLanguageNames = (sourceLanguage, targetLanguage) => {
  const sourceLangName = normalizeLanguage(sourceLanguage);
  const targetLangName = normalizeLanguage(targetLanguage);

  if (!sourceLangName) {
    throw new Error('Source locale is not supported.');
  }

  if (!targetLangName) {
    throw new Error('Target locale is not supported.');
  }

  return [sourceLangName, targetLangName];
};

/**
 * Create a `translate` function for an AI-based translation service.
 * @param {(options: AiCompletionOptions) => Promise<string>} complete AI completion function from
 * the service’s AI module.
 * @param {string} model Model identifier to use for translation.
 * @param {string} apiLabel Label for the service used in error messages, e.g. `'Anthropic API'`.
 * @param {object} [extraOptions] Extra options to pass to `complete`, e.g. `{ reasoning: 'none' }`.
 * @returns {(texts: string[], options: TranslationOptions) => Promise<string[]>} Translate
 * function.
 */
const createAiTranslate =
  (complete, model, apiLabel, extraOptions = {}) =>
  /**
   * Translate the given texts using the AI service.
   * @param {string[]} texts Array of original texts.
   * @param {TranslationOptions} options Options.
   * @returns {Promise<string[]>} Translated strings in the original order.
   */
  async (texts, { sourceLanguage, targetLanguage, apiKey }) => {
    const [sourceLangName, targetLangName] = resolveLanguageNames(sourceLanguage, targetLanguage);

    const content = await complete({
      apiKey,
      model,
      systemPrompt: createTranslationSystemPrompt(sourceLangName, targetLangName),
      userMessage: createTranslationUserPrompt(texts),
      ...extraOptions,
    });

    return parseAiTranslationResponse(content, texts.length, apiLabel);
  };

/**
 * Create a translation service backed by an AI service. Every AI service supports Markdown content
 * and preserves formatting.
 * @param {object} args Arguments.
 * @param {object} args.ai The service’s AI module.
 * @param {string} args.ai.apiLabel Label for the service used in error messages.
 * @param {string} args.ai.developerURL URL of the service’s developer site.
 * @param {string} args.ai.apiKeyURL URL of the page to create an API key.
 * @param {RegExp} args.ai.apiKeyPattern Pattern of a valid API key.
 * @param {(options: AiCompletionOptions) => Promise<string>} args.ai.complete AI completion
 * function.
 * @param {string} args.serviceId Service ID.
 * @param {string} args.serviceLabel Service label.
 * @param {string} args.model Model identifier to use for translation.
 * @param {object} [args.extraOptions] Extra options to pass to `complete`.
 * @returns {TranslationService} Translation service.
 */
export const createAiTranslationService = ({
  ai: { apiLabel, developerURL, apiKeyURL, apiKeyPattern, complete },
  serviceId,
  serviceLabel,
  model,
  extraOptions,
}) => ({
  serviceId,
  serviceLabel,
  apiLabel,
  developerURL,
  apiKeyURL,
  apiKeyPattern,
  markdownSupported: true,
  availability,
  translate: createAiTranslate(complete, model, apiLabel, extraOptions),
});
