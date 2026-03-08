/**
 * Generic Google Gemini API client.
 * @see https://ai.google.dev/api/generate-content
 */

/**
 * @import { AiCompletionOptions } from '$lib/types/private';
 */

export const apiLabel = 'Google AI Studio API';
export const developerURL = 'https://ai.google.dev/gemini-api/docs';
export const apiKeyURL = 'https://aistudio.google.com/api-keys';
export const apiKeyPattern = /AIza[a-zA-Z0-9_-]{35}/;

/**
 * Send a message to the Google Gemini API and return the response text.
 * @param {AiCompletionOptions & { responseFormat?: string }} options Options. Pass
 * `responseFormat: 'application/json'` to request a JSON response directly without markdown fences.
 * @returns {Promise<string>} Response text.
 * @throws {Error} When the API call fails or returns an invalid response.
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(responseFormat ? { responseMimeType: responseFormat } : {}),
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText}` +
        `${errorData.error?.message ? ` - ${errorData.error.message}` : ''}`,
    );
  }

  const data = await response.json();

  if (!Array.isArray(data.candidates) || !data.candidates[0]?.content?.parts?.[0]) {
    throw new Error('Invalid response format from Gemini API.');
  }

  return data.candidates[0].content.parts[0].text.trim();
};
