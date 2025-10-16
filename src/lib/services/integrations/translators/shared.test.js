import { describe, expect, it, vi } from 'vitest';

import {
  createTranslationSystemPrompt,
  createTranslationUserPrompt,
  normalizeLanguage,
} from './shared.js';

// Mock the i18n functions
vi.mock('$lib/services/contents/i18n', () => ({
  getLocaleLabel: vi.fn((locale, options) => {
    // Normalize locale code (handle both - and _ separators, case variations)
    const normalizedLocale = String(locale || '')
      .toLowerCase()
      .replace(/_/g, '-');

    /** @type {Record<string, string>} */
    const labels = {
      // Base languages
      en: 'English',
      fr: 'French',
      de: 'German',
      es: 'Spanish',
      zh: 'Chinese',
      ja: 'Japanese',
      pt: 'Portuguese',
      // Regional variants
      'en-ca': 'Canadian English',
      'en-us': 'American English',
      'en-gb': 'British English',
      'fr-ca': 'Canadian French',
      'fr-fr': 'French (France)',
      'zh-cn': 'Chinese (China)',
      'zh-tw': 'Chinese (Taiwan)',
      'pt-br': 'Brazilian Portuguese',
      'pt-pt': 'European Portuguese',
      'es-mx': 'Mexican Spanish',
      'es-es': 'Spanish (Spain)',
      'de-de': 'German (Germany)',
      'de-at': 'Austrian German',
    };

    // When displayLocale is 'en', undefined, or not provided, return the English name
    if (!options || !options.displayLocale || options.displayLocale === 'en') {
      return labels[normalizedLocale] || undefined;
    }

    // Otherwise return the label or the locale itself (for other display locales)
    return labels[normalizedLocale] || locale;
  }),
}));

