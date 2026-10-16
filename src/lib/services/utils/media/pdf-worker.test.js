import { describe, expect, it, vi } from 'vitest';

const { evaluated } = vi.hoisted(() => ({ evaluated: vi.fn() }));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs', () => {
  evaluated();

  return {};
});

describe('PDF.js module worker', () => {
  it('runs the bundled PDF.js worker', async () => {
    await import('./pdf-worker');

    expect(evaluated).toHaveBeenCalledOnce();
  });
});
