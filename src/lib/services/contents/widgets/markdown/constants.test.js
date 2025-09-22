import { describe, expect, test } from 'vitest';

import {
  GLOBAL_IMAGE_REGEX,
  IMAGE_OR_LINKED_IMAGE_REGEX,
  IMAGE_REGEX,
  LINKED_IMAGE_REGEX,
} from './constants.js';

describe('Test IMAGE_REGEX', () => {
  test('matches simple image markdown syntax', () => {
    const markdown = '![alt text](image.jpg)';
    const match = markdown.match(IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt).toBe('alt text');
    expect(match?.groups?.src).toBe('image.jpg');
    expect(match?.groups?.title).toBeUndefined();
  });

  test('matches image with title', () => {
    const markdown = '![alt text](image.jpg "Image title")';
    const match = markdown.match(IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt).toBe('alt text');
    expect(match?.groups?.src).toBe('image.jpg');
    expect(match?.groups?.title).toBe('Image title');
  });

  test('matches image with empty alt text', () => {
    const markdown = '![](image.jpg)';
    const match = markdown.match(IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt).toBe('');
    expect(match?.groups?.src).toBe('image.jpg');
  });

  test('matches image with parentheses in filename', () => {
    const markdown = '![alt](image (1).jpg)';
    const match = markdown.match(IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt).toBe('alt');
    expect(match?.groups?.src).toBe('image (1).jpg');
    expect(match?.groups?.title).toBeUndefined();
  });

  test('matches image with multiple parentheses in filename', () => {
    const markdown = '![test](file (1) (copy).jpg)';
    const match = markdown.match(IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt).toBe('test');
    expect(match?.groups?.src).toBe('file (1) (copy).jpg');
    expect(match?.groups?.title).toBeUndefined();
  });

  test('matches image with parentheses in filename and title', () => {
    const markdown = '![alt](image (1).jpg "Title with content")';
    const match = markdown.match(IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt).toBe('alt');
    expect(match?.groups?.src).toBe('image (1).jpg');
    expect(match?.groups?.title).toBe('Title with content');
  });

  test('matches image with complex filename', () => {
    const markdown = '![screenshot](assets/screenshot (2024-01-01).png)';
    const match = markdown.match(IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt).toBe('screenshot');
    expect(match?.groups?.src).toBe('assets/screenshot (2024-01-01).png');
    expect(match?.groups?.title).toBeUndefined();
  });

  test('handles URLs with query parameters', () => {
    const markdown = '![alt](https://example.com/image.jpg?v=1&size=large)';
    const match = markdown.match(IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt).toBe('alt');
    expect(match?.groups?.src).toBe('https://example.com/image.jpg?v=1&size=large');
  });

  test('matches image with escaped parentheses in filename', () => {
    const markdown = '![alt](image\\(1\\).jpg)';
    const match = markdown.match(IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt).toBe('alt');
    expect(match?.groups?.src).toBe('image\\(1\\).jpg');
    expect(match?.groups?.title).toBeUndefined();
  });

  test('matches image with escaped quotes in title', () => {
    const markdown = '![alt](image.jpg "Title with \\"quotes\\"")';
    const match = markdown.match(IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt).toBe('alt');
    expect(match?.groups?.src).toBe('image.jpg');
    expect(match?.groups?.title).toBe('Title with \\"quotes\\"');
  });

  test('matches image with escaped brackets in alt text', () => {
    const markdown = '![alt with \\[brackets\\]](image.jpg)';
    const match = markdown.match(IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt).toBe('alt with \\[brackets\\]');
    expect(match?.groups?.src).toBe('image.jpg');
  });
});

