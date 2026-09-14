import { addMessages, locale } from '@sveltia/i18n';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import ExpandIcon from './expand-icon.svelte';

describe('ExpandIcon', () => {
  // Register a right-to-left locale, without strings, so it can be switched to
  beforeAll(() => {
    addMessages('ar', {});
  });

  afterEach(() => {
    locale.set('en-US');
  });

  test('points down when expanded', async () => {
    const { container } = await render(ExpandIcon, { expanded: true });

    expect(container).toHaveTextContent('expand_more');
  });

  test('points to the end when collapsed, following the text direction', async () => {
    expect((await render(ExpandIcon, {})).container).toHaveTextContent('chevron_right');

    locale.set('ar');

    expect((await render(ExpandIcon, { expanded: false })).container).toHaveTextContent(
      'chevron_left',
    );
  });

  test('is hidden from assistive technology', async () => {
    const { container } = await render(ExpandIcon, {});

    expect(container.querySelector('.icon')).toHaveAttribute('aria-hidden', 'true');
  });
});
