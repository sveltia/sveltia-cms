import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  detectFrontMatterFormat,
  parseEntryFile,
  parseFrontMatter,
  parseJSON,
  parseTOML,
  parseYAML,
} from '$lib/services/contents/file/parse';

// Mock external dependencies
vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFile: vi.fn(),
}));

vi.mock('$lib/services/contents/file/config', () => ({
  customFileFormatRegistry: new Map(),
  getFrontMatterDelimiters: vi.fn(),
}));

describe('Test parseJSON()', () => {
  test('parses valid JSON', () => {
    const jsonStr = '{"title": "Test Post", "published": true, "tags": ["tag1", "tag2"]}';
    const expected = { title: 'Test Post', published: true, tags: ['tag1', 'tag2'] };

    expect(parseJSON(jsonStr)).toEqual(expected);
  });

  test('parses nested JSON objects', () => {
    const jsonStr = '{"user": {"name": "John", "age": 30}, "settings": {"theme": "dark"}}';
    const expected = { user: { name: 'John', age: 30 }, settings: { theme: 'dark' } };

    expect(parseJSON(jsonStr)).toEqual(expected);
  });

  test('parses JSON arrays', () => {
    const jsonStr = '[{"id": 1, "name": "Item 1"}, {"id": 2, "name": "Item 2"}]';

    const expected = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ];

    expect(parseJSON(jsonStr)).toEqual(expected);
  });

  test('throws error for invalid JSON', () => {
    const invalidJson = '{"title": "Test Post", "published": true,}'; // trailing comma

    expect(() => parseJSON(invalidJson)).toThrow();
  });

  test('parses empty JSON object', () => {
    expect(parseJSON('{}')).toEqual({});
  });

  test('parses JSON with null values', () => {
    const jsonStr = '{"title": "Test", "content": null, "draft": false}';
    const expected = { title: 'Test', content: null, draft: false };

    expect(parseJSON(jsonStr)).toEqual(expected);
  });
});

describe('Test parseTOML()', () => {
  test('parses basic TOML', () => {
    const tomlStr = 'title = "Test Post"\npublished = true\ntags = ["tag1", "tag2"]';
    const result = parseTOML(tomlStr);

    expect(result.title).toBe('Test Post');
    expect(result.published).toBe(true);
    expect(result.tags).toEqual(['tag1', 'tag2']);
  });

  test('parses TOML with sections', () => {
    const tomlStr = `
title = "Test Post"

[author]
name = "John Doe"
email = "john@example.com"

[settings]
theme = "dark"
notifications = true
`;

    const result = parseTOML(tomlStr);

    expect(result.title).toBe('Test Post');
    expect(result.author.name).toBe('John Doe');
    expect(result.author.email).toBe('john@example.com');
    expect(result.settings.theme).toBe('dark');
    expect(result.settings.notifications).toBe(true);
  });

  test('parses TOML with dates as strings', () => {
    const tomlStr = 'created = 2023-01-01T10:00:00Z\nmodified = 2023-01-02';
    const result = parseTOML(tomlStr);

    // The parseTOML function uses toRaw to convert Date objects to strings
    expect(typeof result.created).toBe('string');
    expect(typeof result.modified).toBe('string');
  });

  test('parses TOML with arrays', () => {
    const tomlStr = 'numbers = [1, 2, 3]\nstrings = ["a", "b", "c"]';
    const result = parseTOML(tomlStr);

    expect(result.numbers).toEqual([1, 2, 3]);
    expect(result.strings).toEqual(['a', 'b', 'c']);
  });

  test('throws error for invalid TOML', () => {
    const invalidToml = 'title = "Test Post\npublished = true'; // unclosed quote

    expect(() => parseTOML(invalidToml)).toThrow();
  });
});

