import { describe, expect, test, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';
import {
  formatEntryFile,
  formatFrontMatter,
  formatJSON,
  formatTOML,
  formatYAML,
} from '$lib/services/contents/file/format';

/**
 * @import { FileConfig } from '$lib/types/private';
 */

// Mock the cmsConfig store
vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));

// Mock custom file formats
vi.mock('$lib/services/contents/file/config', () => ({
  customFileFormatRegistry: new Map(),
}));

const object = {
  title: 'My Post',
  published: true,
  options: [1, 2, 3],
  image: { alt: 'flower', src: 'flower.jpg' },
};

describe('Test formatJSON()', () => {
  test('no options', () => {
    expect(formatJSON(object)).toBe(
      `
      {
  "title": "My Post",
  "published": true,
  "options": [
    1,
    2,
    3
  ],
  "image": {
    "alt": "flower",
    "src": "flower.jpg"
  }
}
`.trim(),
    );
  });

  test('space', () => {
    expect(formatJSON(object, { indent_style: 'space', indent_size: 4 })).toBe(
      `
{
    "title": "My Post",
    "published": true,
    "options": [
        1,
        2,
        3
    ],
    "image": {
        "alt": "flower",
        "src": "flower.jpg"
    }
}
`.trim(),
    );
  });

  test('tab', () => {
    expect(formatJSON(object, { indent_style: 'tab' })).toBe(
      `
{
\t"title": "My Post",
\t"published": true,
\t"options": [
\t\t1,
\t\t2,
\t\t3
\t],
\t"image": {
\t\t"alt": "flower",
\t\t"src": "flower.jpg"
\t}
}
`.trim(),
    );
  });

  test('tab with custom indent_size', () => {
    expect(formatJSON(object, { indent_style: 'tab', indent_size: 2 })).toBe(
      `
{
\t\t"title": "My Post",
\t\t"published": true,
\t\t"options": [
\t\t\t\t1,
\t\t\t\t2,
\t\t\t\t3
\t\t],
\t\t"image": {
\t\t\t\t"alt": "flower",
\t\t\t\t"src": "flower.jpg"
\t\t}
}
`.trim(),
    );
  });
});

describe('Test formatTOML()', () => {
  test('no options', () => {
    expect(formatTOML(object)).toBe(
      `
title = "My Post"
published = true
options = [ 1, 2, 3 ]

[image]
alt = "flower"
src = "flower.jpg"
`.trim(),
    );
  });
});

