/**
 * Generic Mistral AI API client.
 * @see https://docs.mistral.ai/api
 */

import { chatCompletions } from './api.js';

/**
 * @import { AiCompletionOptions } from '$lib/types/private';
 */

const endpoint = 'https://api.mistral.ai/v1/chat/completions';

export const apiLabel = 'Mistral AI API';
export const developerURL = 'https://docs.mistral.ai/';
export const apiKeyURL = 'https://console.mistral.ai/home?profile_dialog=api-keys';
// Anchored, and a Google key (`AIza…`) excluded, so a key for another service entered while this
// one is selected isn’t accepted and sent to the wrong API
export const apiKeyPattern = /^(?!AIza)[a-zA-Z0-9]{32,}$/;

/**
 * Send a message to the Mistral AI Chat Completions API and return the response text.
 * @param {AiCompletionOptions} options Options.
 * @returns {Promise<string>} Response text.
 * @throws {Error} When the API call fails or returns an invalid response.
 */
export const complete = async (options) => chatCompletions({ ...options, endpoint });
