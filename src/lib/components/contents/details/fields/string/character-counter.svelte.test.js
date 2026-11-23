import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import CharacterCounter from './character-counter.svelte';

/**
 * @import { StringField } from '$lib/types/public';
 */

/**
 * Render the counter.
 * @param {string | undefined} currentValue Field value.
 * @param {Partial<StringField>} config Field options.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderCounter = async (currentValue, config) => {
  const { container } = await render(CharacterCounter, {
    locale: 'en',
    fieldConfig: { name: 'title', widget: 'string', ...config },
    currentValue,
  });

  return container;
};

describe('CharacterCounter', () => {
  test('shows nothing when the field has no length limits', async () => {
    expect((await renderCounter('Hello', {})).children).toHaveLength(0);
  });

  test('shows the count against the maximum', async () => {
    const container = await renderCounter('Hello', { maxlength: 10 });

    expect(container).toHaveTextContent('5 / 10');
    expect(container.querySelector('.wrapper')).toHaveAttribute(
      'aria-label',
      '5 characters entered. Maximum: 10.',
    );
    expect(container.querySelector('.count')).not.toHaveClass('invalid');
  });

  test('shows the count against the minimum', async () => {
    const container = await renderCounter('Hi', { minlength: 3 });

    expect(container).toHaveTextContent('3 / 2');
    expect(container.querySelector('.count')).toHaveClass('invalid');
  });

  test('shows the count within the range', async () => {
    const container = await renderCounter('Hello', { minlength: 3, maxlength: 10 });

    expect(container).toHaveTextContent('3 / 5 / 10');
    expect(container.querySelector('.count')).not.toHaveClass('invalid');
  });

  test('marks an overlong value invalid', async () => {
    const container = await renderCounter('Hello, world!', { maxlength: 10 });

    expect(container).toHaveTextContent('13 / 10');
    expect(container.querySelector('.count')).toHaveClass('invalid');
  });

  test('counts an empty value as zero', async () => {
    expect(await renderCounter(undefined, { maxlength: 10 })).toHaveTextContent('0 / 10');
  });
});
