import { describe, expect, test } from 'vitest';

import { getEntryEditorPath } from '$lib/services/contents/editor/route';

describe('getEntryEditorPath()', () => {
  test('builds the path of an entry’s editor, encoding each segment', () => {
    expect(getEntryEditorPath('posts', '2024/hello-world')).toBe(
      '/collections/posts/entries/2024/hello-world',
    );
    expect(getEntryEditorPath('_singletons', 'about')).toBe(
      '/collections/_singletons/entries/about',
    );
    expect(getEntryEditorPath('pages', '50%off #1')).toBe(
      '/collections/pages/entries/50%25off%20%231',
    );
  });
});
