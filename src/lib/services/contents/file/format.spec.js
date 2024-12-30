import { describe, expect, test } from 'vitest';
import { formatJSON, formatTOML, formatYAML } from '$lib/services/contents/file/format';

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
