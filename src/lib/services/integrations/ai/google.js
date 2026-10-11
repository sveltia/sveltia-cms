/**
 * Generic Google Gemini API client.
 * @see https://ai.google.dev/api/generate-content
 */

import { isObject } from '@sveltia/utils/object';

import {
  createTruncationError,
  DEFAULT_MAX_TOKENS,
  postJSON,
} from '$lib/services/integrations/ai/api';

/**
 * @import { AiCompletionOptions } from '$lib/types/private';
 */

export const apiLabel = 'Gemini API';
export const developerURL = 'https://ai.google.dev/gemini-api/docs';
export const apiKeyURL = 'https://aistudio.google.com/api-keys';
// Anchored, so a key for another service entered while this one is selected isn’t accepted and sent
// to the wrong API
export const apiKeyPattern = /^AIza[a-zA-Z0-9_-]{35}$/;

/**
 * Send a message to the Google Gemini API and return the response text.
 * @param {AiCompletionOptions & { responseFormat?: string }} options Options. Pass
 * `responseFormat: 'application/json'` to request a JSON response directly without markdown fences.
 * @returns {Promise<string>} Response text.
 * @throws {Error} When the API call fails or returns an invalid response.
 * @see https://ai.google.dev/api#authentication
 */
export const complete = async ({
  apiKey,
  model,
  systemPrompt,
  userMessage,
  temperature = 0.3,
  maxTokens = DEFAULT_MAX_TOKENS,
  responseFormat,
}) => {
  const data = await postJSON({
    endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    // The key goes in a header rather than the URL, which can end up in logs
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    apiLabel: 'Gemini',
    body: {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(responseFormat ? { responseMimeType: responseFormat } : {}),
      },
    },
  });

  const candidate = Array.isArray(data.candidates) ? data.candidates[0] : undefined;

  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw createTruncationError('Gemini');
  }

  // The answer can be split into several parts, and a thinking model can add a thought summary
  /** @type {string[]} */
  const texts = Array.isArray(candidate?.content?.parts)
    ? candidate.content.parts
        .filter(
          (/** @type {unknown} */ part) =>
            isObject(part) && !part.thought && typeof part.text === 'string',
        )
        .map((/** @type {{ text: string }} */ { text }) => text)
    : [];

  if (!texts.length) {
    throw new Error('Invalid response format from Gemini API.');
  }

  return texts.join('').trim();
};