describe('Test formatYAML()', () => {
  test('no options', () => {
    expect(formatYAML(object)).toBe(
      `
title: My Post
published: true
options:
  - 1
  - 2
  - 3
image:
  alt: flower
  src: flower.jpg
`.trim(),
    );
  });

  test('space', () => {
    expect(formatYAML(object, { indent_size: 4 })).toBe(
      `
title: My Post
published: true
options:
    - 1
    - 2
    - 3
image:
    alt: flower
    src: flower.jpg
`.trim(),
    );
  });

  test('quote', () => {
    expect(formatYAML(object, { quote: 'none' })).toBe(
      `
title: My Post
published: true
options:
  - 1
  - 2
  - 3
image:
  alt: flower
  src: flower.jpg
`.trim(),
    );
    expect(formatYAML(object, { quote: 'single' })).toBe(
      `
title: 'My Post'
published: true
options:
  - 1
  - 2
  - 3
image:
  alt: 'flower'
  src: 'flower.jpg'
`.trim(),
    );
    expect(formatYAML(object, { quote: 'double' })).toBe(
      `
title: "My Post"
published: true
options:
  - 1
  - 2
  - 3
image:
  alt: "flower"
  src: "flower.jpg"
`.trim(),
    );
  });

  test('indent_sequences', () => {
    expect(formatYAML(object, { indent_sequences: true })).toBe(
      `
title: My Post
published: true
options:
  - 1
  - 2
  - 3
image:
  alt: flower
  src: flower.jpg
`.trim(),
    );
    expect(formatYAML(object, { indent_sequences: false })).toBe(
      `
title: My Post
published: true
options:
- 1
- 2
- 3
image:
  alt: flower
  src: flower.jpg
`.trim(),
    );
  });

  test('legacyQuote parameter', () => {
    expect(formatYAML(object, {}, { quote: true })).toBe(
      `
title: "My Post"
published: true
options:
  - 1
  - 2
  - 3
image:
  alt: "flower"
  src: "flower.jpg"
`.trim(),
    );
  });

  test('legacyQuote false with single quote (line 53)', () => {
    // Test when legacyQuote is false (default) but quote is 'single'
    // This exercises the branch at line 53 with legacyQuote false
    expect(formatYAML(object, { quote: 'single' }, {})).toBe(
      `
title: 'My Post'
published: true
options:
  - 1
  - 2
  - 3
image:
  alt: 'flower'
  src: 'flower.jpg'
`.trim(),
    );
  });

  test('uses empty legacyOptions when not provided (line 53)', () => {
    // Mock get to return undefined for output.yaml to test the ?? {} fallback on line 52
    cmsConfig.current = /** @type {any} */ ({ output: { yaml: undefined } });

    const result = formatYAML(object);

    // When options is {}, all defaults apply
    // legacyOptions defaults to {}
    // This tests the ?? {} operator on line 52
    expect(result).toBe(
      `
title: My Post
published: true
options:
  - 1
  - 2
  - 3
image:
  alt: flower
  src: flower.jpg
`.trim(),
    );
  });

  test('tab with indent_size defaults to 1 (lines 20-23)', () => {
    // Test formatJSON with tab style and no explicit indent_size
    // This tests line 21 where indent_size defaults to 1 when indent_style is 'tab'
    // and line 23 where '\t'.repeat(1) produces a single tab
    expect(formatJSON(object, { indent_style: 'tab', indent_size: 1 })).toBe(
      `
{
\t"title": "My Post",
\t"published": true,
\t"options": [
\t\t1,
\t\t2,
\t\t3
\t],
\t"image": {
\t\t"alt": "flower",
\t\t"src": "flower.jpg"
\t}
}
`.trim(),
    );
  });

  test('uses empty options when cmsConfig.output.json is undefined (line 20)', () => {
    // Mock get to return undefined for output.json to test the ?? {} fallback
    cmsConfig.current = /** @type {any} */ ({ output: { json: undefined } });

    const result = formatJSON(object);

    // When options is {}, indent_style defaults to 'space' and indent_size to 2
    // This tests the ?? {} operator on line 20
    expect(result).toBe(
      `
{
  "title": "My Post",
  "published": true,
  "options": [
    1,
    2,
    3
  ],
  "image": {
    "alt": "flower",
    "src": "flower.jpg"
  }
}
`.trim(),
    );
  });
});

describe('Test formatYAML() with comments', () => {
  test('writes a comment before a top-level key, including the first one', () => {
    expect(formatYAML({ title: 'Hello', draft: false }, {}, {}, { title: 'Title' })).toBe(
      '# Title\ntitle: Hello\ndraft: false',
    );
  });

  test('writes a comment before a key nested in a map', () => {
    expect(
      formatYAML(
        { image: { src: 'a.jpg', alt: 'A' } },
        {},
        {},
        {
          image: 'Image',
          'image.alt': 'Alt text',
        },
      ),
    ).toBe('# Image\nimage:\n  src: a.jpg\n  # Alt text\n  alt: A');
  });

  test('splits a comment on an escaped or a real line break', () => {
    // Netlify/Decap CMS documents `comment: 'line 1\nline 2'`, where YAML keeps the `\n` as is
    expect(formatYAML({ a: 'a' }, {}, {}, { a: 'line 1\\nline 2\nline 3' })).toBe(
      '# line 1\n# line 2\n# line 3\na: a',
    );
  });

  test('leaves the items of a sequence alone', () => {
    expect(
      formatYAML(
        { links: [{ url: 'https://example.com' }] },
        {},
        {},
        {
          links: 'Links',
          'links.url': 'URL',
        },
      ),
    ).toBe('# Links\nlinks:\n  - url: https://example.com');
  });

  test('ignores a comment for a key that is not there', () => {
    expect(formatYAML({ title: 'Hello' }, {}, {}, { body: 'Body' })).toBe('title: Hello');
  });

  test('ignores the comments when the document is not a map', () => {
    expect(formatYAML(/** @type {any} */ (['a', 'b']), {}, {}, { 0: 'First' })).toBe('- a\n- b');
  });
});

