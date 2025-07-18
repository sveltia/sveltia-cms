import { describe, expect, test } from 'vitest';
import {
  formatFrontMatter,
  formatJSON,
  formatTOML,
  formatYAML,
} from '$lib/services/contents/file/format';

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
});