describe('Test parseYAML()', () => {
  test('parses basic YAML', () => {
    const yamlStr = 'title: Test Post\npublished: true\ntags:\n  - tag1\n  - tag2';
    const expected = { title: 'Test Post', published: true, tags: ['tag1', 'tag2'] };

    expect(parseYAML(yamlStr)).toEqual(expected);
  });

  test('parses nested YAML objects', () => {
    const yamlStr = `
title: Test Post
author:
  name: John Doe
  email: john@example.com
settings:
  theme: dark
  notifications: true
`;

    const result = parseYAML(yamlStr);

    expect(result.title).toBe('Test Post');
    expect(result.author.name).toBe('John Doe');
    expect(result.author.email).toBe('john@example.com');
    expect(result.settings.theme).toBe('dark');
    expect(result.settings.notifications).toBe(true);
  });

  test('parses YAML with different data types', () => {
    const yamlStr = `
string: "hello"
number: 42
float: 3.14
boolean: true
null_value: null
date: 2023-01-01
`;

    const result = parseYAML(yamlStr);

    expect(result.string).toBe('hello');
    expect(result.number).toBe(42);
    expect(result.float).toBe(3.14);
    expect(result.boolean).toBe(true);
    expect(result.null_value).toBeNull();
    expect(result.date).toBe('2023-01-01');
  });

  test('parses empty YAML', () => {
    expect(parseYAML('')).toBeNull();
  });

  test('throws error for invalid YAML', () => {
    const invalidYaml = 'title: Test Post\n  invalid: indentation';

    expect(() => parseYAML(invalidYaml)).toThrow();
  });
});

describe('Test detectFrontMatterFormat()', () => {
  test('detects TOML front matter', () => {
    const text = '+++\ntitle = "Test Post"\n+++\n\nContent here';

    expect(detectFrontMatterFormat(text)).toBe('toml-frontmatter');
  });

  test('detects JSON front matter', () => {
    const text = '{\n  "title": "Test Post"\n}\n\nContent here';

    expect(detectFrontMatterFormat(text)).toBe('json-frontmatter');
  });

  test('detects YAML front matter as default', () => {
    const text = '---\ntitle: Test Post\n---\n\nContent here';

    expect(detectFrontMatterFormat(text)).toBe('yaml-frontmatter');
  });

  test('defaults to YAML for unknown format', () => {
    const text = 'Just some plain text without front matter';

    expect(detectFrontMatterFormat(text)).toBe('yaml-frontmatter');
  });

  test('detects TOML even with additional content', () => {
    const text = '+++\ntitle = "Test"\nauthor = "John"\n+++\n\n# Main Content\n\nSome text here';

    expect(detectFrontMatterFormat(text)).toBe('toml-frontmatter');
  });

  test('detects JSON even with complex structure', () => {
    const text = '{\n  "title": "Test",\n  "meta": {\n    "author": "John"\n  }\n}\n\nContent';

    expect(detectFrontMatterFormat(text)).toBe('json-frontmatter');
  });
});

