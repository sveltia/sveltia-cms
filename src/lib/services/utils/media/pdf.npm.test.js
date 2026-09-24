import { describe, expect, it } from 'vitest';

import { renderPDF } from './pdf.npm';

describe('renderPDF in the npm build', () => {
  it('rejects, as PDF thumbnails aren’t supported', async () => {
    await expect(renderPDF()).rejects.toThrow('PDF thumbnails aren’t supported in the npm build');
  });
});
