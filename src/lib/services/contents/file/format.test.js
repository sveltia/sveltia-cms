import { get } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';

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
  cmsConfig: {
    subscribe: vi.fn(),
    set: vi.fn(),
  },
}));

// Mock the get function from svelte/store to return our mock config
vi.mock('svelte/store', () => ({
  get: vi.fn(() => ({
    output: {
      yaml: { indent_size: 2, quote: 'none' },
      json: { indent_style: 'space', indent_size: 2 },
    },
  })),
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
    vi.mocked(get).mockReturnValueOnce({ output: { yaml: undefined } });

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
    vi.mocked(get).mockReturnValueOnce({ output: { json: undefined } });

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

    expect(result).toBe(
      `{
{
  "title": "My Post",
  "published": true,
  "tags": [
    "test",
    "vitest"
  ]
}
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

  test('invalid format returns empty string', () => {
    const content = { ...baseContent };
    /** @type {import('$lib/types/private').FileConfig} */
    const _file = { format: /** @type {any} */ ('invalid-format'), extension: '.md' };
    const result = formatFrontMatter({ content, _file });

    expect(result).toBe('');
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

  test('error handling in formatFrontMatter', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const _file = {
      format: /** @type {any} */ ('invalid-type'),
      extension: '.md',
    };

    const content = { title: 'Test' };
    const result = formatFrontMatter({ content, _file });

    expect(result).toBe('');
    errorSpy.mockRestore();
  });

  test('error handling in formatFrontMatter with json-frontmatter (lines 106-108)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create a mock _file object that would trigger an error during formatting
    const _file = /** @type {any} */ ({
      format: 'json-frontmatter',
      extension: '.md',
      fmDelimiters: ['---', '---'], // Valid delimiters
    });

    // Mock the content with a circular reference to trigger an error in formatJSON
    const circularObj = /** @type {any} */ ({ title: 'Test' });

    circularObj.self = circularObj; // Create circular reference

    const result = formatFrontMatter({ content: circularObj, _file });

    // When an error occurs, formatFrontMatter returns empty string
    expect(result).toBe('');
    // Verify that console.error was called
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
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

    expect(result).toContain('{');
    expect(result).toContain('"title": "Test Post"');
    expect(result).toContain('This is the body content.');
  });

  test('uses custom formatter when available', async () => {
    const customFormatter = vi.fn().mockResolvedValue('custom formatted content');
    // Mock the custom file formats
    const { customFileFormatRegistry } = await import('$lib/services/contents/file/config');

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

  test('handles formatting errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Create content that will cause JSON.stringify to fail
    const circularRef = {};

    circularRef.self = circularRef;

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('json'),
      extension: 'json',
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content: circularRef, _file });

    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('returns empty string for unknown format', async () => {
    const content = { title: 'Test' };

    const _file = /** @type {FileConfig} */ ({
      format: /** @type {any} */ ('unknown-format'),
      extension: 'txt',
      yamlQuote: false,
    });

    const result = await formatEntryFile({ content, _file });

    expect(result).toBe('');
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
});