describe('Translation Shared Utilities', () => {
  describe('normalizeLanguage', () => {
    it('should return language label for supported locales', () => {
      expect(normalizeLanguage('en')).toBe('English');
      expect(normalizeLanguage('fr')).toBe('French');
      expect(normalizeLanguage('de')).toBe('German');
      expect(normalizeLanguage('es')).toBe('Spanish');
      expect(normalizeLanguage('zh')).toBe('Chinese');
      expect(normalizeLanguage('ja')).toBe('Japanese');
      expect(normalizeLanguage('pt')).toBe('Portuguese');
    });

    it('should return regional language labels for locale codes with regions', () => {
      expect(normalizeLanguage('en-CA')).toBe('Canadian English');
      expect(normalizeLanguage('en-US')).toBe('American English');
      expect(normalizeLanguage('en-GB')).toBe('British English');
      expect(normalizeLanguage('fr-CA')).toBe('Canadian French');
      expect(normalizeLanguage('fr-FR')).toBe('French (France)');
      expect(normalizeLanguage('zh-CN')).toBe('Chinese (China)');
      expect(normalizeLanguage('zh-TW')).toBe('Chinese (Taiwan)');
      expect(normalizeLanguage('pt-BR')).toBe('Brazilian Portuguese');
      expect(normalizeLanguage('pt-PT')).toBe('European Portuguese');
    });

    it('should handle case variations in locale codes', () => {
      expect(normalizeLanguage('EN')).toBe('English');
      expect(normalizeLanguage('En-Ca')).toBe('Canadian English');
      expect(normalizeLanguage('FR-ca')).toBe('Canadian French');
      expect(normalizeLanguage('ZH-CN')).toBe('Chinese (China)');
    });

    it('should handle underscore separators in locale codes', () => {
      expect(normalizeLanguage('en_CA')).toBe('Canadian English');
      expect(normalizeLanguage('fr_CA')).toBe('Canadian French');
      expect(normalizeLanguage('pt_BR')).toBe('Brazilian Portuguese');
    });

    it('should return undefined for unsupported locales', () => {
      expect(normalizeLanguage('unsupported')).toBeUndefined();
      expect(normalizeLanguage('xyz')).toBeUndefined();
      expect(normalizeLanguage('')).toBeUndefined();
      expect(normalizeLanguage('en-XX')).toBeUndefined();
    });
  });

  describe('createTranslationSystemPrompt', () => {
    it('should create a system prompt with all instructions', () => {
      const prompt = createTranslationSystemPrompt('English', 'French');

      expect(prompt).toContain('You are a professional translator');
      expect(prompt).toContain('English to French');
      expect(prompt).toContain(
        'CRITICAL: Leave content EXACTLY unchanged within HTML elements that have translate="no"',
      );
      expect(prompt).toContain(
        'CRITICAL: Leave content EXACTLY unchanged within HTML elements that have class="notranslate"',
      );
      expect(prompt).toContain(
        'CRITICAL: Leave content EXACTLY unchanged between "notranslate" and "/notranslate" comments',
      );
      expect(prompt).toContain('Preserve all markdown formatting');
      expect(prompt).toContain('Preserve all HTML tags and attributes');
      expect(prompt).toContain('Do not translate code content');
      expect(prompt).toContain('Do not translate URLs, email addresses');
      expect(prompt).toContain('Do not split translations into separate paragraphs');
      expect(prompt).toContain('Keep each translation as a single continuous text');
      expect(prompt).toContain('valid JSON array');
      expect(prompt).toContain('["translation 1", "translation 2", ...]');
      expect(prompt).toContain('Output ONLY valid JSON');
      expect(prompt).toContain('Do NOT use markdown code blocks');
    });
  });

  describe('createTranslationUserPrompt', () => {
    it('should create a user prompt with single text', () => {
      const texts = ['Hello world'];
      const prompt = createTranslationUserPrompt(texts);

      expect(prompt).toContain('["Hello world"]');
      expect(prompt).toContain('ONLY valid JSON');
      expect(prompt).toContain('Respond with JSON only');
    });

    it('should create a user prompt with multiple texts', () => {
      const texts = ['Hello world', 'How are you?', 'Good morning'];
      const prompt = createTranslationUserPrompt(texts);

      expect(prompt).toContain('["Hello world","How are you?","Good morning"]');
      expect(prompt).toContain('ONLY valid JSON');
    });

    it('should handle empty array', () => {
      /** @type {string[]} */
      const texts = [];
      const prompt = createTranslationUserPrompt(texts);

      expect(prompt).toContain('[]');
      expect(prompt).toContain('ONLY valid JSON');
    });

    it('should properly escape JSON content', () => {
      const texts = ['Hello "world"', 'Line\nbreak', 'Tab\ttab'];
      const prompt = createTranslationUserPrompt(texts);

      expect(prompt).toContain('"Hello \\"world\\""');
      expect(prompt).toContain('"Line\\nbreak"');
      expect(prompt).toContain('"Tab\\ttab"');
    });
  });

  describe('Integration', () => {
    it('should produce prompts that work together', () => {
      const systemPrompt = createTranslationSystemPrompt('English', 'French');
      const userPrompt = createTranslationUserPrompt(['Hello', 'World']);

      expect(systemPrompt).toContain('English to French');
      expect(userPrompt).toContain('["Hello","World"]');
      // Both should reference JSON format requirements
      expect(systemPrompt).toContain('valid JSON array');
      expect(systemPrompt).toContain('Output ONLY valid JSON');
      expect(userPrompt).toContain('ONLY valid JSON');
    });

    it('should handle markdown and HTML preservation instructions', () => {
      const prompt = createTranslationSystemPrompt('English', 'French');

      expect(prompt).toContain(
        'markdown formatting (headers, links, bold, italic, code blocks, lists, etc.)',
      );
      expect(prompt).toContain('HTML tags and attributes exactly as they are');
      expect(prompt).toContain('original structure and formatting');
    });

    it('should include code and technical content preservation instructions', () => {
      const prompt = createTranslationSystemPrompt('English', 'French');

      expect(prompt).toContain('Do not translate code content within code blocks or inline code');
      expect(prompt).toContain('Do not translate URLs, email addresses, or technical identifiers');
    });

    it('should include translation skip instructions for comments and notranslate elements', () => {
      const prompt = createTranslationSystemPrompt('English', 'French');

      expect(prompt).toContain(
        'CRITICAL: Leave content EXACTLY unchanged within HTML elements that have translate="no"',
      );
      expect(prompt).toContain(
        'CRITICAL: Leave content EXACTLY unchanged within HTML elements that have class="notranslate"',
      );
      expect(prompt).toContain(
        'CRITICAL: Leave content EXACTLY unchanged between "notranslate" and "/notranslate" comments',
      );
    });
  });
});
