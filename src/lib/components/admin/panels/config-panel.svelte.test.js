import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { rawCmsConfig } from '$lib/services/config';

import ConfigPanel from './config-panel.svelte';

describe('ConfigPanel', () => {
  test('shows the raw configuration as YAML', async () => {
    Object.assign(rawCmsConfig, { backend: { name: 'github', repo: 'acme/site' } });

    await render(ConfigPanel, { title: 'CMS Configuration' });

    await expect
      .element(page.getByRole('blockquote', { name: 'CMS Configuration' }))
      .toHaveTextContent('backend: name: github repo: acme/site');
  });
});
