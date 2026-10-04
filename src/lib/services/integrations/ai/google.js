/**
 * Generic Google Gemini API client.
 * @see https://ai.google.dev/api/generate-content
 */

import { postJSON } from '$lib/services/integrations/ai/api';

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
  maxTokens = 4000,
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

  if (!Array.isArray(data.candidates) || !data.candidates[0]?.content?.parts?.[0]) {
    throw new Error('Invalid response format from Gemini API.');
  }

  return data.candidates[0].content.parts[0].text.trim();
};
