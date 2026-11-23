import * as anthropic from './anthropic';
import * as deepseek from './deepseek';
import * as google from './google';
import * as mistral from './mistral';
import * as openai from './openai';

/**
 * @import { AiService } from '$lib/types/private';
 */

/**
 * List of all the supported AI services, keyed by service ID. Alphabetical order by service name.
 * @type {Record<string, AiService>}
 */
export const allAiServices = Object.fromEntries(
  [anthropic, deepseek, google, mistral, openai].map((service) => [service.serviceId, service]),
);