describe('Test formatFrontMatter()', () => {
  const baseContent = {
    title: 'My Post',
    published: true,
    tags: ['test', 'vitest'],
    body: 'This is the body content of the post.',
  };

  test('YAML frontmatter (default)', () => {
    const content = { ...baseContent };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: 'frontmatter', extension: '.md' };
    const result = formatFrontMatter({ content, _file });

    expect(result).toBe(
      `---
title: My Post
published: true
tags:
  - test
  - vitest
---

This is the body content of the post.
`,
    );
  });

  test('YAML frontmatter with explicit format', () => {
    const content = { ...baseContent };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: 'yaml-frontmatter', extension: '.md' };
    const result = formatFrontMatter({ content, _file });

    expect(result).toBe(
      `---
title: My Post
published: true
tags:
  - test
  - vitest
---

This is the body content of the post.
`,
    );
  });

  test('YAML frontmatter with custom delimiters', () => {
    const content = { ...baseContent };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: 'frontmatter', extension: '.md', fmDelimiters: ['+++', '+++'] };
    const result = formatFrontMatter({ content, _file });

    expect(result).toBe(
      `+++
title: My Post
published: true
tags:
  - test
  - vitest
+++

This is the body content of the post.
`,
    );
  });

  test('YAML frontmatter with yamlQuote option', () => {
    const content = { ...baseContent };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: 'frontmatter', extension: '.md', yamlQuote: true };
    const result = formatFrontMatter({ content, _file });

    expect(result).toBe(
      `---
title: "My Post"
published: true
tags:
  - "test"
  - "vitest"
---

This is the body content of the post.
`,
    );
  });

  test('TOML frontmatter', () => {
    const content = { ...baseContent };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: 'toml-frontmatter', extension: '.md' };
    const result = formatFrontMatter({ content, _file });

    expect(result).toBe(
      `---
title = "My Post"
published = true
tags = [ "test", "vitest" ]
---

This is the body content of the post.
`,
    );
  });

  test('TOML frontmatter with custom delimiters', () => {
    const content = { ...baseContent };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: 'toml-frontmatter', extension: '.md', fmDelimiters: ['+++', '+++'] };
    const result = formatFrontMatter({ content, _file });

    expect(result).toBe(
      `+++
title = "My Post"
published = true
tags = [ "test", "vitest" ]
+++

This is the body content of the post.
`,
    );
  });

  test('JSON frontmatter', () => {
    const content = { ...baseContent };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: 'json-frontmatter', extension: '.md' };
    const result = formatFrontMatter({ content, _file });

    expect(result).toBe(
      `---
{
  "title": "My Post",
  "published": true,
  "tags": [
    "test",
    "vitest"
  ]
}
---

This is the body content of the post.
`,
    );
  });

  test('JSON frontmatter with custom delimiters', () => {
    const content = { ...baseContent };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: 'json-frontmatter', extension: '.md', fmDelimiters: ['{', '}'] };
    const result = formatFrontMatter({ content, _file });

    // The outer braces of the object double as the delimiters, like Netlify/Decap CMS
    expect(result).toBe(
      `{
  "title": "My Post",
  "published": true,
  "tags": [
    "test",
    "vitest"
  ]
}

This is the body content of the post.
`,
    );
  });

  test('empty content without frontmatter', () => {
    const content = { body: 'Just body content without frontmatter.' };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: 'frontmatter', extension: '.md' };
    const result = formatFrontMatter({ content, _file });

    expect(result).toBe('Just body content without frontmatter.\n');
  });

  test('content without body', () => {
    const content = { title: 'My Post', published: true };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: 'frontmatter', extension: '.md' };
    const result = formatFrontMatter({ content, _file });

    expect(result).toBe(
      `---
title: My Post
published: true
---
`,
    );
  });

  test('non-string body content', () => {
    const content = { title: 'My Post', body: null };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: 'frontmatter', extension: '.md' };
    const result = formatFrontMatter({ content, _file });

    expect(result).toBe(
      `---
title: My Post
---
`,
    );
  });

  test('invalid format throws rather than returning an empty string', () => {
    const content = { ...baseContent };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: /** @type {any} */ ('invalid-format'), extension: '.md' };

    expect(() => formatFrontMatter({ content, _file })).toThrow(
      'Unsupported front matter format: invalid-format',
    );
  });

  test('body property is removed from content object', () => {
    const content = { ...baseContent };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: 'frontmatter', extension: '.md' };

    formatFrontMatter({ content, _file });

    expect(content).not.toHaveProperty('body');
    expect(content).toEqual({
      title: 'My Post',
      published: true,
      tags: ['test', 'vitest'],
    });
  });

  test('formatting error in formatFrontMatter with json-frontmatter is thrown', () => {
    // Create a mock _file object that would trigger an error during formatting
    const _file = /** @type {any} */ ({
      format: 'json-frontmatter',
      extension: '.md',
      fmDelimiters: ['---', '---'], // Valid delimiters
    });

    // Mock the content with a circular reference to trigger an error in formatJSON
    const circularObj = /** @type {any} */ ({ title: 'Test' });

    circularObj.self = circularObj; // Create circular reference

    // An empty string would be written as the file, wiping its content
    expect(() => formatFrontMatter({ content: circularObj, _file })).toThrow(TypeError);
  });
});

