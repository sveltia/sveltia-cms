/* cSpell:disable */

import { describe, expect, test } from 'vitest';
import { encodeFilePath, formatFileName } from '$lib/services/utils/file';

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
