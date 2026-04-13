/**
 * Generic DeepSeek API client.
 * @see https://api-docs.deepseek.com/api/create-chat-completion
 */

/**
 * @import { AiCompletionOptions } from '$lib/types/private';
 */

const apiEndpoint = 'https://api.deepseek.com/chat/completions';

export const apiLabel = 'DeepSeek API';
export const developerURL = 'https://api-docs.deepseek.com/';
export const apiKeyURL = 'https://platform.deepseek.com/api_keys';
export const apiKeyPattern = /sk-[a-zA-Z0-9]{32,}/;

/**
 * Send a message to the DeepSeek Chat Completions API and return the response text.
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
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
      `DeepSeek API error: ${response.status} ${response.statusText}` +
        `${errorData.error?.message ? ` - ${errorData.error.message}` : ''}`,
    );
  }

  const data = await response.json();

  if (!data.choices || !Array.isArray(data.choices) || !data.choices[0]?.message?.content) {
    throw new Error('Invalid response format from DeepSeek API.');
  }

  return data.choices[0].message.content.trim();
};
