import { describe, expect, test, vi } from 'vitest';

import {
  createPath,
  createPathRegEx,
  encodeFilePath,
  formatFileName,
  formatSize,
  getBlob,
  getGitHash,
  resolvePath,
} from '$lib/services/utils/file';

// Mock svelte/store
vi.mock('svelte/store', () => ({
  get: vi.fn((store) => {
    if (typeof store === 'function') {
      return store();
    }

    return 'en';
  }),
  writable: vi.fn(() => ({
    subscribe: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
  })),
  readable: vi.fn(() => ({
    subscribe: vi.fn(),
  })),
  derived: vi.fn(() => ({
    subscribe: vi.fn(),
  })),
}));

// Mock i18n dependencies
vi.mock('svelte-i18n', () => ({
  /**
   * Locale store.
   * @returns {string} Current locale.
   */
  locale: () => 'en',
  /**
   * Translation function store.
   * @returns {import('vitest').Mock} Translation function.
   */
  _: () => vi.fn((key, options) => `${key}(${options?.values?.size || ''})`),
  addMessages: vi.fn(),
  init: vi.fn(),
}));

describe('Test encodeFilePath()', () => {
  test('Encode', () => {
    expect(encodeFilePath('/public/uploads/French Hotdog(1).jpg')).toEqual(
      '/public/uploads/French%20Hotdog%281%29.jpg',
    );
    expect(encodeFilePath('@assets/images/私の画像.jpg')).toEqual(
      '@assets/images/%E7%A7%81%E3%81%AE%E7%94%BB%E5%83%8F.jpg',
    );
  });
});

