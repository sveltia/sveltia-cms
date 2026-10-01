import { describe, expect, test, vi } from 'vitest';

import { formatFileName } from '$lib/services/assets/file-name';

// Mock i18n dependencies
vi.mock('@sveltia/i18n', () => ({
  locale: { current: 'en', set: vi.fn() },
  _: vi.fn((key, options) => `${key}(${options?.values?.size || ''})`),
}));

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

    // Test uppercase extensions are lowercased during slugification
    expect(formatFileName('Photo.JPG', options)).toEqual('photo.jpg');
    expect(formatFileName('Video.MOV', options)).toEqual('video.mov');
    expect(formatFileName('Clip.MP4', options)).toEqual('clip.mp4');
    expect(formatFileName('Document.PDF', options)).toEqual('document.pdf');
    expect(formatFileName('My Image.JPEG', options)).toEqual('my-image.jpeg');
    expect(formatFileName('Mixed Case.Png', options)).toEqual('mixed-case.png');
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

    // Test when only base name exists (no numbered suffix) - should create test-1.jpg
    expect(formatFileName('test.jpg', { assetNamesInSameFolder: ['test.jpg'] })).toEqual(
      'test-1.jpg',
    );
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
