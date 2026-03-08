/**
 * Generic Anthropic Claude API client.
 * @see https://docs.claude.com/en/api/messages
 */

/**
 * @import { AiCompletionOptions } from '$lib/types/private';
 */

const apiEndpoint = 'https://api.anthropic.com/v1/messages';

/**
 * Send a message to the Anthropic Messages API and return the response text.
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
}) => {
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Work around for CORS issues in browsers
      // @see https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
      `Anthropic API error: ${response.status} ${response.statusText}` +
        `${errorData.error?.message ? ` - ${errorData.error.message}` : ''}`,
    );
  }

  const data = await response.json();

  if (!data.content || !Array.isArray(data.content) || !data.content[0]) {
    throw new Error('Invalid response format from Anthropic API.');
  }

  return data.content[0].text.trim();
};