describe('Test formatFileName()', () => {
  test('Basic sanitization without slugification', () => {
    // Test basic filename sanitization
    expect(formatFileName('test.jpg')).toEqual('test.jpg');
    expect(formatFileName('my file.jpg')).toEqual('my file.jpg');

    // Test removal of dangerous characters
    expect(formatFileName('file<>:"|?*.txt')).toEqual('file.txt');
    expect(formatFileName('file/path\\test.jpg')).toEqual('filepathtest.jpg');

    // Test unicode normalization
    expect(formatFileName('café.jpg')).toEqual('café.jpg');
    expect(formatFileName('résumé.pdf')).toEqual('résumé.pdf');

    // Test whitespace normalization - all whitespace characters replaced with regular spaces
    // Consecutive whitespace is collapsed to a single space
    // U+00A0: non-breaking space
    expect(formatFileName('my\u00A0file.jpg')).toEqual('my file.jpg');
    expect(formatFileName('test\u00A0\u00A0multiple.txt')).toEqual('test multiple.txt');
    // U+202F: narrow no-break space (used by macOS in screenshot timestamps)
    expect(formatFileName('Screenshot 2025-10-02 at 6.01.11\u202FPM.png')).toEqual(
      'Screenshot 2025-10-02 at 6.01.11 PM.png',
    );
    // Tab character
    expect(formatFileName('my\tfile.jpg')).toEqual('my file.jpg');
    // Newline characters (edge case - gets replaced with space)
    expect(formatFileName('my\nfile.jpg')).toEqual('my file.jpg');
    expect(formatFileName('my\r\nfile.jpg')).toEqual('my file.jpg');
    // Multiple consecutive spaces collapsed
    expect(formatFileName('my   file.jpg')).toEqual('my file.jpg');
    expect(formatFileName('test\t\t\tfile.txt')).toEqual('test file.txt');
    expect(formatFileName('mixed\u00A0 \t\u202Fspaces.pdf')).toEqual('mixed spaces.pdf');
  });

  test('Slugification when enabled', () => {
    const options = { slugificationEnabled: true };

    // Test basic slugification
    expect(formatFileName('My Test File.jpg', options)).toEqual('my-test-file.jpg');
    expect(formatFileName('Hello World.png', options)).toEqual('hello-world.png');

    // Test special characters are slugified
    expect(formatFileName('File & Test (1).pdf', options)).toEqual('file-test-1.pdf');
    expect(formatFileName('café résumé.docx', options)).toEqual('café-résumé.docx');

    // Test numbers and hyphens are preserved
    expect(formatFileName('file-123.txt', options)).toEqual('file-123.txt');
    expect(formatFileName('2023-report.xlsx', options)).toEqual('2023-report.xlsx');
  });

  test('Handling duplicate names', () => {
    const existingFiles = ['test.jpg', 'test-1.jpg', 'document.pdf'];

    // Test avoiding duplicate with existing file
    expect(formatFileName('test.jpg', { assetNamesInSameFolder: existingFiles })).toEqual(
      'test-2.jpg',
    );

    // Test no conflict when file doesn’t exist
    expect(formatFileName('newfile.jpg', { assetNamesInSameFolder: existingFiles })).toEqual(
      'newfile.jpg',
    );

    // Test with empty array
    expect(formatFileName('test.jpg', { assetNamesInSameFolder: [] })).toEqual('test.jpg');
  });

  test('Combined slugification and duplicate handling', () => {
    const existingFiles = ['my-file.jpg', 'my-file-1.jpg'];

    const options = {
      slugificationEnabled: true,
      assetNamesInSameFolder: existingFiles,
    };

    // Test slugification with duplicate avoidance
    expect(formatFileName('My File.jpg', options)).toEqual('my-file-2.jpg');
    expect(formatFileName('My Different File.jpg', options)).toEqual('my-different-file.jpg');
  });

  test('Files without extensions', () => {
    // Test files without extensions
    expect(formatFileName('README')).toEqual('README');
    expect(formatFileName('LICENSE', { slugificationEnabled: true })).toEqual('license');

    const existingFiles = ['README', 'README-1'];

    expect(formatFileName('README', { assetNamesInSameFolder: existingFiles })).toEqual('README-2');
  });

  test('Edge cases and special characters', () => {
    // Test very long filenames - sanitize truncates to 255 chars and may remove extension
    const longName = `${'a'.repeat(300)}.txt`;
    const result = formatFileName(longName);

    expect(result.length).toBeLessThanOrEqual(255); // sanitize truncates to 255 chars
    expect(result).toBe('a'.repeat(255)); // extension gets truncated off

    // Test empty or null-like inputs
    expect(formatFileName('')).toEqual('');
    expect(formatFileName('   ')).toEqual('');

    // Test files that start with dots
    expect(formatFileName('.gitignore')).toEqual('.gitignore');
    expect(formatFileName('.hidden-file.txt', { slugificationEnabled: true })).toEqual(
      '.hidden-file.txt',
    );
  });

  test('Unicode and international characters', () => {
    // Test various unicode characters
    expect(formatFileName('测试文件.jpg')).toEqual('测试文件.jpg');
    expect(formatFileName('файл.txt')).toEqual('файл.txt');
    expect(formatFileName('ファイル.png')).toEqual('ファイル.png');

    // Test unicode with slugification - keeps unicode characters by default
    const options = { slugificationEnabled: true };

    expect(formatFileName('测试文件.jpg', options)).toEqual('测试文件.jpg');
    expect(formatFileName('файл тест.txt', options)).toEqual('файл-тест.txt');
  });

  test('Multiple extensions and complex filenames', () => {
    // Test files with multiple extensions
    expect(formatFileName('archive.tar.gz')).toEqual('archive.tar.gz');
    expect(formatFileName('backup.sql.bz2', { slugificationEnabled: true })).toEqual(
      'backup.sql.bz2',
    );

    // Test very complex filenames - consecutive special chars become multiple hyphens
    expect(formatFileName('My (Important) File - Copy [2023].pdf')).toEqual(
      'My (Important) File - Copy [2023].pdf',
    );

    const options = { slugificationEnabled: true };

    expect(formatFileName('My (Important) File - Copy [2023].pdf', options)).toEqual(
      'my-important-file-copy-2023.pdf',
    );
  });
});

