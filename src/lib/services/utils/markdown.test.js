import { describe, expect, test } from 'vitest';

import { removeMarkdownSyntax } from './markdown';

describe('removeMarkdownSyntax', () => {
  test('should remove matching bold markdown characters', () => {
    expect(removeMarkdownSyntax('**bold text**')).toBe('bold text');
    expect(removeMarkdownSyntax('**bold**')).toBe('bold');
    expect(removeMarkdownSyntax('__bold text__')).toBe('bold text');
    expect(removeMarkdownSyntax('__bold__')).toBe('bold');
  });

  test('should remove matching italic markdown characters', () => {
    expect(removeMarkdownSyntax('*italic text*')).toBe('italic text');
    expect(removeMarkdownSyntax('*italic*')).toBe('italic');
    expect(removeMarkdownSyntax('_italic text_')).toBe('italic text');
    expect(removeMarkdownSyntax('_italic_')).toBe('italic');
  });

  test('should remove matching code markdown characters', () => {
    expect(removeMarkdownSyntax('`code text`')).toBe('code text');
    expect(removeMarkdownSyntax('`code`')).toBe('code');
    expect(removeMarkdownSyntax('```code block```')).toBe('code block');
  });

  test('should remove matching strikethrough markdown characters', () => {
    expect(removeMarkdownSyntax('~~strikethrough text~~')).toBe('strikethrough text');
    expect(removeMarkdownSyntax('~~strikethrough~~')).toBe('strikethrough');
    expect(removeMarkdownSyntax('~single tilde~')).toBe('single tilde');
    expect(removeMarkdownSyntax('~~~triple tilde~~~')).toBe('triple tilde');
  });

  test('should handle mixed markdown characters', () => {
    expect(removeMarkdownSyntax('**bold** and *italic* and `code`')).toBe(
      'bold and italic and code',
    );
    expect(removeMarkdownSyntax('**bold** text with *italic* words')).toBe(
      'bold text with italic words',
    );
    expect(removeMarkdownSyntax('`code` and **bold** text')).toBe('code and bold text');
    expect(removeMarkdownSyntax('~~strikethrough~~ and **bold** text')).toBe(
      'strikethrough and bold text',
    );
    expect(removeMarkdownSyntax('**bold** and *italic* and `code` and ~~strikethrough~~')).toBe(
      'bold and italic and code and strikethrough',
    );
  });

  test('should not remove non-matching markdown characters', () => {
    expect(removeMarkdownSyntax('**bold*')).toBe('*bold');
    expect(removeMarkdownSyntax('*bold**')).toBe('bold*');
    expect(removeMarkdownSyntax('__bold_')).toBe('_bold');
    expect(removeMarkdownSyntax('_bold__')).toBe('bold_');
    expect(removeMarkdownSyntax('``code`')).toBe('`code');
    expect(removeMarkdownSyntax('`code```')).toBe('code``');
    expect(removeMarkdownSyntax('~~strike~')).toBe('~strike');
    expect(removeMarkdownSyntax('~strike~~')).toBe('strike~');
  });

  test('should handle empty strings', () => {
    expect(removeMarkdownSyntax('')).toBe('');
  });

  test('should handle strings without markdown', () => {
    expect(removeMarkdownSyntax('plain text')).toBe('plain text');
    expect(removeMarkdownSyntax('text with * and _ and ` and ~ characters')).toBe(
      'text with * and _ and ` and ~ characters',
    );
  });

  test('should handle nested markdown characters', () => {
    // The function now handles nested markdown - it removes all matching pairs
    expect(removeMarkdownSyntax('**bold with *italic* inside**')).toBe('bold with italic inside');
    expect(removeMarkdownSyntax('*italic with `code` inside*')).toBe('italic with code inside');
    expect(removeMarkdownSyntax('__bold with _italic_ inside__')).toBe('bold with italic inside');
    expect(removeMarkdownSyntax('`code with **bold** inside`')).toBe('code with bold inside');
    expect(removeMarkdownSyntax('***triple asterisk***')).toBe('triple asterisk');
    expect(removeMarkdownSyntax('___triple underscore___')).toBe('triple underscore');
    expect(removeMarkdownSyntax('~~strikethrough with *italic* inside~~')).toBe(
      'strikethrough with italic inside',
    );
    expect(removeMarkdownSyntax('*italic with ~~strikethrough~~ inside*')).toBe(
      'italic with strikethrough inside',
    );
    expect(removeMarkdownSyntax('**bold with ~~strikethrough~~ inside**')).toBe(
      'bold with strikethrough inside',
    );
  });

  test('should handle multiple instances of the same markdown type', () => {
    expect(removeMarkdownSyntax('**first bold** and **second bold**')).toBe(
      'first bold and second bold',
    );
    expect(removeMarkdownSyntax('*first italic* and *second italic*')).toBe(
      'first italic and second italic',
    );
    expect(removeMarkdownSyntax('`first code` and `second code`')).toBe(
      'first code and second code',
    );
    expect(removeMarkdownSyntax('~~first strikethrough~~ and ~~second strikethrough~~')).toBe(
      'first strikethrough and second strikethrough',
    );
  });

  test('should handle escaped markdown characters', () => {
    // The function doesn’t handle escaped characters - it still processes them
    expect(removeMarkdownSyntax('\\**not bold\\**')).toBe('\\not bold\\');
    expect(removeMarkdownSyntax('\\*not italic\\*')).toBe('\\not italic\\');
    expect(removeMarkdownSyntax('\\`not code\\`')).toBe('\\not code\\');
    expect(removeMarkdownSyntax('\\~~not strikethrough\\~~')).toBe('\\not strikethrough\\');
  });

  test('should handle markdown at the beginning and end of string', () => {
    expect(removeMarkdownSyntax('**bold text**')).toBe('bold text');
    expect(removeMarkdownSyntax('*italic text*')).toBe('italic text');
    expect(removeMarkdownSyntax('`code text`')).toBe('code text');
    expect(removeMarkdownSyntax('~~strikethrough text~~')).toBe('strikethrough text');
  });

  test('should handle markdown with special characters', () => {
    expect(removeMarkdownSyntax('**bold & special chars!**')).toBe('bold & special chars!');
    expect(removeMarkdownSyntax('*italic @ symbols*')).toBe('italic @ symbols');
    expect(removeMarkdownSyntax('`code with 123 numbers`')).toBe('code with 123 numbers');
    expect(removeMarkdownSyntax('~~strikethrough with $pecial chars~~')).toBe(
      'strikethrough with $pecial chars',
    );
  });

  test('should handle markdown with whitespace', () => {
    expect(removeMarkdownSyntax('** bold with spaces **')).toBe(' bold with spaces ');
    expect(removeMarkdownSyntax('* italic with spaces *')).toBe(' italic with spaces ');
    expect(removeMarkdownSyntax('` code with spaces `')).toBe(' code with spaces ');
    expect(removeMarkdownSyntax('~~ strikethrough with spaces ~~')).toBe(
      ' strikethrough with spaces ',
    );
  });

  test('should handle complex real-world examples', () => {
    expect(removeMarkdownSyntax('**Introduction** to *JavaScript* and `Node.js`')).toBe(
      'Introduction to JavaScript and Node.js',
    );
    expect(removeMarkdownSyntax('Learn **React** with `useState` and *useEffect*')).toBe(
      'Learn React with useState and useEffect',
    );
    expect(removeMarkdownSyntax('`console.log()` prints **output** to *terminal*')).toBe(
      'console.log() prints output to terminal',
    );
    expect(removeMarkdownSyntax('~~Deprecated~~ **New** *feature* with `code`')).toBe(
      'Deprecated New feature with code',
    );
    expect(removeMarkdownSyntax('**Important**: ~~Old method~~ is *deprecated*')).toBe(
      'Important: Old method is deprecated',
    );
  });

  test('should handle edge cases with different markdown character combinations', () => {
    expect(removeMarkdownSyntax('***bold italic***')).toBe('bold italic');
    expect(removeMarkdownSyntax('___bold italic___')).toBe('bold italic');
    expect(removeMarkdownSyntax('```code block```')).toBe('code block');
    expect(removeMarkdownSyntax('~~~strikethrough block~~~')).toBe('strikethrough block');
    expect(removeMarkdownSyntax('**bold** *italic* `code` ~~strikethrough~~')).toBe(
      'bold italic code strikethrough',
    );
  });

  test('should handle markdown with numbers and special characters', () => {
    expect(removeMarkdownSyntax('**123 bold numbers**')).toBe('123 bold numbers');
    expect(removeMarkdownSyntax('*@#$%^&*() symbols*')).toBe('@#$%^&() symbols*');
    expect(removeMarkdownSyntax('`var x = 5;`')).toBe('var x = 5;');
  });

  test('should handle mixed opening and closing characters', () => {
    expect(removeMarkdownSyntax('*bold**')).toBe('bold*');
    expect(removeMarkdownSyntax('**bold*')).toBe('*bold');
    expect(removeMarkdownSyntax('_italic__')).toBe('italic_');
    expect(removeMarkdownSyntax('__italic_')).toBe('_italic');
    expect(removeMarkdownSyntax('`code``')).toBe('code`');
    expect(removeMarkdownSyntax('``code`')).toBe('`code');
    expect(removeMarkdownSyntax('~strike~~')).toBe('strike~');
    expect(removeMarkdownSyntax('~~strike~')).toBe('~strike');
  });

  test('should handle underscore prefixed strings', () => {
    // Common file names and field names that start with underscore
    expect(removeMarkdownSyntax('_header')).toBe('_header');
    expect(removeMarkdownSyntax('_redirects')).toBe('_redirects');
    expect(removeMarkdownSyntax('_config')).toBe('_config');
    expect(removeMarkdownSyntax('_layout')).toBe('_layout');
    expect(removeMarkdownSyntax('_index')).toBe('_index');
    expect(removeMarkdownSyntax('_meta')).toBe('_meta');
    expect(removeMarkdownSyntax('_draft')).toBe('_draft');
    expect(removeMarkdownSyntax('_slug')).toBe('_slug');
  });

  test('should handle underscore prefixed strings with markdown', () => {
    // Underscore prefixed strings - the prefix doesn’t interfere with markdown processing
    expect(removeMarkdownSyntax('_header **bold**')).toBe('_header bold');
    expect(removeMarkdownSyntax('_redirects *italic*')).toBe('_redirects italic');
    expect(removeMarkdownSyntax('_config `code`')).toBe('_config code');
    expect(removeMarkdownSyntax('**bold** _header')).toBe('bold _header');
    expect(removeMarkdownSyntax('*italic* _redirects')).toBe('italic _redirects');
    expect(removeMarkdownSyntax('`code` _config')).toBe('code _config');
  });

  test('should handle underscore prefixed strings with trailing underscores', () => {
    // Strings with underscore prefix and suffix are treated as markdown and processed
    expect(removeMarkdownSyntax('_header_')).toBe('header');
    expect(removeMarkdownSyntax('_redirects_')).toBe('redirects');
    expect(removeMarkdownSyntax('_config_file_')).toBe('configfile_');
    expect(removeMarkdownSyntax('_my_variable_name_')).toBe('myvariablename');
  });

  test('should handle underscore prefixed strings with double underscores', () => {
    // Test cases where double underscores might be interpreted as markdown
    expect(removeMarkdownSyntax('__header__')).toBe('header');
    expect(removeMarkdownSyntax('__redirects__')).toBe('redirects');
    expect(removeMarkdownSyntax('__config__')).toBe('config');
    expect(removeMarkdownSyntax('_header__')).toBe('header_');
    expect(removeMarkdownSyntax('__header_')).toBe('_header');
  });

  test('should handle complex nested markdown combinations', () => {
    // Test deeply nested markdown patterns
    expect(removeMarkdownSyntax('**bold *italic `code` italic* bold**')).toBe(
      'bold italic code italic bold',
    );
    expect(removeMarkdownSyntax('*__bold italic__*')).toBe('bold italic');
    expect(removeMarkdownSyntax('`**bold code**`')).toBe('bold code');
    expect(removeMarkdownSyntax('___*deep nesting*___')).toBe('deep nesting');
    expect(removeMarkdownSyntax('**`*nested*`**')).toBe('nested');
    expect(removeMarkdownSyntax('*`__complex__`*')).toBe('complex');
    expect(removeMarkdownSyntax('~~**bold strikethrough**~~')).toBe('bold strikethrough');
    expect(removeMarkdownSyntax('**~~strikethrough bold~~**')).toBe('strikethrough bold');
    expect(removeMarkdownSyntax('*~~italic strikethrough~~*')).toBe('italic strikethrough');
    expect(removeMarkdownSyntax('`~~code strikethrough~~`')).toBe('code strikethrough');
  });

  test('should handle mixed nested and non-nested markdown', () => {
    // Test cases with both nested and standalone markdown
    expect(removeMarkdownSyntax('**bold** with *`code`* and __text__')).toBe(
      'bold with code and text',
    );
    expect(removeMarkdownSyntax('*italic* and **bold with *nested* content**')).toBe(
      'italic and bold with nested content',
    );
    expect(removeMarkdownSyntax('`code` then **bold** then *italic*')).toBe(
      'code then bold then italic',
    );
    expect(removeMarkdownSyntax('**start** *middle __nested__ middle* **end**')).toBe(
      'start middle nested middle end',
    );
    expect(removeMarkdownSyntax('~~strikethrough~~ with **bold** and *italic*')).toBe(
      'strikethrough with bold and italic',
    );
    expect(removeMarkdownSyntax('**bold** ~~strikethrough~~ *italic* `code`')).toBe(
      'bold strikethrough italic code',
    );
  });

  test('should handle partial markdown removal in complex cases', () => {
    // Test cases where only some markdown can be removed
    expect(removeMarkdownSyntax('**bold *incomplete')).toBe('*bold incomplete');
    expect(removeMarkdownSyntax('incomplete* bold**')).toBe('incomplete bold*');
    expect(removeMarkdownSyntax('**bold** *incomplete __nested__')).toBe('*bold incomplete nested');
    expect(removeMarkdownSyntax('*incomplete* **bold** `code`')).toBe('incomplete bold code');
    expect(removeMarkdownSyntax('~~incomplete strikethrough~')).toBe('~incomplete strikethrough');
    expect(removeMarkdownSyntax('incomplete~ strikethrough~~')).toBe('incomplete strikethrough~');
    expect(removeMarkdownSyntax('**bold** ~~incomplete strikethrough~')).toBe(
      'bold ~incomplete strikethrough',
    );
  });
});