describe('Test formatEntryFile()', () => {
  test('formats YAML content', async () => {
    const content = {
      title: 'Test Post',
      published: true,
      tags: ['tag1', 'tag2'],
    };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('yaml'),
      extension: 'yml',
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });

    expect(result).toContain('title: Test Post');
    expect(result).toContain('published: true');
    expect(result).toContain('- tag1');
    expect(result).toContain('- tag2');
    expect(result.endsWith('\n')).toBe(true);
  });

  test('formats YAML content with quote option', async () => {
    const content = {
      title: 'Test Post',
      published: true,
    };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('yaml'),
      extension: 'yml',
      yamlQuote: true,
    });

    const result = await formatEntryFile({ content, _file });

    expect(result).toContain('title: "Test Post"');
    expect(result).toContain('published: true');
  });

  test('formats TOML content', async () => {
    const content = {
      title: 'Test Post',
      published: true,
      tags: ['tag1', 'tag2'],
    };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('toml'),
      extension: 'toml',
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });

    expect(result).toContain('title = "Test Post"');
    expect(result).toContain('published = true');
    expect(result).toContain('tags = [ "tag1", "tag2" ]');
    expect(result.endsWith('\n')).toBe(true);
  });

  test('formats JSON content', async () => {
    const content = {
      title: 'Test Post',
      published: true,
      tags: ['tag1', 'tag2'],
    };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('json'),
      extension: 'json',
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });
    const parsed = JSON.parse(result.trim());

    expect(parsed.title).toBe('Test Post');
    expect(parsed.published).toBe(true);
    expect(parsed.tags).toEqual(['tag1', 'tag2']);
    expect(result.endsWith('\n')).toBe(true);
  });

  test('formats yml format as YAML', async () => {
    const content = { title: 'Test Post' };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('yml'),
      extension: 'yml',
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });

    expect(result).toContain('title: Test Post');
  });

  test('formats frontmatter content', async () => {
    const content = {
      title: 'Test Post',
      published: true,
      body: 'This is the body content.',
    };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('frontmatter'),
      extension: 'md',
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });

    expect(result).toContain('---');
    expect(result).toContain('title: Test Post');
    expect(result).toContain('published: true');
    expect(result).toContain('This is the body content.');
  });

  test('formats yaml-frontmatter content', async () => {
    const content = {
      title: 'Test Post',
      body: 'This is the body content.',
    };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('yaml-frontmatter'),
      extension: 'md',
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });

    expect(result).toContain('---');
    expect(result).toContain('title: Test Post');
    expect(result).toContain('This is the body content.');
  });

  test('formats toml-frontmatter content', async () => {
    const content = {
      title: 'Test Post',
      body: 'This is the body content.',
    };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('toml-frontmatter'),
      extension: 'md',
      fmDelimiters: ['+++', '+++'],
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });

    expect(result).toContain('+++');
    expect(result).toContain('title = "Test Post"');
    expect(result).toContain('This is the body content.');
  });

  test('formats json-frontmatter content', async () => {
    const content = {
      title: 'Test Post',
      body: 'This is the body content.',
    };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('json-frontmatter'),
      extension: 'md',
      fmDelimiters: ['{', '}'],
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });

    expect(result).toBe('{\n  "title": "Test Post"\n}\n\nThis is the body content.\n');
    expect(result).toContain('This is the body content.');
  });

  test('uses custom formatter when available', async () => {
    const customFormatter = vi.fn().mockResolvedValue('custom formatted content');
    // Mock the custom file formats
    const { customFileFormatRegistry } = await import('$lib/services/api/registries');

    customFileFormatRegistry.set('customFormat', {
      formatter: customFormatter,
      extension: 'custom',
    });

    const content = { title: 'Test' };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('customFormat'),
      extension: 'custom',
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });

    expect(customFormatter).toHaveBeenCalledWith(content);
    expect(result).toBe('custom formatted content\n');

    // Clean up
    customFileFormatRegistry.delete('customFormat');
  });

  test('throws on a formatting error rather than returning an empty string', async () => {
    // Create content that will cause JSON.stringify to fail
    const circularRef = {};

    circularRef.self = circularRef;

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('json'),
      extension: 'json',
      yamlQuote: false,
    });

    const promise = formatEntryFile({ content: circularRef, _file });

    await expect(promise).rejects.toThrow(
      /^The entry could not be formatted due to TypeError: Converting circular structure/,
    );
    await expect(promise).rejects.toHaveProperty('cause', expect.any(TypeError));
  });

  test('throws on a front matter formatting error', async () => {
    const circularRef = /** @type {any} */ ({ title: 'Test' });

    circularRef.self = circularRef;

    const _file = /** @type {FileConfig} */ ({ format: 'json-frontmatter', extension: 'md' });

    await expect(formatEntryFile({ content: circularRef, _file })).rejects.toThrow(
      /^The entry could not be formatted due to TypeError/,
    );
  });

  test('throws for unknown format rather than returning an empty string', async () => {
    const content = { title: 'Test' };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('unknown-format'),
      extension: 'txt',
      yamlQuote: false,
    });

    await expect(formatEntryFile({ content, _file })).rejects.toThrow(
      'Entries in the unknown “unknown-format” format can’t be saved',
    );
  });

  test('throws for a custom format registered without a formatter', async () => {
    const { customFileFormatRegistry } = await import('$lib/services/api/registries');

    customFileFormatRegistry.set('csv', { parser: vi.fn(), extension: 'csv' });

    const _file = /** @type {FileConfig} */ ({ format: 'csv', extension: 'csv' });

    try {
      await expect(formatEntryFile({ content: { title: 'Test' }, _file })).rejects.toThrow(
        'Entries in the custom “csv” format can’t be saved, as no `toFile` method was registered ' +
          'for it with `CMS.registerCustomFormat()`',
      );
    } finally {
      customFileFormatRegistry.delete('csv');
    }
  });

  test('uses the built-in formatter for a custom format with a built-in name', async () => {
    const { customFileFormatRegistry } = await import('$lib/services/api/registries');

    customFileFormatRegistry.set('json', { parser: vi.fn(), extension: 'json' });

    const _file = /** @type {FileConfig} */ ({ format: 'json', extension: 'json' });

    try {
      expect(await formatEntryFile({ content: { title: 'Test' }, _file })).toBe(
        '{\n  "title": "Test"\n}\n',
      );
    } finally {
      customFileFormatRegistry.delete('json');
    }
  });

  test('throws when a custom formatter does not return a string', async () => {
    const { customFileFormatRegistry } = await import('$lib/services/api/registries');

    customFileFormatRegistry.set('custom', {
      // A formatter written in plain JavaScript can return anything
      formatter: /** @type {any} */ (vi.fn()),
      extension: 'txt',
    });

    const _file = /** @type {FileConfig} */ ({ format: 'custom', extension: 'txt' });

    try {
      await expect(formatEntryFile({ content: { title: 'Test' }, _file })).rejects.toThrow(
        'The `toFile` method registered for the custom “custom” format must return a string',
      );
    } finally {
      customFileFormatRegistry.delete('custom');
    }
  });

  test('handles content without body property in frontmatter', async () => {
    const content = {
      title: 'Test Post',
      published: true,
    };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('frontmatter'),
      extension: 'md',
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });

    expect(result).toContain('---');
    expect(result).toContain('title: Test Post');
    expect(result).toContain('published: true');
    // Should still have proper frontmatter structure even without body
  });

  test('modifies original content object (removes body)', async () => {
    const content = {
      title: 'Test Post',
      body: 'This is the body.',
    };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('frontmatter'),
      extension: 'md',
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    await formatEntryFile({ content, _file });

    // The body property should be removed from the original object
    expect(content).not.toHaveProperty('body');
    expect(content.title).toBe('Test Post');
  });

  test('formats raw content with string body', async () => {
    const content = {
      body: 'This is raw content without any formatting.',
    };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('raw'),
      extension: 'txt',
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });

    expect(result).toBe('This is raw content without any formatting.\n');
  });

  test('formats raw content without body property', async () => {
    const content = {
      title: 'Test Post',
    };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('raw'),
      extension: 'txt',
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });

    expect(result).toBe('');
  });

  test('formats raw content with non-string body', async () => {
    const content = {
      body: null,
    };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('raw'),
      extension: 'txt',
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });

    expect(result).toBe('');
  });

  test('formats frontmatter with inline body (bodyField.inline = true)', async () => {
    const content = {
      title: 'Test Post',
      body: 'This should stay in frontmatter.',
    };

    const _file = /** @type {FileConfig} */ ({
      format: 'frontmatter',
      extension: 'md',
      yamlQuote: false,
      bodyField: { key: 'body', inline: true },
    });

    const result = formatFrontMatter({ content, _file });

    // Body should be in the frontmatter, not as separate content
    expect(result).toBe(
      `---
title: Test Post
body: This should stay in frontmatter.
---
`,
    );
  });

  test('formats frontmatter with custom body key and inline=false', async () => {
    const content = {
      title: 'Test Post',
      content: 'This should be separate content.',
    };

    const _file = /** @type {FileConfig} */ ({
      format: 'frontmatter',
      extension: 'md',
      yamlQuote: false,
      bodyField: { key: 'content', inline: false },
    });

    const result = formatFrontMatter({ content, _file });

    // Content field should be extracted and placed after frontmatter
    expect(result).toBe(
      `---
title: Test Post
---

This should be separate content.
`,
    );
  });

  test('formats frontmatter with custom body key and inline=true', async () => {
    const content = {
      title: 'Test Post',
      description: 'This stays inline.',
    };

    const _file = /** @type {FileConfig} */ ({
      format: 'frontmatter',
      extension: 'md',
      yamlQuote: false,
      bodyField: { key: 'description', inline: true },
    });

    const result = formatFrontMatter({ content, _file });

    // Description should stay in frontmatter
    expect(result).toBe(
      `---
title: Test Post
description: This stays inline.
---
`,
    );
  });
});

