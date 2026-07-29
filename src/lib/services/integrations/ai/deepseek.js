/**
 * Generic DeepSeek API client.
 * @see https://api-docs.deepseek.com/api/create-chat-completion
 */

import { chatCompletions } from './api.js';

/**
 * @import { AiCompletionOptions } from '$lib/types/private';
 */

const endpoint = 'https://api.deepseek.com/chat/completions';

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
export const complete = async (options) =>
  chatCompletions({
    ...options,
    endpoint,
    extraBody: /** @type {Record<string, any>} */ ({
      thinking: { type: options.reasoning === 'none' ? 'disabled' : 'enabled' },
    }),
  });
