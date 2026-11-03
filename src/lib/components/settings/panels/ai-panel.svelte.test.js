import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { allAiServices } from '$lib/services/integrations/ai';
import { prefs } from '$lib/services/user/prefs.svelte';

import AiPanel from './ai-panel.svelte';

describe('AiPanel', () => {
  test('offers an API key input per AI service', async () => {
    const { container } = await render(AiPanel, {});

    await expect.element(page.getByRole('heading', { name: 'AI Service API Keys' })).toBeVisible();
    await expect.element(page.getByText('Manage API keys for AI services.')).toBeVisible();
    expect(container.querySelector('a')).toBeNull();
    expect([...container.querySelectorAll('h4')].map((h4) => h4.textContent)).toEqual(
      Object.values(allAiServices).map(({ serviceLabel }) => serviceLabel),
    );
    expect(page.getByRole('textbox').elements()).toHaveLength(Object.keys(allAiServices).length);
    expect(page.getByRole('textbox', { name: /Google Cloud Translation/ }).elements()).toHaveLength(
      0,
    );
  });

  test('saves an API key', async () => {
    prefs.apiKeys = {};

    const onChange = vi.fn();

    await render(AiPanel, { onChange });

    const input = page.getByRole('textbox', { name: /OpenAI GPT/ });

    await input.fill('sk-'.padEnd(43, 'a'));
    await input.element().blur();
    expect(prefs.apiKeys?.openai).toBe('sk-'.padEnd(43, 'a'));
    expect(onChange).toHaveBeenCalledWith({ message: 'API key saved.', status: 'success' });
  });
});
