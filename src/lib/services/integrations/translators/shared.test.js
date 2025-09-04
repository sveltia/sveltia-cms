import { describe, expect, it, vi } from 'vitest';

import { createTranslationSystemPrompt, createTranslationUserPrompt } from './shared.js';

// Mock the getLocaleLabel function
vi.mock('$lib/services/contents/i18n', () => ({
  getLocaleLabel: vi.fn((locale) => {
    /** @type {Record<string, string>} */
    const labels = {
      en: 'English',
      fr: 'French',
      de: 'German',
      es: 'Spanish',
      zh: 'Chinese',
      ja: 'Japanese',
    };

    return labels[locale] || locale;
  }),
}));

describe('Translation Shared Utilities', () => {
  describe('createTranslationSystemPrompt', () => {
    it('should create a system prompt with all instructions', () => {
      const prompt = createTranslationSystemPrompt('en', 'fr');

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
      expect(prompt).toContain('"translations" array');
      expect(prompt).toContain(
        '{\n  "translations": ["translated text 1", "translated text 2", ...]\n}',
      );
    });

    it('should handle different language pairs correctly', () => {
      const prompt = createTranslationSystemPrompt('de', 'ja');

      expect(prompt).toContain('German to Japanese');
    });

    it('should handle unknown languages by using the language code as fallback', () => {
      const prompt = createTranslationSystemPrompt('unknown', 'fr');

      expect(prompt).toContain('unknown to French');
    });
  });

  describe('createTranslationUserPrompt', () => {
    it('should create a user prompt with single text', () => {
      const texts = ['Hello world'];
      const prompt = createTranslationUserPrompt(texts);

      expect(prompt).toBe('Translate these texts:\n["Hello world"]');
    });

    it('should create a user prompt with multiple texts', () => {
      const texts = ['Hello world', 'How are you?', 'Good morning'];
      const prompt = createTranslationUserPrompt(texts);

      expect(prompt).toBe('Translate these texts:\n["Hello world","How are you?","Good morning"]');
    });

    it('should handle empty array', () => {
      /** @type {string[]} */
      const texts = [];
      const prompt = createTranslationUserPrompt(texts);

      expect(prompt).toBe('Translate these texts:\n[]');
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
      const systemPrompt = createTranslationSystemPrompt('en', 'fr');
      const userPrompt = createTranslationUserPrompt(['Hello', 'World']);

      expect(systemPrompt).toContain('English to French');
      expect(userPrompt).toContain('["Hello","World"]');
      // Both should reference the same JSON structure
      expect(systemPrompt).toContain('"translations"');
      expect(userPrompt).toContain('Translate these texts:');
    });

    it('should handle markdown and HTML preservation instructions', () => {
      const prompt = createTranslationSystemPrompt('en', 'fr');

      expect(prompt).toContain(
        'markdown formatting (headers, links, bold, italic, code blocks, lists, etc.)',
      );
      expect(prompt).toContain('HTML tags and attributes exactly as they are');
      expect(prompt).toContain('original structure and formatting');
    });

    it('should include code and technical content preservation instructions', () => {
      const prompt = createTranslationSystemPrompt('en', 'fr');

      expect(prompt).toContain('Do not translate code content within code blocks or inline code');
      expect(prompt).toContain('Do not translate URLs, email addresses, or technical identifiers');
    });

    it('should include translation skip instructions for comments and notranslate elements', () => {
      const prompt = createTranslationSystemPrompt('en', 'fr');

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