describe('Test getBlob()', () => {
  test('Convert string to Blob', () => {
    // Test with a simple string
    const content = 'hello world';
    const result = getBlob(content);

    expect(result).toBeInstanceOf(Blob);
    expect(result.size).toBe(11); // "hello world" is 11 bytes
    expect(result.type).toBe('text/plain');
  });

  test('Convert empty string to Blob', () => {
    // Test with empty string
    const result = getBlob('');

    expect(result).toBeInstanceOf(Blob);
    expect(result.size).toBe(0);
    expect(result.type).toBe('text/plain');
  });

  test('Convert UTF-8 string to Blob', () => {
    // Test with Unicode characters
    const content = '私の画像'; // Japanese characters
    const result = getBlob(content);

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('text/plain');
    expect(result.size).toBeGreaterThan(content.length); // More bytes than characters
  });

  test('Return File object unchanged', () => {
    // Test with a File object - should return it unchanged
    const content = 'hello world\n';
    const file = new File([content], 'test.txt', { type: 'text/plain' });
    const result = getBlob(file);

    expect(result).toBe(file); // Should return the same File object
    expect(result).toBeInstanceOf(File);
    expect(result.size).toBe(12);
    expect(result.type).toBe('text/plain');
  });

  test('Return Blob object unchanged', () => {
    // Test with a Blob object - should return it unchanged
    const content = 'test content';
    const blob = new Blob([content], { type: 'application/json' });
    const result = getBlob(blob);

    expect(result).toBe(blob); // Should return the same Blob object
    expect(result).toBeInstanceOf(Blob);
    expect(result.size).toBe(12);
    expect(result.type).toBe('application/json');
  });

  test('Convert JSON string to Blob', () => {
    // Test with JSON content
    const jsonContent = JSON.stringify({ name: 'test', value: 123 });
    const result = getBlob(jsonContent);

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('text/plain');
    expect(result.size).toBe(jsonContent.length);
  });

  test('Convert large string to Blob', () => {
    // Test with larger content
    const largeContent = 'a'.repeat(10000);
    const result = getBlob(largeContent);

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('text/plain');
    expect(result.size).toBe(10000);
  });

  test('Convert string with newlines to Blob', () => {
    // Test with various newline characters
    const content1 = 'line1\nline2'; // Unix newline
    const content2 = 'line1\r\nline2'; // Windows newline
    const content3 = 'line1\rline2'; // Old Mac newline
    const result1 = getBlob(content1);
    const result2 = getBlob(content2);
    const result3 = getBlob(content3);

    expect(result1.size).toBe(11); // 11 bytes
    expect(result2.size).toBe(12); // 12 bytes (extra \r)
    expect(result3.size).toBe(11); // 11 bytes
    expect(result1.type).toBe('text/plain');
    expect(result2.type).toBe('text/plain');
    expect(result3.type).toBe('text/plain');
  });

  test('Blob can be read back as text', async () => {
    // Test that the created Blob can be read back as text
    const originalContent = 'hello world test';
    const blob = getBlob(originalContent);
    const readBackContent = await blob.text();

    expect(readBackContent).toBe(originalContent);
  });

  test('Binary Blob remains unchanged', () => {
    // Test with binary content in a Blob
    const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff]);
    const binaryBlob = new Blob([binaryData], { type: 'application/octet-stream' });
    const result = getBlob(binaryBlob);

    expect(result).toBe(binaryBlob); // Should return the same Blob object
    expect(result.size).toBe(5);
    expect(result.type).toBe('application/octet-stream');
  });
});

describe('Test getGitHash()', () => {
  test('Hash string content', async () => {
    // Test with a simple string - Git hash for "hello world\n"
    const result = await getGitHash('hello world\n');

    expect(result).toBe('3b18e512dba79e4c8300dd08aeb37f8e728b8dad');
  });

  test('Hash empty string', async () => {
    // Test with empty string
    const result = await getGitHash('');

    expect(result).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  });

  test('Hash File object', async () => {
    // Test with a File object
    const file = new File(['hello world\n'], 'test.txt', { type: 'text/plain' });
    const result = await getGitHash(file);

    expect(result).toBe('3b18e512dba79e4c8300dd08aeb37f8e728b8dad');
  });

  test('Hash Blob object', async () => {
    // Test with a Blob object
    const blob = new Blob(['hello world\n'], { type: 'text/plain' });
    const result = await getGitHash(blob);

    expect(result).toBe('3b18e512dba79e4c8300dd08aeb37f8e728b8dad');
  });

  test('Hash binary content', async () => {
    // Test with binary content (a simple byte sequence)
    const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const blob = new Blob([binaryData]);
    const result = await getGitHash(blob);

    expect(typeof result).toBe('string');
    expect(result).toHaveLength(40); // SHA-1 hashes are 40 characters long
  });

  test('Hash larger content', async () => {
    // Test with larger content to ensure no call stack issues
    const largeContent = 'a'.repeat(10000);
    const result = await getGitHash(largeContent);

    expect(typeof result).toBe('string');
    expect(result).toHaveLength(40);
  });

  test('Different content produces different hashes', async () => {
    // Ensure different content produces different hashes
    const hash1 = await getGitHash('content1');
    const hash2 = await getGitHash('content2');

    expect(hash1).not.toBe(hash2);
  });

  test('Same content produces the same hash', async () => {
    // Ensure same content always produces the same hash
    const content = 'test content';
    const hash1 = await getGitHash(content);
    const hash2 = await getGitHash(content);

    expect(hash1).toBe(hash2);
  });

  test('Hash image file', async () => {
    // Test with a simple 1x1 pixel PNG image (base64 encoded)
    // This is a minimal valid PNG file
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    const imageBytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
    const imageBlob = new Blob([imageBytes], { type: 'image/png' });
    const result = await getGitHash(imageBlob);

    expect(typeof result).toBe('string');
    expect(result).toHaveLength(40);
    // This specific 1x1 transparent PNG should always produce the same hash
    expect(result).toBe('613754cfaf74a7a2d86984231479d5671731f18a');
  });

  test('Hash image File object', async () => {
    // Test with the same image as a File object
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    const imageBytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
    const imageFile = new File([imageBytes], 'test.png', { type: 'image/png' });
    const result = await getGitHash(imageFile);

    expect(typeof result).toBe('string');
    expect(result).toHaveLength(40);
    // Should produce the same hash as the Blob version
    expect(result).toBe('613754cfaf74a7a2d86984231479d5671731f18a');
  });
});

