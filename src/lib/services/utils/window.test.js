import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openNewTab } from './window.js';

describe('openNewTab', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { open: vi.fn(() => null) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should open the URL with opener isolation by default', () => {
    openNewTab('https://example.com');

    expect(window.open).toHaveBeenCalledWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('should allow window.opener access when noopener is false', () => {
    openNewTab('https://example.com', { noopener: false });

    expect(window.open).toHaveBeenCalledWith('https://example.com', '_blank', '');
  });

  it('should ignore empty URLs', () => {
    const result = openNewTab('');

    expect(result).toBeNull();
    expect(window.open).not.toHaveBeenCalled();
  });
});
