/* eslint-disable jsdoc/require-jsdoc */

import { describe, expect, it, vi } from 'vitest';

import { MEDIA_QUERY_SELECTOR, parseSrcset, resolveMediaURLs } from './media-urls.js';

describe('MEDIA_QUERY_SELECTOR', () => {
  it('should match the URL attributes of images, videos and audio not processed yet', () => {
    expect(MEDIA_QUERY_SELECTOR).toBe(
      ':is(img[src], img[srcset], source[src], source[srcset], video[src], video[poster], ' +
        'audio[src]):not([data-processed])',
    );
  });
});

describe('parseSrcset', () => {
  it('should parse URLs with and without descriptors', () => {
    expect(parseSrcset('a.jpg 1x, b.jpg 2x')).toEqual([
      { url: 'a.jpg', descriptor: '1x' },
      { url: 'b.jpg', descriptor: '2x' },
    ]);
    expect(parseSrcset('  a.jpg,, b.jpg   800w ,  ')).toEqual([
      { url: 'a.jpg', descriptor: '' },
      { url: 'b.jpg', descriptor: '800w' },
    ]);
    expect(parseSrcset('a.jpg')).toEqual([{ url: 'a.jpg', descriptor: '' }]);
    expect(parseSrcset(' , ')).toEqual([]);
  });

  it('should keep a comma within a URL', () => {
    expect(parseSrcset('data:image/png;base64,AAAA 1x, /b.png 2x')).toEqual([
      { url: 'data:image/png;base64,AAAA', descriptor: '1x' },
      { url: '/b.png', descriptor: '2x' },
    ]);
  });
});

describe('resolveMediaURLs', () => {
  /**
   * Create a minimal element.
   * @param {string} localName Tag name.
   * @param {Record<string, string>} attributes Attributes.
   * @param {any} [parentElement] Parent element.
   * @returns {any} Element.
   */
  const createElement = (localName, attributes, parentElement = null) => ({
    localName,
    parentElement,
    attributes: { ...attributes },
    getAttribute(/** @type {string} */ name) {
      return this.attributes[name] ?? null;
    },
    setAttribute(/** @type {string} */ name, /** @type {string} */ value) {
      this.attributes[name] = value;
    },
  });

  /**
   * Resolve a path to a blob URL, unless it’s missing.
   * @param {string} value Path.
   * @returns {Promise<string | undefined>} URL.
   */
  const resolve = async (value) => (value.includes('missing') ? undefined : `blob:${value}`);

  it('should resolve the URL attributes of a media element', async () => {
    const video = createElement('video', { src: '/clip.mp4', poster: '/poster.jpg', id: 'x' });

    await resolveMediaURLs(video, resolve);

    expect(video.attributes).toEqual({
      src: 'blob:/clip.mp4',
      poster: 'blob:/poster.jpg',
      id: 'x',
    });
  });

  it('should resolve each URL in a srcset, and leave what can’t be resolved', async () => {
    const img = createElement('img', {
      src: '/missing.jpg',
      srcset: '/a.jpg 1x, /missing.jpg 2x',
    });

    await resolveMediaURLs(img, resolve);

    expect(img.attributes).toEqual({
      src: '/missing.jpg',
      srcset: 'blob:/a.jpg 1x, /missing.jpg 2x',
    });

    // A srcset without a resolved URL is left as written
    const unchanged = createElement('img', { srcset: '/missing.jpg 1x,/missing.jpg 2x' });

    unchanged.setAttribute = vi.fn();
    await resolveMediaURLs(unchanged, resolve);
    expect(unchanged.setAttribute).not.toHaveBeenCalled();
  });

  it('should load the media again once a source is updated', async () => {
    const video = { localName: 'video', load: vi.fn() };
    const source = createElement('source', { src: '/clip.mp4' }, video);

    await resolveMediaURLs(source, resolve);
    expect(source.attributes.src).toBe('blob:/clip.mp4');
    expect(video.load).toHaveBeenCalledOnce();

    // Nothing to load again if the source is unchanged, or within a picture
    await resolveMediaURLs(createElement('source', { src: '/missing.mp4' }, video), resolve);
    expect(video.load).toHaveBeenCalledOnce();

    const picture = { localName: 'picture', load: vi.fn() };

    await resolveMediaURLs(createElement('source', { srcset: '/a.jpg' }, picture), resolve);
    await resolveMediaURLs(createElement('source', { srcset: '/a.jpg' }), resolve);
    expect(picture.load).not.toHaveBeenCalled();
  });

  it('should leave a URL that fails to be resolved, and resolve the others', async () => {
    const img = createElement('img', {
      src: '/broken.jpg',
      srcset: '/broken.jpg 1x, /a.jpg 2x',
    });

    await resolveMediaURLs(img, async (value) => {
      if (value === '/broken.jpg') {
        throw new Error('Failed to retrieve blob');
      }

      return `blob:${value}`;
    });

    expect(img.attributes).toEqual({
      src: '/broken.jpg',
      srcset: '/broken.jpg 1x, blob:/a.jpg 2x',
    });
  });

  it('should ignore an element without URL attributes', async () => {
    const audio = createElement('audio', {});
    const other = createElement('div', { src: '/a.jpg' });

    await resolveMediaURLs(audio, resolve);
    await resolveMediaURLs(other, resolve);
    expect(audio.attributes).toEqual({});
    expect(other.attributes).toEqual({ src: '/a.jpg' });
  });
});