describe('Test formatSize()', () => {
  test('should format file sizes correctly', () => {
    // The formatSize function returns i18n translated strings, not just numbers
    // Test bytes
    expect(formatSize(500)).toBe('file_size_units.b(500)');
    expect(formatSize(999)).toBe('file_size_units.b(999)');

    // Test kilobytes
    expect(formatSize(1000)).toBe('file_size_units.kb(1)');
    expect(formatSize(1500)).toBe('file_size_units.kb(1.5)');
    expect(formatSize(999999)).toBe('file_size_units.kb(1,000)');

    // Test megabytes
    expect(formatSize(1000000)).toBe('file_size_units.mb(1)');
    expect(formatSize(1500000)).toBe('file_size_units.mb(1.5)');
    expect(formatSize(999999999)).toBe('file_size_units.mb(1,000)');

    // Test gigabytes
    expect(formatSize(1000000000)).toBe('file_size_units.gb(1)');
    expect(formatSize(1500000000)).toBe('file_size_units.gb(1.5)');
    expect(formatSize(999999999999)).toBe('file_size_units.gb(1,000)');

    // Test terabytes
    expect(formatSize(1000000000000)).toBe('file_size_units.tb(1)');
    expect(formatSize(1500000000000)).toBe('file_size_units.tb(1.5)');
  });

  test('should handle edge cases', () => {
    expect(formatSize(0)).toBe('file_size_units.b(0)');
    expect(formatSize(1)).toBe('file_size_units.b(1)');
  });
});

describe('Test resolvePath()', () => {
  test('should resolve basic paths without dots', () => {
    expect(resolvePath('folder/file.txt')).toBe('folder/file.txt');
    expect(resolvePath('a/b/c/file.txt')).toBe('a/b/c/file.txt');
  });

  test('should resolve paths with current directory dots', () => {
    expect(resolvePath('folder/./file.txt')).toBe('folder/file.txt');
    expect(resolvePath('./folder/file.txt')).toBe('./folder/file.txt');
    expect(resolvePath('a/./b/./c/file.txt')).toBe('a/b/c/file.txt');
  });

  test('should resolve paths with parent directory dots', () => {
    expect(resolvePath('folder/../file.txt')).toBe('file.txt');
    expect(resolvePath('a/b/../c/file.txt')).toBe('a/c/file.txt');
    expect(resolvePath('a/b/c/../../file.txt')).toBe('a/file.txt');
  });

  test('should handle complex path resolution', () => {
    expect(resolvePath('a/b/../c/./d/../file.txt')).toBe('a/c/file.txt');
    expect(resolvePath('folder/subfolder/../../other/file.txt')).toBe('other/file.txt');
  });

  test('should handle leading dots', () => {
    expect(resolvePath('../file.txt')).toBe('../file.txt');
    expect(resolvePath('./file.txt')).toBe('./file.txt');
    expect(resolvePath('../folder/file.txt')).toBe('../folder/file.txt');
  });

  test('should handle empty segments', () => {
    // createPath filters out empty segments, so // becomes single /
    expect(resolvePath('folder//file.txt')).toBe('folder/file.txt');
    expect(resolvePath('//folder/file.txt')).toBe('folder/file.txt'); // Leading empty segments are filtered
  });
});

