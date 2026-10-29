import { describe, expect, test } from 'vitest';

import { hasTemplateTags, replaceTemplateTags, splitTemplateTags } from './tags';

describe('hasTemplateTags()', () => {
  test('should return true for simple template tag', () => {
    expect(hasTemplateTags('{{title}}')).toBe(true);
    expect(hasTemplateTags('{{slug}}')).toBe(true);
    expect(hasTemplateTags('{{year}}')).toBe(true);
  });

  test('should return true for template tag with content prefix', () => {
    expect(hasTemplateTags('prefix-{{title}}')).toBe(true);
    expect(hasTemplateTags('blog-{{slug}}')).toBe(true);
    expect(hasTemplateTags('Hello {{name}}')).toBe(true);
  });

  test('should return true for template tag with content suffix', () => {
    expect(hasTemplateTags('{{title}}-suffix')).toBe(true);
    expect(hasTemplateTags('{{slug}}/index')).toBe(true);
    expect(hasTemplateTags('{{year}}-post')).toBe(true);
  });

  test('should return true for multiple template tags', () => {
    expect(hasTemplateTags('{{year}}-{{month}}-{{day}}')).toBe(true);
    expect(hasTemplateTags('{{category}}/{{slug}}')).toBe(true);
    expect(hasTemplateTags('{{fields.title}}-{{uuid}}')).toBe(true);
  });

  test('should return true for template tag with nested content', () => {
    expect(hasTemplateTags('{{fields.title}}')).toBe(true);
    expect(hasTemplateTags('{{fields.author | default("fallback")}}')).toBe(true);
    expect(hasTemplateTags("{{title | date('YYYY-MM-DD')}}")).toBe(true);
  });

  test('should return false for string without template tags', () => {
    expect(hasTemplateTags('just a plain string')).toBe(false);
    expect(hasTemplateTags('no-templates-here')).toBe(false);
    expect(hasTemplateTags('Hello World')).toBe(false);
  });

  test('should return false for empty string', () => {
    expect(hasTemplateTags('')).toBe(false);
  });

  test('should return false for whitespace only', () => {
    expect(hasTemplateTags('   ')).toBe(false);
    expect(hasTemplateTags('\t')).toBe(false);
    expect(hasTemplateTags('\n')).toBe(false);
  });

  test('should return false for incomplete template tags', () => {
    expect(hasTemplateTags('{{title')).toBe(false);
    expect(hasTemplateTags('title}}')).toBe(false);
    expect(hasTemplateTags('{title}')).toBe(false);
  });

  test('should return false for empty braces', () => {
    expect(hasTemplateTags('{{}}')).toBe(false);
    expect(hasTemplateTags('prefix-{{}}')).toBe(false);
  });

  test('should handle the negative lookahead case correctly', () => {
    expect(hasTemplateTags("{{fields.slug | default('{{fields.title}}')}}")).toBe(true);
    expect(hasTemplateTags("test')")).toBe(false);
  });

  test('should handle special characters in template tags', () => {
    expect(hasTemplateTags('{{slug-with-dash}}')).toBe(true);
    expect(hasTemplateTags('{{slug_with_underscore}}')).toBe(true);
    expect(hasTemplateTags('{{slug.with.dots}}')).toBe(true);
  });

  test('should handle spaces inside template tags', () => {
    expect(hasTemplateTags('{{ title }}')).toBe(true);
    expect(hasTemplateTags('{{  slug  }}')).toBe(true);
    expect(hasTemplateTags('{{ fields.author }}')).toBe(true);
  });

  test('should return true for paths with template tags', () => {
    expect(hasTemplateTags('content/{{year}}/{{month}}/post.md')).toBe(true);
    expect(hasTemplateTags('{{dirname}}/{{filename}}.{{extension}}')).toBe(true);
  });

  test('should return true for template tags with transformations', () => {
    expect(hasTemplateTags('{{title | upper}}')).toBe(true);
    expect(hasTemplateTags("{{published | date('MMM D, YYYY')}}")).toBe(true);
    expect(hasTemplateTags('{{name | truncate(20)}}')).toBe(true);
    expect(hasTemplateTags("{{author | default('Unknown')}}")).toBe(true);
  });

  test('should return false for single braces', () => {
    expect(hasTemplateTags('{title}')).toBe(false);
    expect(hasTemplateTags('{slug}')).toBe(false);
  });

  test('should return false for mismatched braces', () => {
    expect(hasTemplateTags('{{title}')).toBe(false);
    expect(hasTemplateTags('{slug}}')).toBe(false);
  });

  test('should handle mixed content with and without tags', () => {
    expect(hasTemplateTags('static-{{dynamic}}-static')).toBe(true);
    expect(hasTemplateTags('2024-{{month}}-{{day}}')).toBe(true);
  });

  test('should return true for UUID tags', () => {
    expect(hasTemplateTags('{{uuid}}')).toBe(true);
    expect(hasTemplateTags('{{uuid_short}}')).toBe(true);
    expect(hasTemplateTags('{{uuid_shorter}}')).toBe(true);
  });

  test('should return true for datetime tags', () => {
    expect(hasTemplateTags('{{year}}')).toBe(true);
    expect(hasTemplateTags('{{month}}')).toBe(true);
    expect(hasTemplateTags('{{day}}')).toBe(true);
    expect(hasTemplateTags('{{hour}}')).toBe(true);
    expect(hasTemplateTags('{{minute}}')).toBe(true);
    expect(hasTemplateTags('{{second}}')).toBe(true);
  });

  test('should return true for file path tags', () => {
    expect(hasTemplateTags('{{dirname}}')).toBe(true);
    expect(hasTemplateTags('{{filename}}')).toBe(true);
    expect(hasTemplateTags('{{extension}}')).toBe(true);
  });

  test('should return true for locale tag', () => {
    expect(hasTemplateTags('{{locale}}')).toBe(true);
  });

  test('should return false for literal brace patterns', () => {
    expect(hasTemplateTags('{{{')).toBe(false);
    expect(hasTemplateTags('}}}')).toBe(false);
    expect(hasTemplateTags('{{}}')).toBe(false);
  });

  test('should handle very long template tags', () => {
    const longTag = `{{${'a'.repeat(1000)}}}`;

    expect(hasTemplateTags(longTag)).toBe(true);
  });

  test('should handle regex special characters in surrounding text', () => {
    expect(hasTemplateTags('file.name-{{slug}}.txt')).toBe(true);
    expect(hasTemplateTags('path/to/{{title}}/index')).toBe(true);
    expect(hasTemplateTags('[{{slug}}]')).toBe(true);
  });

  test('should work with newlines and special whitespace', () => {
    expect(hasTemplateTags('line1\n{{title}}\nline2')).toBe(true);
    expect(hasTemplateTags('tab\t{{slug}}\ttab')).toBe(true);
  });
});

