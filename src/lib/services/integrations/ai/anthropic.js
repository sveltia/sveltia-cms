/**
 * Generic Anthropic Claude API client.
 * @see https://docs.claude.com/en/api/messages
 */

import { messages } from './api.js';

/**
 * @import { AiCompletionOptions } from '$lib/types/private';
 */

const endpoint = 'https://api.anthropic.com/v1/messages';

const headers = {
  'anthropic-version': '2023-06-01',
  // Work around for CORS issues in browsers
  // @see https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/
  'anthropic-dangerous-direct-browser-access': 'true',
};

export const apiLabel = 'Anthropic API';
export const developerURL = 'https://docs.claude.com/en/api/overview';
export const apiKeyURL = 'https://platform.claude.com/settings/keys';
export const apiKeyPattern = /sk-ant-api03-[a-zA-Z0-9-_]{80,}/;

/**
 * Send a message to the Anthropic Messages API and return the response text.
 * @param {AiCompletionOptions} options Options.
 * @returns {Promise<string>} Response text.
 * @throws {Error} When the API call fails or returns an invalid response.
 */
export const complete = async (options) => messages({ ...options, endpoint, headers });