describe('Test parseFrontMatter()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('parses YAML front matter', async () => {
    const { getFrontMatterDelimiters } = await import('$lib/services/contents/file/config');

    /** @type {any} */ (getFrontMatterDelimiters).mockReturnValue(['---', '---']);

    const mockCollection = /** @type {any} */ ({
      name: 'test-collection',
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['---', '---'],
      },
    });

    const mockCollectionFile = /** @type {any} */ ({
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['---', '---'],
      },
    });

    const text = '---\ntitle: Test Post\npublished: true\n---\n\nThis is the content body.';

    const result = parseFrontMatter({
      collection: mockCollection,
      collectionFile: mockCollectionFile,
      format: 'yaml-frontmatter',
      text,
    });

    expect(result.title).toBe('Test Post');
    expect(result.published).toBe(true);
    expect(result.body).toBe('\nThis is the content body.');
  });

  test('parses TOML front matter', async () => {
    const { getFrontMatterDelimiters } = await import('$lib/services/contents/file/config');

    /** @type {any} */ (getFrontMatterDelimiters).mockReturnValue(['+++', '+++']);

    const mockCollection = /** @type {any} */ ({
      name: 'test-collection',
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['+++', '+++'],
      },
    });

    const mockCollectionFile = /** @type {any} */ ({
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['+++', '+++'],
      },
    });

    const text = '+++\ntitle = "Test Post"\npublished = true\n+++\n\nThis is the content body.';

    const result = parseFrontMatter({
      collection: mockCollection,
      collectionFile: mockCollectionFile,
      format: 'toml-frontmatter',
      text,
    });

    expect(result.title).toBe('Test Post');
    expect(result.published).toBe(true);
    expect(result.body).toBe('\nThis is the content body.');
  });

  test('parses JSON front matter', async () => {
    const { getFrontMatterDelimiters } = await import('$lib/services/contents/file/config');

    /** @type {any} */ (getFrontMatterDelimiters).mockReturnValue(['{', '}']);

    const mockCollection = /** @type {any} */ ({
      name: 'test-collection',
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['{', '}'],
      },
    });

    const mockCollectionFile = /** @type {any} */ ({
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['{', '}'],
      },
    });

    // This should match the format that the implementation expects
    const text = '{\n  "title": "Test Post",\n  "published": true\n}\n\nThis is the content body.';

    const result = parseFrontMatter({
      collection: mockCollection,
      collectionFile: mockCollectionFile,
      format: 'json-frontmatter',
      text,
    });

    expect(result.title).toBe('Test Post');
    expect(result.published).toBe(true);
    expect(result.body).toBe('\nThis is the content body.');
  });

  test('handles content without front matter', async () => {
    const { getFrontMatterDelimiters } = await import('$lib/services/contents/file/config');

    /** @type {any} */ (getFrontMatterDelimiters).mockReturnValue(['---', '---']);

    const mockCollection = /** @type {any} */ ({
      name: 'test-collection',
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['---', '---'],
      },
    });

    const mockCollectionFile = /** @type {any} */ ({
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['---', '---'],
      },
    });

    const text = 'This is just plain content without front matter.';

    const result = parseFrontMatter({
      collection: mockCollection,
      collectionFile: mockCollectionFile,
      format: 'yaml-frontmatter',
      text,
    });

    expect(result.body).toBe('This is just plain content without front matter.');
    expect(Object.keys(result)).toEqual(['body']);
  });

  test('handles empty front matter', async () => {
    const { getFrontMatterDelimiters } = await import('$lib/services/contents/file/config');

    /** @type {any} */ (getFrontMatterDelimiters).mockReturnValue(['---', '---']);

    const mockCollection = /** @type {any} */ ({
      name: 'test-collection',
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['---', '---'],
      },
    });

    const mockCollectionFile = /** @type {any} */ ({
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['---', '---'],
      },
    });

    const text = '---\n\n---\n\nContent without front matter data.';

    const result = parseFrontMatter({
      collection: mockCollection,
      collectionFile: mockCollectionFile,
      format: 'yaml-frontmatter',
      text,
    });

    expect(result.body).toBe('\nContent without front matter data.');
  });

  test('handles content with only front matter', async () => {
    const { getFrontMatterDelimiters } = await import('$lib/services/contents/file/config');

    /** @type {any} */ (getFrontMatterDelimiters).mockReturnValue(['---', '---']);

    const mockCollection = /** @type {any} */ ({
      name: 'test-collection',
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['---', '---'],
      },
    });

    const mockCollectionFile = /** @type {any} */ ({
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['---', '---'],
      },
    });

    const text = '---\ntitle: Test Post\npublished: true\n---';

    const result = parseFrontMatter({
      collection: mockCollection,
      collectionFile: mockCollectionFile,
      format: 'yaml-frontmatter',
      text,
    });

    expect(result.title).toBe('Test Post');
    expect(result.published).toBe(true);
    expect(result.body).toBeUndefined();
  });

  test('handles custom delimiters', async () => {
    const { getFrontMatterDelimiters } = await import('$lib/services/contents/file/config');

    /** @type {any} */ (getFrontMatterDelimiters).mockReturnValue(['===', '===']);

    const mockCollection = /** @type {any} */ ({
      name: 'test-collection',
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['===', '==='],
      },
    });

    const mockCollectionFile = /** @type {any} */ ({
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['===', '==='],
      },
    });

    const text = '===\ntitle: Custom Delimiters\n===\n\nContent body.';

    const result = parseFrontMatter({
      collection: mockCollection,
      collectionFile: mockCollectionFile,
      format: 'yaml-frontmatter',
      text,
    });

    expect(result.title).toBe('Custom Delimiters');
    expect(result.body).toBe('\nContent body.');
  });

  test('works with collection only (no collectionFile)', async () => {
    const { getFrontMatterDelimiters } = await import('$lib/services/contents/file/config');

    /** @type {any} */ (getFrontMatterDelimiters).mockReturnValue(['---', '---']);

    const mockCollection = /** @type {any} */ ({
      name: 'test-collection',
      _file: {
        format: 'frontmatter',
        fmDelimiters: ['---', '---'],
      },
    });

    const text = '---\ntitle: Collection Only\n---\n\nContent.';

    const result = parseFrontMatter({
      collection: mockCollection,
      format: 'yaml-frontmatter',
      text,
    });

    expect(result.title).toBe('Collection Only');
    expect(result.body).toBe('\nContent.');
  });
});

