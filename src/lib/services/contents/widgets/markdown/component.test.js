import { describe, expect, test } from 'vitest';

import { IMAGE_REGEX, LINKED_IMAGE_REGEX } from './component.js';

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

describe('Test LINKED_IMAGE_REGEX', () => {
  test('matches linked image markdown syntax', () => {
    const markdown = '[![alt text](image.jpg)](https://example.com)';
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt1).toBe('alt text');
    expect(match?.groups?.src1).toBe('image.jpg');
    expect(match?.groups?.title1).toBeUndefined();
    expect(match?.groups?.link).toBe('https://example.com');
  });

  test('matches linked image with title', () => {
    const markdown = '[![alt](image.jpg "Image title")](https://example.com)';
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt1).toBe('alt');
    expect(match?.groups?.src1).toBe('image.jpg');
    expect(match?.groups?.title1).toBe('Image title');
    expect(match?.groups?.link).toBe('https://example.com');
  });

  test('matches simple image without link', () => {
    const markdown = '![alt text](image.jpg)';
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();

    // Check both possible group sets due to alternation
    const alt = match?.groups?.alt1 || match?.groups?.alt2;
    const src = match?.groups?.src1 || match?.groups?.src2;
    const title = match?.groups?.title1 || match?.groups?.title2;

    expect(alt).toBe('alt text');
    expect(src).toBe('image.jpg');
    expect(title).toBeUndefined();
    expect(match?.groups?.link).toBeUndefined();
  });

  test('matches linked image with parentheses in filename', () => {
    const markdown = '[![alt](image (1).jpg)](https://example.com)';
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt1).toBe('alt');
    expect(match?.groups?.src1).toBe('image (1).jpg');
    expect(match?.groups?.link).toBe('https://example.com');
  });

  test('matches linked image with multiple parentheses in filename', () => {
    const markdown = '[![test](file (1) (copy).jpg)](https://example.com)';
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt1).toBe('test');
    expect(match?.groups?.src1).toBe('file (1) (copy).jpg');
    expect(match?.groups?.link).toBe('https://example.com');
  });

  test('matches complex linked image with title and parentheses', () => {
    const markdown =
      '[![screenshot](assets/screenshot (2024-01-01).png "Screenshot from 2024")](https://example.com/gallery)';

    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt1).toBe('screenshot');
    expect(match?.groups?.src1).toBe('assets/screenshot (2024-01-01).png');
    expect(match?.groups?.title1).toBe('Screenshot from 2024');
    expect(match?.groups?.link).toBe('https://example.com/gallery');
  });

  test('matches image with parentheses in link URL', () => {
    const markdown = '[![alt](image.jpg)](https://example.com/page(1))';
    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt1).toBe('alt');
    expect(match?.groups?.src1).toBe('image.jpg');
    expect(match?.groups?.link).toBe('https://example.com/page(1)');
  });

  test('handles complex URLs in both image and link', () => {
    const markdown =
      '[![alt](https://cdn.example.com/image(1).jpg?v=2)](https://example.com/page?id=1&ref=gallery)';

    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt1).toBe('alt');
    expect(match?.groups?.src1).toBe('https://cdn.example.com/image(1).jpg?v=2');
    expect(match?.groups?.link).toBe('https://example.com/page?id=1&ref=gallery');
  });

  test('matches linked image with escaped characters', () => {
    const markdown =
      '[![alt with \\[brackets\\]](image\\(1\\).jpg "Title with \\"quotes\\"")](https://example.com)';

    const match = markdown.match(LINKED_IMAGE_REGEX);

    expect(match).toBeTruthy();
    expect(match?.groups?.alt1).toBe('alt with \\[brackets\\]');
    expect(match?.groups?.src1).toBe('image\\(1\\).jpg');
    expect(match?.groups?.title1).toBe('Title with \\"quotes\\"');
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