describe('replaceTemplateTags()', () => {
  /**
   * Replace the template tags in the given string with markers.
   * @param {string} str String.
   * @returns {string} Result.
   */
  const replace = (str) => replaceTemplateTags(str, (_match, tag) => `<<${tag}>>`);

  test('should not take an apostrophe in a transformation argument as a quote', () => {
    expect(replace("{{title | default('Don't')}} {{body}}")).toBe(
      "<<title | default('Don't')>> <<body>>",
    );
    expect(replace("{{draft | ternary('It's a draft' , 'Isn't')}} {{body}}")).toBe(
      "<<draft | ternary('It's a draft' , 'Isn't')>> <<body>>",
    );
  });

  test('should not take an apostrophe outside a transformation argument as a quote', () => {
    expect(replace("{{it's}} {{body}}")).toBe("<<it's>> <<body>>");
  });

  test('should keep closing braces in a quoted transformation argument', () => {
    expect(replace("{{title | default( '}}' )}} {{body}}")).toBe(
      "<<title | default( '}}' )>> <<body>>",
    );
  });

  test('should replace a quoted tag in the literal text', () => {
    expect(replace("{{title}} ('{{nickname}}')")).toBe("<<title>> ('<<nickname>>')");
    expect(replace("['{{lang}}']")).toBe("['<<lang>>']");
    expect(replace(",'{{x}}',")).toBe(",'<<x>>',");
    expect(replace("|'{{x}}')")).toBe("|'<<x>>')");
  });

  test('should keep a tag nested in a transformation argument in the outer tag', () => {
    expect(replace("{{title | default('{{slug}}')}} ('{{nickname}}')")).toBe(
      "<<title | default('{{slug}}')>> ('<<nickname>>')",
    );
    expect(replace("{{a | ternary( '{{b}}' , '{{c}}' )}}")).toBe(
      "<<a | ternary( '{{b}}' , '{{c}}' )>>",
    );
  });

  test('should leave an unterminated template tag unchanged', () => {
    expect(replace("{{title | default('x'")).toBe("{{title | default('x'");
  });
});

describe('splitTemplateTags()', () => {
  test('should split a template into its tags and the literal text around them', () => {
    expect(splitTemplateTags('posts-{{fields.title | upper}}/{{uuid}}.md')).toEqual({
      tags: ['fields.title | upper', 'uuid'],
      literals: ['posts-', '/', '.md'],
    });
    expect(splitTemplateTags('{{a}}{{b}}')).toEqual({ tags: ['a', 'b'], literals: ['', '', ''] });
  });

  test('should return the whole template as a literal if it has no tag', () => {
    expect(splitTemplateTags('')).toEqual({ tags: [], literals: [''] });
    expect(splitTemplateTags('plain {{}} text')).toEqual({
      tags: [],
      literals: ['plain {{}} text'],
    });
  });

  test('should leave a nested tag in a transformation argument in the tag', () => {
    expect(splitTemplateTags("x{{fields.a | default('{{fields.b}}')}}y")).toEqual({
      tags: ["fields.a | default('{{fields.b}}')"],
      literals: ['x', 'y'],
    });
  });
});
