/**
 * Entry point of the npm build. Same as `main.js`, except that everything the CDN builds fetch from
 * UNPKG or jsDelivr at runtime is bundled as a separate chunk or asset instead, so the consumer’s
 * bundler can emit it and the CMS doesn’t contact any third-party CDN.
 */
import { setupSelfHostedAssets } from '@sveltia/ui/self-hosted';

import CMS from './main';

export default CMS;
export * from './services/api';

// Fonts and syntax highlighting grammars of Sveltia UI
setupSelfHostedAssets();
