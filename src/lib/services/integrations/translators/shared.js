/**
 * Shared utilities for translation services.
 */

import { getLocaleLabel } from '$lib/services/contents/i18n';

/**
 * Generate a standardized system prompt for AI translation services.
 * @param {string} sourceLanguage Source language code.
 * @param {string} targetLanguage Target language code.
 * @returns {string} System prompt for translation.
 */
export const createTranslationSystemPrompt = (sourceLanguage, targetLanguage) => {
  const sourceLanguageName = getLocaleLabel(sourceLanguage);
  const targetLanguageName = getLocaleLabel(targetLanguage);

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
    '- Return your response as a valid JSON object with a "translations" array',
    '- The "translations" array should contain the translated texts in the same order as provided',
    '- VALIDATION: Before responding, double-check that any translate="no", class="notranslate", or notranslate comment content remains EXACTLY the same',
  ];

  const allInstructions = [...baseInstructions, ...lineBreakInstructions, ...responseInstructions];

  return (
    'You are a professional translator. Translate the given texts from ' +
    `${sourceLanguageName} to ${targetLanguageName}.

IMPORTANT INSTRUCTIONS:
${allInstructions.join('\n')}

RESPONSE FORMAT:
Return a JSON object with this exact structure:
{
  "translations": ["translated text 1", "translated text 2", ...]
}`
  );
};

/**
 * Create a standardized user prompt for translation requests.
 * @param {string[]} texts Array of texts to translate.
 * @returns {string} User prompt for translation.
 */
export const createTranslationUserPrompt = (texts) =>
  `Translate these texts:\n${JSON.stringify(texts)}`;
