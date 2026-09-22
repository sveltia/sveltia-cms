// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';

import { createInertSVG } from './svg';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Wrap the given SVG source, and parse the result.
 * @param {string} source SVG source.
 * @returns {Promise<{ blob: Blob, svg: Element, image: Element }>} Wrapper blob and elements.
 */
const wrap = async (source) => {
  const blob = await createInertSVG(new Blob([source], { type: 'image/svg+xml' }));

  const { documentElement: svg } = new DOMParser().parseFromString(
    await blob.text(),
    'image/svg+xml',
  );

  return { blob, svg, image: /** @type {Element} */ (svg.firstElementChild) };
};

/**
 * Get the attributes of the given element as an object.
 * @param {Element} element Element.
 * @returns {Record<string, string>} Attributes.
 */
const getAttributes = (element) =>
  Object.fromEntries([...element.attributes].map(({ name, value }) => [name, value]));

describe('createInertSVG', () => {
  it('should embed the original as a data URL without any of its content', async () => {
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10" onload="alert(1)">' +
      '<script>alert(2)</script><rect width="20" height="10"/></svg>';

    const { blob, svg, image } = await wrap(source);
    const text = await blob.text();

    expect(blob.type).toBe('image/svg+xml');
    expect(svg.namespaceURI).toBe(SVG_NS);
    expect(svg.children).toHaveLength(1);
    expect(image.localName).toBe('image');
    expect(text).not.toContain('script');
    expect(text).not.toContain('onload');

    const href = /** @type {string} */ (image.getAttribute('href'));

    expect(href).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(
      new TextDecoder().decode(Uint8Array.from(atob(href.split(',')[1]), (c) => c.charCodeAt(0))),
    ).toBe(source);
  });

  it('should fill the viewBox of an image without a fixed size', async () => {
    const { svg, image } = await wrap(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="10, 5 30 20" ' +
        'preserveAspectRatio="xMinYMin slice"/>',
    );

    expect(getAttributes(svg)).toEqual({
      xmlns: SVG_NS,
      width: '100%',
      viewBox: '10, 5 30 20',
      preserveAspectRatio: 'xMinYMin slice',
    });
    expect(getAttributes(image)).toMatchObject({
      x: '10',
      y: '5',
      width: '30',
      height: '20',
      preserveAspectRatio: 'none',
    });
  });

  it('should only take the size of an image with a fixed width and height', async () => {
    const { svg, image } = await wrap(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30pt" viewBox="0 0 20 10" ' +
        'preserveAspectRatio="none"/>',
    );

    expect(getAttributes(svg)).toEqual({ xmlns: SVG_NS, width: '40', height: '30pt' });
    expect(getAttributes(image)).toMatchObject({ width: '100%', height: '100%' });
  });

  it.each(['', ' viewBox="0 0 10"', ' viewBox="0 0 0 10"', ' viewBox="a b c d"'])(
    'should fill the whole image when the viewBox is missing or invalid: %j',
    async (viewBox) => {
      const { image } = await wrap(`<svg xmlns="http://www.w3.org/2000/svg"${viewBox}/>`);

      expect(getAttributes(image)).toMatchObject({ width: '100%', height: '100%' });
      expect(image.hasAttribute('x')).toBe(false);
    },
  );

  it.each(['<svg><script>alert(1)</script><rect></svg>', '<html/>'])(
    'should still wrap a file that is not a valid SVG image: %s',
    async (source) => {
      const { blob, svg, image } = await wrap(source);

      expect(await blob.text()).not.toContain('<script');
      expect(getAttributes(svg)).toEqual({ xmlns: SVG_NS });
      expect(getAttributes(image)).toMatchObject({ width: '100%', height: '100%' });
    },
  );

  it('should reject when the file cannot be read', async () => {
    const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });

    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(
      /**
       * Fail to read the file.
       * @this {FileReader}
       */
      function readAsDataURL() {
        this.dispatchEvent(new Event('error'));
      },
    );

    await expect(createInertSVG(blob)).rejects.toBeDefined();
    vi.restoreAllMocks();
  });
});
