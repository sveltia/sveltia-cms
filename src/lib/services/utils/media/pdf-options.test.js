import { describe, expect, it, vi } from 'vitest';

import { createLoadingOptions } from './pdf-options';

vi.mock('$lib/services/app/dependencies', () => ({
  getUnpkgURL: vi.fn((name) => `https://unpkg.com/${name}@6.4.299`),
}));

describe('createLoadingOptions', () => {
  it('points PDF.js to its worker and data files on UNPKG', () => {
    const pdfjs = /** @type {any} */ ({ GlobalWorkerOptions: { workerSrc: '' } });
    const base = 'https://unpkg.com/pdfjs-dist@6.4.299';

    expect(createLoadingOptions(pdfjs)).toEqual({
      options: {
        cMapUrl: `${base}/cmaps/`,
        iccUrl: `${base}/iccs/`,
        standardFontDataUrl: `${base}/standard_fonts/`,
        wasmUrl: `${base}/wasm/`,
      },
    });
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe(`${base}/build/pdf.worker.min.mjs`);
  });
});