describe('Test parseEntryFile()', () => {
  /** @type {any} */
  let getCollection;
  /** @type {any} */
  let getCollectionFile;
  /** @type {any} */
  let customFileFormatRegistry;

  const mockCollection = {
    _file: {
      format: 'yaml',
    },
  };

  const entryBase = {
    text: '',
    path: '/test/file.md',
    folder: {
      collectionName: 'posts',
      fileName: 'test-file',
    },
    // Add required properties for BaseEntryListItem
    name: 'test-file.md',
    sha: 'abc123',
    size: 1024,
    type: /** @type {'entry'} */ ('entry'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const collectionModule = await import('$lib/services/contents/collection');
    const collectionFileModule = await import('$lib/services/contents/collection/files');
    const fileModule = await import('$lib/services/contents/file/config');

    getCollection = collectionModule.getCollection;
    getCollectionFile = collectionFileModule.getCollectionFile;
    customFileFormatRegistry = fileModule.customFileFormatRegistry;
  });

  test('parses YAML format', async () => {
    getCollection.mockReturnValue({
      _file: { format: 'yaml' },
    });
    getCollectionFile.mockReturnValue({
      _file: { format: 'yaml' },
    });

    const entry = {
      ...entryBase,
      text: 'title: Test Post\npublished: true\ntags:\n  - tag1\n  - tag2',
    };

    const result = await parseEntryFile(entry);

    expect(result.title).toBe('Test Post');
    expect(result.published).toBe(true);
    expect(result.tags).toEqual(['tag1', 'tag2']);
  });

  test('parses TOML format', async () => {
    getCollection.mockReturnValue({
      _file: { format: 'toml' },
    });
    getCollectionFile.mockReturnValue({
      _file: { format: 'toml' },
    });

    const entry = {
      ...entryBase,
      text: 'title = "Test Post"\npublished = true\ntags = ["tag1", "tag2"]',
    };

    const result = await parseEntryFile(entry);

    expect(result.title).toBe('Test Post');
    expect(result.published).toBe(true);
    expect(result.tags).toEqual(['tag1', 'tag2']);
  });

  test('parses JSON format', async () => {
    getCollection.mockReturnValue({
      _file: { format: 'json' },
    });
    getCollectionFile.mockReturnValue({
      _file: { format: 'json' },
    });

    const entry = {
      ...entryBase,
      text: '{"title": "Test Post", "published": true, "tags": ["tag1", "tag2"]}',
    };

    const result = await parseEntryFile(entry);

    expect(result.title).toBe('Test Post');
    expect(result.published).toBe(true);
    expect(result.tags).toEqual(['tag1', 'tag2']);
  });

  test('parses front matter format with auto-detection', async () => {
    getCollection.mockReturnValue({
      _file: { format: 'frontmatter' },
    });
    getCollectionFile.mockReturnValue({
      _file: { format: 'frontmatter', fmDelimiters: ['---', '---'] },
    });

    const entry = {
      ...entryBase,
      text: '---\ntitle: Test Post\npublished: true\n---\n\nThis is the content.',
    };

    const result = await parseEntryFile(entry);

    expect(result.title).toBe('Test Post');
    expect(result.published).toBe(true);
    expect(result.body).toBe('\nThis is the content.');
  });

  test('handles yml format alias', async () => {
    getCollection.mockReturnValue({
      _file: { format: 'yml' },
    });
    getCollectionFile.mockReturnValue({
      _file: { format: 'yml' },
    });

    const entry = {
      ...entryBase,
      text: 'title: Test Post\npublished: true',
    };

    const result = await parseEntryFile(entry);

    expect(result.title).toBe('Test Post');
    expect(result.published).toBe(true);
  });

  test('uses custom parser when available', async () => {
    const customParser = vi.fn().mockReturnValue({ custom: 'result' });

    customFileFormatRegistry.set('customFormat', { parser: customParser });

    getCollection.mockReturnValue({
      _file: { format: 'customFormat' },
    });
    getCollectionFile.mockReturnValue({
      _file: { format: 'customFormat' },
    });

    const entry = {
      ...entryBase,
      text: 'custom content',
    };

    const result = await parseEntryFile(entry);

    expect(customParser).toHaveBeenCalledWith('custom content');
    expect(result).toEqual({ custom: 'result' });
  });

  test('normalizes line breaks', async () => {
    getCollection.mockReturnValue({
      _file: { format: 'yaml' },
    });
    getCollectionFile.mockReturnValue({
      _file: { format: 'yaml' },
    });

    const entry = {
      ...entryBase,
      text: 'title: Test Post\r\npublished: true\r\n',
    };

    const result = await parseEntryFile(entry);

    expect(result.title).toBe('Test Post');
    expect(result.published).toBe(true);
  });

  test('trims whitespace', async () => {
    getCollection.mockReturnValue({
      _file: { format: 'yaml' },
    });
    getCollectionFile.mockReturnValue({
      _file: { format: 'yaml' },
    });

    const entry = {
      ...entryBase,
      text: '   \ntitle: Test Post\npublished: true\n  \n  ',
    };

    const result = await parseEntryFile(entry);

    expect(result.title).toBe('Test Post');
    expect(result.published).toBe(true);
  });

  test('throws error when collection not found', async () => {
    getCollection.mockReturnValue(null);

    const entry = {
      ...entryBase,
      text: 'title: Test Post',
    };

    await expect(parseEntryFile(entry)).rejects.toThrow('Collection not found');
  });

  test('throws error when collection file not found', async () => {
    getCollection.mockReturnValue(mockCollection);
    getCollectionFile.mockReturnValue(null);

    const entry = {
      ...entryBase,
      text: 'title: Test Post',
    };

    await expect(parseEntryFile(entry)).rejects.toThrow('Collection file not found');
  });

  test('works without collection file when no fileName provided', async () => {
    getCollection.mockReturnValue({
      _file: { format: 'yaml' },
    });

    const entry = {
      ...entryBase,
      text: 'title: Test Post\npublished: true',
      folder: {
        collectionName: 'posts',
        fileName: undefined,
      },
    };

    const result = await parseEntryFile(entry);

    expect(result.title).toBe('Test Post');
    expect(result.published).toBe(true);
  });

  test('throws error for parsing failures', async () => {
    getCollection.mockReturnValue({
      _file: { format: 'json' },
    });
    getCollectionFile.mockReturnValue({
      _file: { format: 'json' },
    });

    const entry = {
      ...entryBase,
      text: '{"title": "Test Post", "published": true,}', // invalid JSON
    };

    await expect(parseEntryFile(entry)).rejects.toThrow(/could not be parsed due to/);
  });

  test('throws error for unknown format', async () => {
    getCollection.mockReturnValue({
      _file: { format: 'unknown-format' },
    });
    getCollectionFile.mockReturnValue({
      _file: { format: 'unknown-format' },
    });

    const entry = {
      ...entryBase,
      text: 'some content',
    };

    await expect(parseEntryFile(entry)).rejects.toThrow(
      /could not be parsed due to an unknown format/,
    );
  });
});
