// @ts-nocheck

import { describe, expect, test, vi } from 'vitest';

import {
  buildSingleFileContent,
  getFieldComments,
  getSingleFileComments,
} from '$lib/services/contents/draft/save/content';
import { formatEntryData } from '$lib/services/contents/draft/save/entry-file';
import { serializeContent } from '$lib/services/contents/draft/save/serialize';
import { formatEntryFile } from '$lib/services/contents/file/format';

vi.mock('$lib/services/contents/draft/save/content', () => ({
  buildSingleFileContent: vi.fn(() => ({ title: 'Single' })),
  getFieldComments: vi.fn(() => ({ title: 'Field comment' })),
  getSingleFileComments: vi.fn(() => ({ 'en.title': 'Single comment' })),
}));

vi.mock('$lib/services/contents/draft/save/serialize', () => ({
  serializeContent: vi.fn(({ valueMap }) => ({ ...valueMap, serialized: true })),
}));

vi.mock('$lib/services/contents/file/format', () => ({
  formatEntryFile: vi.fn(async ({ content }) => `formatted:${JSON.stringify(content)}`),
}));

const _file = { format: 'yaml-frontmatter' };
const fields = [{ name: 'title', comment: 'Title' }];
const draft = { fields };
const config = { name: 'posts' };

const entry = {
  locales: {
    en: { slug: 'hello', path: 'en/hello.md', content: { title: 'Hello' } },
    ja: { slug: 'hello', path: 'ja/hello.md', content: { title: 'こんにちは' } },
  },
};

describe('formatEntryData()', () => {
  test('formats the whole entry when no locale is given', async () => {
    await expect(formatEntryData({ draft, config, _file, entry })).resolves.toBe(
      'formatted:{"title":"Single"}',
    );

    expect(buildSingleFileContent).toHaveBeenCalledWith({ config, entry, draft });
    expect(getSingleFileComments).toHaveBeenCalledWith({ config, fields });
    expect(formatEntryFile).toHaveBeenCalledWith({
      content: { title: 'Single' },
      _file,
      comments: { 'en.title': 'Single comment' },
    });
    expect(serializeContent).not.toHaveBeenCalled();
    expect(getFieldComments).not.toHaveBeenCalled();
  });

  test('formats the content of the given locale only', async () => {
    await expect(formatEntryData({ draft, config, _file, entry, locale: 'ja' })).resolves.toBe(
      'formatted:{"title":"こんにちは","serialized":true}',
    );

    expect(serializeContent).toHaveBeenCalledWith({
      draft,
      locale: 'ja',
      valueMap: { title: 'こんにちは' },
    });
    expect(getFieldComments).toHaveBeenCalledWith(fields);
    expect(formatEntryFile).toHaveBeenCalledWith({
      content: { title: 'こんにちは', serialized: true },
      _file,
      comments: { title: 'Field comment' },
    });
    expect(buildSingleFileContent).not.toHaveBeenCalled();
    expect(getSingleFileComments).not.toHaveBeenCalled();
  });
});
