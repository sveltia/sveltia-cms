# Localizing Sveltia CMS

Thank you for your interest in translating the Sveltia CMS user interface! While we’re happy to have you on board, for various reasons these strings are not yet ready for localization:

- Most of the strings are unorganized or unpolished.
- Many strings, including configuration error messages and invisible labels for screen readers, will still be added before the 1.0 release as we implement some missing features.
- We’ll soon be migrating from the [`svelte-i18n`](https://github.com/kaisermann/svelte-i18n) library to our own `sveltia-i18n` library to better handle singular/plural forms and even more complex grammars.
  - `sveltia-i18n` utilizes the [`messageformat`](https://github.com/messageformat/messageformat) library, which follows the new [MessageFormat 2](https://github.com/unicode-org/message-format-wg) spec.
  - It means that the file format, currently a JavaScript file, will change completely.
  - Previous versions of this README mentioned [Fluent](https://projectfluent.org/), which was developed by [Mozilla](https://www.mozilla.org/) for Firefox and other products. However, since Fluent is being succeeded by the MF2 standard, we have decided to use the latter for forward compatibility.
- Some strings are difficult to translate without context.
- Some strings are provided by the [`sveltia-ui`](https://github.com/sveltia/sveltia-ui) library, which also needs to be migrated to `sveltia-i18n`.

The existing Japanese localization is provided for the [maintainer](https://github.com/kyoshino)’s Japanese clients.

If your language is not yet on the [waiting list](https://github.com/sveltia/sveltia-cms/labels/l10n) and you’d like to localize the app, feel free to [file a new issue](https://github.com/sveltia/sveltia-cms/issues/new?type=task&labels=l10n) so we can ping you when we reach the 1.0 string freeze!
