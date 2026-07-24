# Localizing Sveltia CMS

Thank you for your interest in translating the Sveltia CMS user interface! Here’s a guide to help you get started with localizing the application.

## Quick Start

1. **Check existing translations**: See if your language is already on the [waiting list](https://github.com/sveltia/sveltia-cms/labels/l10n) or [already translated](https://github.com/sveltia/sveltia-cms/tree/main/src/lib/locales).
2. **File an issue**: [Create a new issue](https://github.com/sveltia/sveltia-cms/issues/new?type=task&labels=l10n) with your language code (e.g., “French localization”).
   - **This is required** — pull requests (PRs) without issues will be closed to prevent duplicate effort.
   - If you want us to provide an AI-generated draft translation for your language, please request it in your issue.
3. **Translate both repositories**:
   - [Sveltia UI strings](https://raw.githubusercontent.com/sveltia/sveltia-ui/refs/heads/main/src/lib/locales/en-US.yaml) → [upload it](https://github.com/sveltia/sveltia-ui/upload/main/src/lib/locales) or clone [the repo](https://github.com/sveltia/sveltia-ui) to submit a PR
   - [Sveltia CMS strings](https://raw.githubusercontent.com/sveltia/sveltia-cms/refs/heads/main/src/lib/locales/en-US.yaml) → [upload it](https://github.com/sveltia/sveltia-cms/upload/main/src/lib/locales) or clone [the repo](https://github.com/sveltia/sveltia-cms) to submit a PR
   - **PR title**: “Add [language] localization” (e.g., “Add French localization”) or “Update [language] localization” if updating an existing translation.
   - If you’re not familiar with PRs, simply attach your translated YAML files to your issue and we’ll merge them for you.
4. **Get reviewed**: We’ll review your translations and provide feedback if necessary. Once approved, they’ll be merged and included in the next release.

## Requirements

- **Native speaker**: We want accurate, natural translations. If you’re not a native speaker of the target language, please collaborate with someone who is.
- **Quality check**: Review and edit for accuracy and context, especially if using AI translation tools.

## Technical Guidelines

### File Structure

- Localization files use [YAML](https://en.wikipedia.org/wiki/YAML) format, organized by [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) language codes (e.g., `en-US.yaml`, `ja.yaml`).
- Follow [Firefox l10n conventions](https://github.com/mozilla-l10n/firefox-l10n) for language codes: use short codes where possible (e.g., `ko` not `ko-KR`, `fr` not `fr-FR`). Otherwise, use the full code (e.g., `en-US`, `pt-BR`).
- Use UTF-8 encoding and LF line endings (Unix format).

### YAML Formatting

- **Indentation**: Maintain correct YAML indentation for hierarchy.
- **Comments**: Preserve all comments — they provide context for translators. Don’t translate them.
- **Quotes**: Use single quotes only when YAML requires them (e.g., for colons or brackets). Otherwise omit: `key: value` not `key: 'value'`.
- **Typographic quotes**: Use [curly quotes](https://typographyforlawyers.com/straight-and-curly-quotes.html) (“ ”) for content if your language uses them, but straight quotes (" ") for code snippets and technical terms, just like the original English files.
- **Preserve formatting**: Keep any HTML or Markdown formatting (links, code snippets, etc.).

### MessageFormat 2 Syntax

- Strings use [Unicode MessageFormat 2](https://messageformat.unicode.org/) (MF2) for pluralization and gender-specific translations.
- Use correct [pluralization rules](https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html) for your language to add the necessary plural forms in your translation. Some languages have multiple plural forms (e.g., Arabic, Polish, Russian), while others have only one (e.g., Chinese, Japanese).
- Refer to the [MF2 translator guide](https://messageformat.unicode.org/docs/translators/) and [Sveltia I18n documentation](https://github.com/sveltia/sveltia-i18n#message-format) for syntax details.

### Language & Tone

- Use neutral, inclusive language.
- Avoid gendered terms and stereotypes.
- Be mindful of cultural sensitivities.

### Other Notes

- RTL (right-to-left) languages are supported. The CMS automatically adjusts the layout based on the language direction.

## Maintenance & Support

- **Updates**: We periodically sync new English strings and notify translators of changes needed.
- **Questions?**: Comment on your issue or ping [@kyoshino](https://github.com/kyoshino). We’re here to help!
- **Feedback**: We’re exploring more efficient translation management tools and welcome your suggestions.
