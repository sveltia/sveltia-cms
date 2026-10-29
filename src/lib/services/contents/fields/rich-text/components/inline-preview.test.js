// @vitest-environment happy-dom
/* eslint-disable jsdoc/require-jsdoc */
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getInlinePreview,
  renderInlinePreview,
} from '$lib/services/contents/fields/rich-text/components/inline-preview';

const { render, unmount } = vi.hoisted(() => ({ render: vi.fn(), unmount: vi.fn() }));

vi.mock('$lib/services/api/react-dom', () => ({
  createReactRoot: vi.fn(() => ({ render, unmount })),
  loadReactDom: vi.fn(() => Promise.resolve()),
}));

const toInline = ({ page = '' }) => `[[${page}]]`;

describe('getInlinePreview', () => {
  it('should return a string preview', () => {
    expect(
      getInlinePreview({ toPreview: ({ page }) => `**${page}**`, toInline }, { page: 'A' }),
    ).toEqual({ preview: '**A**', text: '' });
  });

  it('should return an element preview', () => {
    const element = document.createElement('a');

    expect(getInlinePreview({ toPreview: () => element, toInline }, {})).toEqual({
      preview: element,
      text: '',
    });
  });

  it('should return a React element preview', () => {
    const element = createElement('a', null, 'A');

    expect(getInlinePreview({ toPreview: () => element, toInline }, {}).preview).toBe(element);
  });

  it('should fall back to the Markdown without a preview', () => {
    expect(getInlinePreview({ toInline }, { page: 'A' })).toEqual({ text: '[[A]]' });
    expect(
      getInlinePreview({ toPreview: () => /** @type {any} */ (42), toInline }, { page: 'A' }),
    ).toEqual({
      text: '[[A]]',
    });
  });

  it('should fall back to the Markdown if the preview throws', () => {
    expect(
      getInlinePreview(
        {
          toPreview: () => {
            throw new Error('Broken');
          },
          toInline,
        },
        { page: 'A' },
      ),
    ).toEqual({ text: '[[A]]' });
  });

  it('should return an empty text if the Markdown can’t be made either', () => {
    expect(
      getInlinePreview(
        {
          toInline: () => {
            throw new Error('Broken');
          },
        },
        {},
      ),
    ).toEqual({ text: '' });
    expect(getInlinePreview({ toInline: () => /** @type {any} */ (undefined) }, {})).toEqual({
      text: '',
    });
  });

  it('should pass an asset getter that finds nothing', () => {
    const toPreview = vi.fn(() => '');

    getInlinePreview({ toPreview, toInline }, { page: 'A' });

    expect(toPreview).toHaveBeenCalledWith({ page: 'A' }, expect.any(Function), undefined);
    expect(/** @type {any} */ (toPreview.mock.calls[0])[1]('/a.png')).toBeUndefined();
  });
});

describe('renderInlinePreview', () => {
  /** @type {HTMLElement} */
  let element;

  beforeEach(() => {
    element = document.createElement('span');
  });

  it('should render a string as sanitized inline Markdown', () => {
    const remove = renderInlinePreview(element, {
      preview: '**A** <img src="x" onerror="alert(1)">',
      text: '',
    });

    expect(element.querySelector('strong')?.textContent).toBe('A');
    expect(element.querySelector('img')?.hasAttribute('onerror')).toBe(false);

    remove();

    expect(element.innerHTML).toBe('');
  });

  it('should insert an element and notify it once removed', () => {
    const preview = document.createElement('a');
    const onUnmount = vi.fn();

    preview.addEventListener('Unmount', onUnmount);

    const remove = renderInlinePreview(element, { preview, text: '' });

    expect(element.firstChild).toBe(preview);
    expect(onUnmount).not.toHaveBeenCalled();

    remove();

    expect(element.firstChild).toBeNull();
    expect(onUnmount).toHaveBeenCalledOnce();
  });

  it('should mount a React element once the library is loaded', async () => {
    const preview = createElement('a', null, 'A');
    const remove = renderInlinePreview(element, { preview, text: '' });

    await vi.waitFor(() => {
      expect(render).toHaveBeenCalledWith(preview);
    });

    remove();

    expect(unmount).toHaveBeenCalledOnce();
  });

  it('should not mount a React element removed before the library is loaded', async () => {
    const remove = renderInlinePreview(element, {
      preview: createElement('a', null, 'A'),
      text: '',
    });

    remove();
    await Promise.resolve();
    await Promise.resolve();

    expect(render).not.toHaveBeenCalled();
  });

  it('should show the text without a preview', () => {
    const remove = renderInlinePreview(element, { text: '[[<A>]]' });

    expect(element.textContent).toBe('[[<A>]]');
    expect(element.children).toHaveLength(0);

    remove();

    expect(element.textContent).toBe('');
  });
});
