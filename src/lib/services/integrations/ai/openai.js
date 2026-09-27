/**
 * Generic OpenAI API client.
 * @see https://developers.openai.com/api/reference/resources/responses/methods/create
 */

import { responses } from './api.js';

/**
 * @import { AiCompletionOptions } from '$lib/types/private';
 */

const endpoint = 'https://api.openai.com/v1/responses';

export const apiLabel = 'OpenAI API';
export const developerURL = 'https://platform.openai.com/docs/overview';
export const apiKeyURL = 'https://platform.openai.com/api-keys';
// Anchored, and an Anthropic key (`sk-ant-…`) excluded, so a key for another service entered while
// this one is selected isn’t accepted and sent to the wrong API
export const apiKeyPattern = /^sk-(?!ant-)[a-zA-Z0-9-_]{40,}$/;

/**
 * Send a message to the OpenAI Responses API and return the response text.
 * @param {AiCompletionOptions} options Options.
 * @returns {Promise<string>} Response text.
 * @throws {Error} When the API call fails or returns an invalid response.
 */
export const complete = async (options) => responses({ ...options, endpoint });