describe('Test IMAGE_OR_LINKED_IMAGE_REGEX', () => {
  test('matches linked image markdown syntax', () => {
    const markdown = '[![alt text](image.jpg)](https://example.com)';
    const match = markdown.match(IMAGE_OR_LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('alt text');
    expect(match?.groups?.src2).toBe('image.jpg');
    expect(match?.groups?.title2).toBeUndefined();
    expect(match?.groups?.link).toBe('https://example.com');
  });

  test('matches linked image with title', () => {
    const markdown = '[![alt](image.jpg "Image title")](https://example.com)';
    const match = markdown.match(IMAGE_OR_LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('alt');
    expect(match?.groups?.src2).toBe('image.jpg');
    expect(match?.groups?.title2).toBe('Image title');
    expect(match?.groups?.link).toBe('https://example.com');
  });

  test('matches simple image without link', () => {
    const markdown = '![alt text](image.jpg)';
    const match = markdown.match(IMAGE_OR_LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();

    // Check both possible group sets due to alternation
    const alt = match?.groups?.alt || match?.groups?.alt2;
    const src = match?.groups?.src || match?.groups?.src2;
    const title = match?.groups?.title || match?.groups?.title2;

    expect(alt).toBe('alt text');
    expect(src).toBe('image.jpg');
    expect(title).toBeUndefined();
    expect(match?.groups?.link).toBeUndefined();
  });

  test('matches linked image with parentheses in filename', () => {
    const markdown = '[![alt](image (1).jpg)](https://example.com)';
    const match = markdown.match(IMAGE_OR_LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('alt');
    expect(match?.groups?.src2).toBe('image (1).jpg');
    expect(match?.groups?.link).toBe('https://example.com');
  });

  test('matches linked image with multiple parentheses in filename', () => {
    const markdown = '[![test](file (1) (copy).jpg)](https://example.com)';
    const match = markdown.match(IMAGE_OR_LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('test');
    expect(match?.groups?.src2).toBe('file (1) (copy).jpg');
    expect(match?.groups?.link).toBe('https://example.com');
  });

  test('matches complex linked image with title and parentheses', () => {
    const markdown =
      '[![screenshot](assets/screenshot (2024-01-01).png "Screenshot from 2024")](https://example.com/gallery)';

    const match = markdown.match(IMAGE_OR_LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('screenshot');
    expect(match?.groups?.src2).toBe('assets/screenshot (2024-01-01).png');
    expect(match?.groups?.title2).toBe('Screenshot from 2024');
    expect(match?.groups?.link).toBe('https://example.com/gallery');
  });

  test('matches image with parentheses in link URL', () => {
    const markdown = '[![alt](image.jpg)](https://example.com/page(1))';
    const match = markdown.match(IMAGE_OR_LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('alt');
    expect(match?.groups?.src2).toBe('image.jpg');
    expect(match?.groups?.link).toBe('https://example.com/page(1)');
  });

  test('handles complex URLs in both image and link', () => {
    const markdown =
      '[![alt](https://cdn.example.com/image(1).jpg?v=2)](https://example.com/page?id=1&ref=gallery)';

    const match = markdown.match(IMAGE_OR_LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('alt');
    expect(match?.groups?.src2).toBe('https://cdn.example.com/image(1).jpg?v=2');
    expect(match?.groups?.link).toBe('https://example.com/page?id=1&ref=gallery');
  });

  test('matches linked image with escaped characters', () => {
    const markdown =
      '[![alt with \\[brackets\\]](image\\(1\\).jpg "Title with \\"quotes\\"")](https://example.com)';

    const match = markdown.match(IMAGE_OR_LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('alt with \\[brackets\\]');
    expect(match?.groups?.src2).toBe('image\\(1\\).jpg');
    expect(match?.groups?.title2).toBe('Title with \\"quotes\\"');
    expect(match?.groups?.link).toBe('https://example.com');
  });
});

describe('Test regex basic functionality', () => {
  test('handles images with spaces in alt text', () => {
    const markdown = '![alt with spaces](image.jpg)';
    const match = markdown.match(IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt).toBe('alt with spaces');
  });
});

describe('Test GLOBAL_IMAGE_REGEX', () => {
  test('matches multiple images in a single string', () => {
    const markdown = `
Here is the first image: ![first](image1.jpg)
And here is the second: ![second](image2.png "Title")
Finally, here's the third: ![third](path/to/image3.gif)
    `.trim();

    const matches = Array.from(markdown.matchAll(GLOBAL_IMAGE_REGEX));

    expect(matches).toHaveLength(3);

    expect(matches[0]?.groups?.alt).toBe('first');
    expect(matches[0]?.groups?.src).toBe('image1.jpg');
    expect(matches[0]?.groups?.title).toBeUndefined();

    expect(matches[1]?.groups?.alt).toBe('second');
    expect(matches[1]?.groups?.src).toBe('image2.png');
    expect(matches[1]?.groups?.title).toBe('Title');

    expect(matches[2]?.groups?.alt).toBe('third');
    expect(matches[2]?.groups?.src).toBe('path/to/image3.gif');
    expect(matches[2]?.groups?.title).toBeUndefined();
  });

  test('matches images with complex filenames globally', () => {
    const markdown = `
![screenshot](assets/screenshot (2024-01-01).png)
![backup](backup\\(1\\).jpg "Backup image")
![test](file (1) (copy).webp)
    `.trim();

    const matches = Array.from(markdown.matchAll(GLOBAL_IMAGE_REGEX));

    expect(matches).toHaveLength(3);

    expect(matches[0]?.groups?.alt).toBe('screenshot');
    expect(matches[0]?.groups?.src).toBe('assets/screenshot (2024-01-01).png');

    expect(matches[1]?.groups?.alt).toBe('backup');
    expect(matches[1]?.groups?.src).toBe('backup\\(1\\).jpg');
    expect(matches[1]?.groups?.title).toBe('Backup image');

    expect(matches[2]?.groups?.alt).toBe('test');
    expect(matches[2]?.groups?.src).toBe('file (1) (copy).webp');
  });

  test('handles mixed content with images and text', () => {
    const markdown = `
# My Document

This is a paragraph with an image ![inline](inline.jpg) in the middle.

## Gallery

Here are some images:
- ![first](gallery/first.png "First image")
- ![second](gallery/second.jpg)

And some ![more](assets/more.gif "More images") content.
    `.trim();

    const matches = Array.from(markdown.matchAll(GLOBAL_IMAGE_REGEX));

    expect(matches).toHaveLength(4);

    expect(matches[0]?.groups?.alt).toBe('inline');
    expect(matches[0]?.groups?.src).toBe('inline.jpg');

    expect(matches[1]?.groups?.alt).toBe('first');
    expect(matches[1]?.groups?.src).toBe('gallery/first.png');
    expect(matches[1]?.groups?.title).toBe('First image');

    expect(matches[2]?.groups?.alt).toBe('second');
    expect(matches[2]?.groups?.src).toBe('gallery/second.jpg');

    expect(matches[3]?.groups?.alt).toBe('more');
    expect(matches[3]?.groups?.src).toBe('assets/more.gif');
    expect(matches[3]?.groups?.title).toBe('More images');
  });

  test('returns empty array when no images found', () => {
    const markdown =
      '# No Images Here\n\nThis is just text without any images.\nSome code and a link: [link text](https://example.com)';

    const matches = Array.from(markdown.matchAll(GLOBAL_IMAGE_REGEX));

    expect(matches).toHaveLength(0);
  });

  test('handles edge cases with multiple images on same line', () => {
    const markdown = 'Before ![first](a.jpg) middle ![second](b.png "title") after';
    const matches = Array.from(markdown.matchAll(GLOBAL_IMAGE_REGEX));

    expect(matches).toHaveLength(2);

    expect(matches[0]?.groups?.alt).toBe('first');
    expect(matches[0]?.groups?.src).toBe('a.jpg');

    expect(matches[1]?.groups?.alt).toBe('second');
    expect(matches[1]?.groups?.src).toBe('b.png');
    expect(matches[1]?.groups?.title).toBe('title');
  });
});

describe('Test LINKED_IMAGE_REGEX', () => {
  test('matches basic linked image', () => {
    const markdown = '[![alt text](image.jpg)](https://example.com)';
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('alt text');
    expect(match?.groups?.src2).toBe('image.jpg');
    expect(match?.groups?.title2).toBeUndefined();
    expect(match?.groups?.link).toBe('https://example.com');
  });

  test('matches linked image with title', () => {
    const markdown = '[![alt](image.jpg "Image title")](https://example.com)';
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('alt');
    expect(match?.groups?.src2).toBe('image.jpg');
    expect(match?.groups?.title2).toBe('Image title');
    expect(match?.groups?.link).toBe('https://example.com');
  });

  test('matches linked image with parentheses in filename', () => {
    const markdown = '[![alt](image (1).jpg)](https://example.com)';
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('alt');
    expect(match?.groups?.src2).toBe('image (1).jpg');
    expect(match?.groups?.link).toBe('https://example.com');
  });

  test('matches linked image with parentheses in link URL', () => {
    const markdown = '[![alt](image.jpg)](https://example.com/page(1))';
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('alt');
    expect(match?.groups?.src2).toBe('image.jpg');
    expect(match?.groups?.link).toBe('https://example.com/page(1)');
  });

  test('matches linked image with complex nested parentheses', () => {
    const markdown = '[![test](file (1) (copy).jpg)](https://example.com/gallery(main))';
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('test');
    expect(match?.groups?.src2).toBe('file (1) (copy).jpg');
    expect(match?.groups?.link).toBe('https://example.com/gallery(main)');
  });

  test('matches linked image with escaped characters', () => {
    const markdown =
      '[![alt with \\[brackets\\]](image\\(1\\).jpg "Title with \\"quotes\\"")](https://example.com)';

    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('alt with \\[brackets\\]');
    expect(match?.groups?.src2).toBe('image\\(1\\).jpg');
    expect(match?.groups?.title2).toBe('Title with \\"quotes\\"');
    expect(match?.groups?.link).toBe('https://example.com');
  });

  test('does not match regular image without link', () => {
    const markdown = '![alt text](image.jpg)';
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBe(null);
  });

  test('does not match malformed linked image', () => {
    const markdown = '[![alt](image.jpg)[link]'; // Missing closing parentheses
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBe(null);
  });

  test('matches linked image with empty alt text', () => {
    const markdown = '[![](image.jpg)](https://example.com)';
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('');
    expect(match?.groups?.src2).toBe('image.jpg');
    expect(match?.groups?.link).toBe('https://example.com');
  });

  test('handles complex URLs with query parameters', () => {
    const markdown =
      '[![alt](https://cdn.example.com/image.jpg?v=1&size=large)](https://example.com/page?id=1&ref=gallery)';

    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt2).toBe('alt');
    expect(match?.groups?.src2).toBe('https://cdn.example.com/image.jpg?v=1&size=large');
    expect(match?.groups?.link).toBe('https://example.com/page?id=1&ref=gallery');
  });
});
