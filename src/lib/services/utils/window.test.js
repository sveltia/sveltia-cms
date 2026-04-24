import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openNewTab } from './window.js';

describe('openNewTab', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { open: vi.fn(() => null) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should open the URL with opener isolation', () => {
    openNewTab('https://example.com');

    expect(window.open).toHaveBeenCalledWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('should ignore empty URLs', () => {
    const result = openNewTab('');

    expect(result).toBeNull();
    expect(window.open).not.toHaveBeenCalled();
  });
});