describe('Test createPath()', () => {
  test('should join valid path segments', () => {
    expect(createPath(['folder', 'subfolder', 'file.txt'])).toBe('folder/subfolder/file.txt');
    expect(createPath(['a', 'b', 'c'])).toBe('a/b/c');
  });

  test('should filter out null and undefined values', () => {
    expect(createPath(['folder', null, 'file.txt'])).toBe('folder/file.txt');
    expect(createPath(['folder', undefined, 'file.txt'])).toBe('folder/file.txt');
    expect(createPath([null, 'folder', undefined, 'file.txt'])).toBe('folder/file.txt');
  });

  test('should filter out empty strings', () => {
    expect(createPath(['folder', '', 'file.txt'])).toBe('folder/file.txt');
    expect(createPath(['', 'folder', '', 'file.txt', ''])).toBe('folder/file.txt');
  });

  test('should handle all falsy values', () => {
    expect(createPath([null, undefined, '', 'folder', 'file.txt'])).toBe('folder/file.txt');
  });

  test('should handle empty array', () => {
    expect(createPath([])).toBe('');
  });

  test('should handle array with only falsy values', () => {
    expect(createPath([null, undefined, ''])).toBe('');
  });
});

describe('Test createPathRegEx()', () => {
  test('should create regex for simple path', () => {
    const regex = createPathRegEx('folder/file.txt', (segment) => segment);

    expect(regex.test('folder/file.txt')).toBe(true);
    expect(regex.test('folder/file.txt ')).toBe(true); // \b allows whitespace after
    expect(regex.test('other/file.txt')).toBe(false);
  });

  test('should apply replacer function to each segment', () => {
    const regex = createPathRegEx('folder/{{slug}}/file.txt', (segment) =>
      segment.replace(/{{.+?}}/, '.+?'),
    );

    expect(regex.test('folder/my-slug/file.txt')).toBe(true);
    expect(regex.test('folder/another-slug/file.txt')).toBe(true);
    expect(regex.test('other/my-slug/file.txt')).toBe(false);
  });

  test('should not escape special regex characters by default', () => {
    // The replacer is responsible for escaping - the function itself doesn't escape
    const regex = createPathRegEx('folder/file.txt', (segment) => segment);

    // Without escaping in the replacer, the dot matches any character
    expect(regex.test('folder/file.txt')).toBe(true);
    expect(regex.test('folder/fileXtxt')).toBe(true); // Dot matches X
  });

  test('should support escaping when replacer escapes', () => {
    const regex = createPathRegEx('folder/file.txt', (segment) =>
      segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );

    // With escaping, dot only matches literal dot
    expect(regex.test('folder/file.txt')).toBe(true);
    expect(regex.test('folder/fileXtxt')).toBe(false);
  });

  test('should use word boundary at the end', () => {
    const regex = createPathRegEx('folder/prefix', (segment) => segment);

    expect(regex.test('folder/prefix')).toBe(true);
    expect(regex.test('folder/prefix-more')).toBe(true); // Word boundary allows this
    expect(regex.test('folder/prefixabc')).toBe(false); // No word boundary between x and a
    expect(regex.test('other/prefix')).toBe(false);
  });

  test('should handle multiple template tags', () => {
    const regex = createPathRegEx('{{year}}/{{month}}/{{slug}}.md', (segment) =>
      segment.replace(/{{.+?}}/, '.+?'),
    );

    expect(regex.test('2024/01/my-post.md')).toBe(true);
    expect(regex.test('2024/12/another-post.md')).toBe(true);
    expect(regex.test('2024/01')).toBe(false);
  });

  test('should handle paths with multiple segments', () => {
    const regex = createPathRegEx('a/b/c/d/e', (segment) => segment);

    expect(regex.test('a/b/c/d/e')).toBe(true);
    expect(regex.test('a/b/c/d/e/f')).toBe(true);
    expect(regex.test('a/b/c/d')).toBe(false);
  });
});
