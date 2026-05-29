/**
 * Generic Mistral AI API client.
 * @see https://docs.mistral.ai/api
 */

/**
 * @import { AiCompletionOptions } from '$lib/types/private';
 */

const apiEndpoint = 'https://api.mistral.ai/v1/chat/completions';

export const apiLabel = 'Mistral AI API';
export const developerURL = 'https://docs.mistral.ai/';
export const apiKeyURL = 'https://console.mistral.ai/home?profile_dialog=api-keys';
export const apiKeyPattern = /[a-zA-Z0-9]{32,}/;

/**
 * Send a message to the Mistral AI Chat Completions API and return the response text.
 * @param {AiCompletionOptions} options Options.
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
  reasoning = true,
}) => {
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
      reasoning_effort: reasoning ? 'high' : 'none',
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
      `Mistral AI API error: ${response.status} ${response.statusText}` +
        `${errorData.message ? ` - ${errorData.message}` : ''}`,
    );
  }

  const data = await response.json();

  if (!data.choices || !Array.isArray(data.choices) || !data.choices[0]?.message?.content) {
    throw new Error('Invalid response format from Mistral AI API.');
  }

  return data.choices[0].message.content.trim();
};
