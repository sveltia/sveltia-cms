/**
 * Generic OpenAI API client.
 * @see https://platform.openai.com/docs/api-reference/chat/create
 */

/**
 * @import { AiCompletionOptions } from '$lib/types/private';
 */

const apiEndpoint = 'https://api.openai.com/v1/chat/completions';

export const apiLabel = 'OpenAI API';
export const developerURL = 'https://platform.openai.com/docs/overview';
export const apiKeyURL = 'https://platform.openai.com/api-keys';
export const apiKeyPattern = /sk-[a-zA-Z0-9-_]{40,}/;

/**
 * Send a message to the OpenAI Chat Completions API and return the response text.
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
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText}` +
        `${errorData.error?.message ? ` - ${errorData.error.message}` : ''}`,
    );
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response format from OpenAI API.');
  }

  return data.choices[0].message.content.trim();
};