describe('Test formatEntryFile() with comments', () => {
  const comments = { title: 'Page title' };

  test('writes the comments to a YAML file', async () => {
    const _file = /** @type {FileConfig} */ ({ format: 'yaml', extension: 'yml' });

    expect(await formatEntryFile({ content: { title: 'Hello' }, _file, comments })).toBe(
      '# Page title\ntitle: Hello\n',
    );
  });

  test('writes the comments to YAML front matter', async () => {
    const _file = /** @type {FileConfig} */ ({ format: 'yaml-frontmatter', extension: 'md' });

    expect(
      await formatEntryFile({ content: { title: 'Hello', body: 'Text' }, _file, comments }),
    ).toBe('---\n# Page title\ntitle: Hello\n---\n\nText\n');
  });

  test('leaves the comments out of other formats, like Netlify/Decap CMS', async () => {
    const toml = /** @type {FileConfig} */ ({ format: 'toml', extension: 'toml' });
    const json = /** @type {FileConfig} */ ({ format: 'json', extension: 'json' });

    expect(await formatEntryFile({ content: { title: 'Hello' }, _file: toml, comments })).toBe(
      'title = "Hello"\n',
    );
    expect(await formatEntryFile({ content: { title: 'Hello' }, _file: json, comments })).toBe(
      '{\n  "title": "Hello"\n}\n',
    );
  });
});
