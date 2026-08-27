# Localizing Sveltia CMS

Thank you for your interest in translating the Sveltia CMS user interface! Here’s a guide to help you get started with localizing the application.

## Requirements

- **GitHub account**: For now, we only accept contributions via GitHub pull requests (PRs).
- **Regular CMS user**: You must either be an active user of Sveltia CMS or a developer who implements it.
- **Language proficiency**: You must either be a native speaker of the target language or have professional-level proficiency in it.
- **Assignee**: As described below, you need to file an issue, if one doesn’t already exist, and get assigned to it. To prevent unnecessary duplication of effort, PRs that are not linked to an issue or sent by unassigned people will not be accepted.
- **Quality check**: Review and edit your translations for accuracy and context, especially if you have used an AI translation tool. Remember that AI can make mistakes, particularly with short phrases or technical terms.

## Steps to Contribute

1. **Check existing translations**: See if your language is on the [waiting list](https://github.com/sveltia/sveltia-cms/issues?q=is%3Aissue%20state%3Aopen%20label%3Al10n) or [already translated](https://sveltiacms.app/en/docs/ui#localization).
2. **File an issue**: [Create a new issue](https://github.com/sveltia/sveltia-cms/issues/new?type=feature&labels=l10n) with your language name (e.g., “French localization”) and get assigned by the maintainer.
   - If you want us to provide an AI-generated draft translation for your language, please request it in your issue.
3. **Translate two files**:
   - [Sveltia UI strings](https://raw.githubusercontent.com/sveltia/sveltia-ui/e3655496eb2c548d7b965da991b9f3548269ecec/src/lib/locales/en-US.yaml) → fork [the repo](https://github.com/sveltia/sveltia-ui) and submit a PR using the [uploader](https://github.com/sveltia/sveltia-ui/new/main/src/lib/locales) or your favourite tool
   - [Sveltia CMS strings](https://raw.githubusercontent.com/sveltia/sveltia-cms/1295bf44e4e833dcf6d626d6e20198df12f877a3/src/lib/locales/en-US.yaml) → fork [the repo](https://github.com/sveltia/sveltia-cms) and submit a PR using the [uploader](https://github.com/sveltia/sveltia-cms/new/main/src/lib/locales) or your favourite tool
   - **PR title**: “Add [language] localization” (e.g., “Add French localization”) or “Update [language] localization” if updating an existing translation.
4. **Get reviewed**: We’ll review your translations and provide feedback if necessary.
   - We can check your translated files for YAML and MF2 syntax errors, but we can’t review the quality of the translation as we don’t speak your language. If you want, ask other native speakers to review your translation on your pull request, issue or in your own community.
   - Once approved, they’ll be merged and included in the next release.

## Technical Guidelines

### File Structure

- Localization files use [YAML](https://en.wikipedia.org/wiki/YAML) format, organized by [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) language codes (e.g., `en-US.yaml`, `ja.yaml`).
- Follow [Firefox l10n conventions](https://github.com/mozilla-l10n/firefox-l10n) for language codes: use short codes where possible (e.g., `ko` not `ko-KR`, `fr` not `fr-FR`). Otherwise, use the full code (e.g., `en-US`, `pt-BR`).
- Use UTF-8 encoding and LF line endings (Unix format).
- Add a trailing newline at the end of the file.

### YAML Formatting

- If you use VS Code, install the [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) for syntax highlighting and validation.
- **Indentation**: Maintain correct YAML indentation for hierarchy.
- **Comments**: Preserve all comments — they provide context for translators. Don’t translate or delete them.
- **Quotes**: Use single quotes only when YAML requires them (e.g., for colons or brackets). Otherwise omit: `key: value` not `key: 'value'`.
- **Typographic quotes**: Use [curly quotes](https://typographyforlawyers.com/straight-and-curly-quotes.html) (“ ”) for content if your language uses them, but straight quotes (" ") for code snippets and technical terms, just like the original English files. Note that Claude does not use curly quotes by default, so you have to specify the usage in your prompt.
- **Preserve formatting**: Keep any HTML or Markdown formatting (links, code snippets, etc.).

### MessageFormat 2 Syntax

- Strings use [Unicode MessageFormat 2](https://messageformat.unicode.org/) (MF2) for pluralization and gender-specific translations.
- Use correct [pluralization rules](https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html) for your language to add the necessary plural forms in your translation. Some languages have multiple plural forms (e.g., Arabic, Polish, Russian), while others have only one (e.g., Chinese, Japanese).
- **Use only the plural categories your language actually has.** A category name your language doesn’t use — such as `one` in Chinese, Japanese, Korean or Vietnamese — never matches, so that variant is silently dead and every count falls through to `*`. Copying the English file’s `one` variant is the usual way this slips in.
- **To vary the wording at a specific count, select on the value instead of a category.** If your language has only `other` but you still want different wording for a single item, use `1` rather than `one`. A literal key takes precedence over a category key, so it works in any language:
  ```
  .input {$count :integer}
  .match $count
    1   {{ 이 폴더에 “{$name}” 파일이 이미 있습니다. 교체하시겠습니까? }}
    *   {{ 이 폴더에 이름이 같은 파일 {$count}개가 이미 있습니다. 교체하시겠습니까? }}
  ```
  Reach for a literal only when your language lacks the category. Where a category exists, prefer it: Polish or Russian `one` also covers 21, 31, 101 and so on, which a literal `1` would miss.
- Refer to the [MF2 translator guide](https://messageformat.unicode.org/docs/translators/) and [Sveltia I18n documentation](https://github.com/sveltia/sveltia-i18n#message-format) for syntax details.

### Language & Tone

- Use neutral, inclusive language.
- Avoid gendered terms and stereotypes.
- Be mindful of cultural sensitivities.

## Maintenance & Support

- **Updates**: We periodically sync new English strings and notify translators of changes needed.
- **Questions?** Comment on your issue or ping [@kyoshino](https://github.com/kyoshino). We’re here to help!
- **Feedback**: We’re exploring more efficient translation management tools and welcome your suggestions.

## Other Notes

- There is no easy way to test translations in the CMS UI yet. We’ll provide a preview feature in the future.
- RTL (right-to-left) languages are supported. The CMS automatically adjusts the layout based on the language direction.
