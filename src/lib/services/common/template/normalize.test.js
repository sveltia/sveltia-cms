import { describe, expect, test } from 'vitest';

import { normalizeTemplateTags } from './normalize';

describe('normalizeTemplateTags()', () => {
  test('removes the spaces inside the curly braces', () => {
    expect(normalizeTemplateTags('{{ slug }}')).toBe('{{slug}}');
    expect(normalizeTemplateTags('{{  year }}-{{month  }}/{{ fields.title }}')).toBe(
      '{{year}}-{{month}}/{{fields.title}}',
    );
    expect(normalizeTemplateTags('{{\n  title\n}}')).toBe('{{title}}');
  });

  test('puts a single space on either side of each pipe', () => {
    expect(normalizeTemplateTags('{{ title|upper }}')).toBe('{{title | upper}}');
    expect(normalizeTemplateTags("{{date  |  date('YYYY')|lower}}")).toBe(
      "{{date | date('YYYY') | lower}}",
    );
  });

  test('keeps the spaces and pipes in a quoted transformation argument', () => {
    expect(normalizeTemplateTags("{{ title | default(' A | B ') }}")).toBe(
      "{{title | default(' A | B ')}}",
    );
    expect(normalizeTemplateTags("{{ title | default('{{ slug }}') }}")).toBe(
      "{{title | default('{{ slug }}')}}",
    );
  });

  test('keeps the text around the tags', () => {
    expect(normalizeTemplateTags(' posts / {{ slug }} ')).toBe(' posts / {{slug}} ');
  });

  test('keeps an escaped tag and its backslash', () => {
    expect(normalizeTemplateTags('\\{{ title | slugify }}/{{ slug }}')).toBe(
      '\\{{ title | slugify }}/{{slug}}',
    );
  });

  test('returns a string without tags as is', () => {
    expect(normalizeTemplateTags('posts')).toBe('posts');
    expect(normalizeTemplateTags('{{title')).toBe('{{title');
    expect(normalizeTemplateTags('{{}}')).toBe('{{}}');
  });
});
