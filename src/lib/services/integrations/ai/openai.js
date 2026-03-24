/**
 * Generic OpenAI API client.
 * @see https://developers.openai.com/api/reference/resources/responses/methods/create
 */

/**
 * @import { AiCompletionOptions } from '$lib/types/private';
 */

const apiEndpoint = 'https://api.openai.com/v1/responses';

export const apiLabel = 'OpenAI API';
export const developerURL = 'https://platform.openai.com/docs/overview';
export const apiKeyURL = 'https://platform.openai.com/api-keys';
export const apiKeyPattern = /sk-[a-zA-Z0-9-_]{40,}/;

/**
 * Check whether an output item is a message item with array content.
 * @param {unknown} item Candidate output item.
 * @returns {item is { content: unknown[] }} True if the item is a message with content.
 */
const isMessageOutputItem = (item) =>
  typeof item === 'object' &&
  item !== null &&
  'type' in item &&
  item.type === 'message' &&
  'content' in item &&
  Array.isArray(item.content);

/**
 * Check whether a message content item contains output text.
 * @param {unknown} item Candidate message content item.
 * @returns {item is { text: string }} True if the item contains output text.
 */
const isOutputTextItem = (item) =>
  typeof item === 'object' &&
  item !== null &&
  'type' in item &&
  item.type === 'output_text' &&
  'text' in item &&
  typeof item.text === 'string';

/**
 * Send a message to the OpenAI Responses API and return the response text.
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
      instructions: systemPrompt,
      input: userMessage,
      store: false,
      temperature,
      max_output_tokens: maxTokens,
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

  if (typeof data.output_text === 'string') {
    return data.output_text.trim();
  }

  /** @type {unknown[]} */
  const output = Array.isArray(data.output) ? data.output : [];
  const message = output.find(isMessageOutputItem);
  /** @type {unknown[]} */
  const content = Array.isArray(message?.content) ? message.content : [];
  const textItem = content.find(isOutputTextItem);

  if (typeof textItem?.text === 'string') {
    return textItem.text.trim();
  }

  throw new Error('Invalid response format from OpenAI API.');
};
