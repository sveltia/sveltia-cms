/* cSpell:disable */

import { describe, expect, test } from 'vitest';
import { encodeFilePath, formatFileName, getFileSize, getGitHash } from '$lib/services/utils/file';

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

    // Test no conflict when file doesn't exist
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

describe('Test getFileSize()', () => {
  test('Get size of string content', () => {
    // Test with a simple string
    const content = 'hello world';
    const result = getFileSize(content);

    // "hello world" is 11 bytes in UTF-8
    expect(result).toBe(11);
  });

  test('Get size of empty string', () => {
    // Test with empty string
    const result = getFileSize('');

    expect(result).toBe(0);
  });
  test('Get size of UTF-8 string with multibyte characters', () => {
    // Test with Unicode characters that take multiple bytes
    const content = '私の画像'; // Japanese characters
    const result = getFileSize(content);
    // Each Japanese character typically takes 3 bytes in UTF-8
    // But let's verify the actual size
    const expectedSize = new Blob([content], { type: 'text/plain' }).size;

    expect(result).toBe(expectedSize);
    expect(result).toBeGreaterThan(content.length); // More bytes than characters
  });

  test('Get size of File object', () => {
    // Test with a File object
    const content = 'hello world\n';
    const file = new File([content], 'test.txt', { type: 'text/plain' });
    const result = getFileSize(file);

    expect(result).toBe(12); // "hello world\n" is 12 bytes
    expect(result).toBe(file.size);
  });

  test('Get size of Blob object', () => {
    // Test with a Blob object
    const content = 'test content';
    const blob = new Blob([content], { type: 'text/plain' });
    const result = getFileSize(blob);

    expect(result).toBe(12); // "test content" is 12 bytes
    expect(result).toBe(blob.size);
  });

  test('Get size of binary Blob', () => {
    // Test with binary content
    const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff]);
    const blob = new Blob([binaryData]);
    const result = getFileSize(blob);

    expect(result).toBe(5); // 5 bytes
    expect(result).toBe(blob.size);
  });

  test('Get size of large content', () => {
    // Test with larger content
    const largeContent = 'a'.repeat(10000);
    const result = getFileSize(largeContent);

    expect(result).toBe(10000);
  });

  test('Get size of image File object', () => {
    // Test with a simple 1x1 pixel PNG image (base64 encoded)
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    const imageBytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
    const imageFile = new File([imageBytes], 'test.png', { type: 'image/png' });
    const result = getFileSize(imageFile);

    expect(result).toBe(imageBytes.length);
    expect(result).toBe(imageFile.size);
    expect(result).toBeGreaterThan(0);
  });

  test('Get size of JSON string', () => {
    // Test with JSON content
    const jsonContent = JSON.stringify({ name: 'test', value: 123, array: [1, 2, 3] });
    const result = getFileSize(jsonContent);
    const expectedSize = new Blob([jsonContent], { type: 'application/json' }).size;

    expect(result).toBe(expectedSize);
  });

  test('Get size of newline characters', () => {
    // Test with various newline characters
    const content1 = 'line1\nline2'; // Unix newline
    const content2 = 'line1\r\nline2'; // Windows newline
    const content3 = 'line1\rline2'; // Old Mac newline

    expect(getFileSize(content1)).toBe(11); // 11 bytes
    expect(getFileSize(content2)).toBe(12); // 12 bytes (extra \r)
    expect(getFileSize(content3)).toBe(11); // 11 bytes
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

  test('Same content produces same hash', async () => {
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
