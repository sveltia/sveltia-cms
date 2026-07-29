/**
 * Abstracted AI API client utilities for Chat Completions, Messages, and Responses APIs.
 * Supports OpenAI, Mistral, DeepSeek, Anthropic, and custom compatible endpoints.
 */

import { isObject } from '@sveltia/utils/object';

/**
 * @import { AiCompletionOptions } from '$lib/types/private';
 */

/**
 * Options for the request to the API.
 * @typedef {object} RequestOptions
 * @property {string} endpoint API endpoint URL.
 * @property {Record<string, string>} [headers] Additional headers.
 * @property {Record<string, any>} [extraBody] Additional body parameters to include in the request.
 */

/**
 * Sends a message using the Chat Completions API format.
 * Used by: Mistral, DeepSeek, and compatible custom endpoints.
 * @param {AiCompletionOptions & RequestOptions} options Options.
 * @returns {Promise<string>} Response text.
 * @throws {Error} When the API call fails or returns an invalid response.
 */
export const chatCompletions = async ({
  endpoint,
  headers = {},
  apiKey,
  model,
  systemPrompt,
  userMessage,
  temperature = 0.3,
  maxTokens = 4000,
  reasoning = 'high',
  extraBody = {},
}) => {
  /** @type {Record<string, string>} */
  const defaultHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    ...headers,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: false,
      reasoning_effort: reasoning,
      ...extraBody,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.message || errorData.error?.message || '';

    throw new Error(
      `Chat Completions API error: ${response.status} ${response.statusText}` +
        `${errorMessage ? ` - ${errorMessage}` : ''}`,
    );
  }

  const data = await response.json();

  if (!data.choices || !Array.isArray(data.choices) || !data.choices[0]?.message?.content) {
    throw new Error('Invalid response format from Chat Completions API.');
  }

  return data.choices[0].message.content.trim();
};

/**
 * Sends a message using the Responses API format.
 * Used by: OpenAI, and compatible custom endpoints.
 * @param {AiCompletionOptions & RequestOptions} options Options.
 * @returns {Promise<string>} Response text.
 * @throws {Error} When the API call fails or returns an invalid response.
 */
export const responses = async ({
  endpoint,
  headers = {},
  apiKey,
  model,
  systemPrompt,
  userMessage,
  maxTokens = 4000,
  extraBody = {},
}) => {
  /** @type {Record<string, string>} */
  const defaultHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    ...headers,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({
      model,
      instructions: systemPrompt,
      input: userMessage,
      store: false,
      max_output_tokens: maxTokens,
      ...extraBody,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || '';

    throw new Error(
      `Responses API error: ${response.status} ${response.statusText}` +
        `${errorMessage ? ` - ${errorMessage}` : ''}`,
    );
  }

  const data = await response.json();

  // Try to get output_text directly first (simpler response format)
  if (typeof data.output_text === 'string') {
    return data.output_text.trim();
  }

  // Otherwise parse the output array for message items
  /** @type {unknown[]} */
  const output = Array.isArray(data.output) ? data.output : [];

  /** @type {unknown} */
  const message = output.find(
    (item) =>
      isObject(item) &&
      'type' in item &&
      item.type === 'message' &&
      'content' in item &&
      Array.isArray(item.content),
  );

  if (!isObject(message) || !('content' in message) || !Array.isArray(message.content)) {
    throw new Error('Invalid response format from Responses API.');
  }

  const { content } = message;

  /** @type {unknown} */
  const textItem = content.find(
    (item) =>
      isObject(item) &&
      'type' in item &&
      item.type === 'output_text' &&
      'text' in item &&
      typeof item.text === 'string',
  );

  if (isObject(textItem) && 'text' in textItem && typeof textItem.text === 'string') {
    return textItem.text.trim();
  }

  throw new Error('Invalid response format from Responses API.');
};

/**
 * Sends a message using the Messages API format.
 * Used by: Anthropic Claude, and compatible custom endpoints.
 * @param {AiCompletionOptions & RequestOptions} options Options.
 * @returns {Promise<string>} Response text.
 * @throws {Error} When the API call fails or returns an invalid response.
 */
export const messages = async ({
  endpoint,
  headers = {},
  apiKey,
  model,
  systemPrompt,
  userMessage,
  temperature = 0.3,
  maxTokens = 4000,
  extraBody = {},
}) => {
  /** @type {Record<string, string>} */
  const defaultHeaders = { 'Content-Type': 'application/json', ...headers };

  // Use x-api-key for Anthropic, Authorization for custom endpoints by default
  if (!headers.Authorization && !headers['x-api-key']) {
    defaultHeaders['x-api-key'] = apiKey;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      ...extraBody,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || errorData.message || '';

    throw new Error(
      `Messages API error: ${response.status} ${response.statusText}` +
        `${errorMessage ? ` - ${errorMessage}` : ''}`,
    );
  }

  const data = await response.json();

  if (!data.content || !Array.isArray(data.content) || !data.content[0]) {
    throw new Error('Invalid response format from Messages API.');
  }

  return data.content[0].text.trim();
};
