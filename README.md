# Sveltia CMS

Sveltia CMS is a Git-based lightweight headless CMS under active development as a modern, powerful, quick replacement for Netlify CMS and Decap CMS. In some simple cases, migration is as easy as a single line of code change, although we are still working on improving compatibility.

The free, open source alternative to Netlify/Decap CMS is now in public beta, turbocharged with great UX, performance, i18n support and so many more enhancements.

![Screenshot: Open Source Git-based Headless CMS](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-1-20240507.webp)<br>

![Screenshot: Fast and Lightweight; Modern UX with Dark Mode](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-2-20240507.webp)<br>

![Screenshot: Stock Photo Integration with Pexels, Pixabay and Unsplash](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-3-20240507.webp)<br>

![Screenshot: All-New Asset Library; First Class I18n Support with DeepL](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-4-20240507.webp)<br>

![Screenshot: Works with Remote (GitHub, GitLab) and Local Repositories; Single Line Migration from Netlify/Decap CMS (depending on your current setup); Sveltia CMS](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-5-20240507.webp)<br>

## Table of contents

- [Motivation](#motivation)
  - [Our advantage](#our-advantage)
  - [Our goals](#our-goals)
- [Development status](#development-status)
- [Differentiators](#differentiators)
  - [Better UX](#better-ux)
  - [Better performance](#better-performance)
  - [Better productivity](#better-productivity)
  - [Better accessibility](#better-accessibility)
  - [Better security](#better-security)
  - [Better configuration](#better-configuration)
  - [Better backend support](#better-backend-support)
  - [Better i18n support](#better-i18n-support)
  - [Better collections](#better-collections)
  - [Better content editing](#better-content-editing)
  - [Better data output](#better-data-output)
  - [Better widgets](#better-widgets)
    - [New widgets](#new-widgets)
  - [Better asset management](#better-asset-management)
  - [Better customization](#better-customization)
  - [Better localization](#better-localization)
- [Compatibility](#compatibility)
  - [Features not to be implemented](#features-not-to-be-implemented)
  - [Current limitations](#current-limitations)
  - [Other notes](#other-notes)
- [Getting started](#getting-started)
  - [New users](#new-users)
  - [Migration](#migration)
    - [Migrating from Git Gateway backend](#migrating-from-git-gateway-backend)
  - [Installing with npm](#installing-with-npm)
  - [Updates](#updates)
- [Tips \& tricks](#tips--tricks)
  - [Moving your site from Netlify to another hosting service](#moving-your-site-from-netlify-to-another-hosting-service)
  - [Providing a JSON configuration file](#providing-a-json-configuration-file)
  - [Working around an authentication error](#working-around-an-authentication-error)
  - [Working with a local Git repository](#working-with-a-local-git-repository)
  - [Enabling local development in Brave](#enabling-local-development-in-brave)
  - [Using a custom icon for a collection](#using-a-custom-icon-for-a-collection)
  - [Adding dividers to the collection list](#adding-dividers-to-the-collection-list)
  - [Using a custom media folder for a collection](#using-a-custom-media-folder-for-a-collection)
  - [Using keyboard shortcuts](#using-keyboard-shortcuts)
  - [Using DeepL to translate entry fields](#using-deepl-to-translate-entry-fields)
  - [Localizing entry slugs](#localizing-entry-slugs)
  - [Disabling non-default locale content](#disabling-non-default-locale-content)
  - [Using a random ID for an entry slug](#using-a-random-id-for-an-entry-slug)
  - [Editing data files with a top-level list](#editing-data-files-with-a-top-level-list)
  - [Disabling automatic deployments](#disabling-automatic-deployments)
  - [Setting up Content Security Policy](#setting-up-content-security-policy)
- [Support \& feedback](#support--feedback)
- [Contributions](#contributions)
- [Roadmap](#roadmap)
  - [Before the 1.0 release](#before-the-10-release)
  - [After the 1.0 release](#after-the-10-release)
- [Related links](#related-links)
  - [As seen on](#as-seen-on)
- [Disclaimer](#disclaimer)

## Motivation

Sveltia CMS was born in November 2022, when the progress of Netlify CMS was stalled for more than six months. [@kyoshino](https://github.com/kyoshino)’s clients wanted to replace their Netlify CMS instances without much effort, mainly to get better internationalization (i18n) support.

To achieve radical improvements in UX, performance, i18n and other areas, it was decided to build an alternative from the ground up, while ensuring an easy migration path from the other. After proving the concept with a rapid [Svelte](https://svelte.dev/) prototype, development was accelerated to address their primary use cases. The new product has since been named Sveltia CMS and released as open source software to encourage wider adoption.

### Our advantage

Due to its unfortunate abandonment, Netlify CMS spawned 3 successors:

- [Static CMS](https://github.com/StaticJsCMS/static-cms): a community fork, initial commit made in September 2022, discontinued in September 2024
- **Sveltia CMS**: a total reboot, started in November 2022, first appeared on GitHub in March 2023
- [Decap CMS](https://github.com/decaporg/decap-cms): a rebranded version, [announced in February 2023](https://www.netlify.com/blog/netlify-cms-to-become-decap-cms/) as the official successor with a Netlify agency partner taking ownership — mostly inactive

Sveltia CMS is the only project that doesn’t inherit the complexity, technical debt and numerous bugs of Netlify CMS, which was launched back in 2015. We are confident that our decision to rebuild the application from scratch was the right one, as proven by the [hundreds of improvements](#differentiators) we have already made.

While Sveltia CMS is specifically designed to replace legacy Netlify CMS instances, it also aims to serve as a substitute for the other Netlify CMS successors. We hope that, especially with the [robust i18n support](#better-i18n-support), our product will eventually become an attractive choice for anyone looking for a free headless CMS.

### Our goals

- Making Sveltia CMS a viable, definitive successor to Netlify CMS
- Empowering small businesses and individuals who need a simple, free, yet powerful CMS solution
- Emerging as the leading open source offering in the Git-based CMS market
- Extending its capabilities as digital asset management (DAM) software
- Showcasing the power of Svelte and UX engineering

## Development status

Sveltia CMS is currently in **beta** and version 1.0 is expected to ship in **early 2025**, in time for the 10th anniversary of Netlify CMS development. Check our [release notes](https://github.com/sveltia/sveltia-cms/releases) for updates. See also our [roadmap](#roadmap).

While we fix reported bugs as quickly as possible, usually within 24 hours, our overall progress may be slower than you think. The thing is, it’s not just a personal project of [@kyoshino](https://github.com/kyoshino), but also involves different kinds of activities that require considerable effort:

- Ensuring substantial [compatibility with Netlify/Decap CMS](#compatibility)
- Tackling as many [Netlify/Decap CMS issues](https://github.com/decaporg/decap-cms/issues) as possible
  - So far, 140+ of them, or 255+ including duplicates, have been effectively solved in Sveltia CMS
  - Target: 250 or all relevant and fixable issues in a future release
  - Note: Issues include both feature requests and bug reports; we also track their [stale issues](https://github.com/decaporg/decap-cms/issues?q=is%3Aissue+%22Closing+as+stale%22) and [discussions](https://github.com/decaporg/decap-cms/discussions)
  - [Let us know](https://github.com/sveltia/sveltia-cms/issues/new?labels=enhancement) if you have any specific issues you’d like to see solved!
- Responding to feedback from [@kyoshino](https://github.com/kyoshino)’s clients and regular users
- Implementing our own enhancement ideas for every part of the product
- Making the code clean and maintainable

![140 Netlify/Decap CMS Issues Solved in Sveltia CMS](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/headline-1-20241104.webp)<br>

## Differentiators

We are working hard to create a **tremendously better alternative to Netlify CMS and Decap CMS** by improving everything. Here’s what makes Sveltia CMS different. Look how serious we are!

### Better UX

- Created and maintained by an [experienced UX engineer](https://github.com/kyoshino) who loves code, design and marketing. You can expect constant improvements to the user experience (UX) and developer experience (DX) across the platform.
- The maintainer tries to be as responsive as possible. While there are no guarantees, the typical turnaround time for a bug fix is less than 6 hours.
- Offers a modern, intuitive user interface, including an immersive dark mode[^2], inspired in part by the Netlify CMS v3 prototype[^1].
- We develop [our own UI library](https://github.com/sveltia/sveltia-ui) to ensure optimal usability without compromising accessibility.
- Comes with touch device support, such as larger buttons for easier tapping. While the UI is not yet optimized for small screens, it should work well with large tablets like iPad Pro or Pixel Tablet. Mobile support and other optimizations such as swipe navigation are planned shortly after the 1.0 release.
- Made with Svelte, not React, means we can spend more time on UX rather than tedious state management. It also allows us to avoid common React application crashes[^113][^129]. Best of all, Svelte offers great performance.
- The in-app Help menu provides all links to useful resources, including release notes, feedback and support.
- Users can personalize the application with various settings, including appearance and language. Developer Mode can also be enabled.
- Never miss out on the latest features and bug fixes by being notified when an update to the CMS is available[^31]. Then update to the latest version with a single click[^66].

### Better performance

- Built completely from scratch with Svelte instead of forking React-based Netlify/Decap CMS. The app starts fast and stays fast. The compiled code is vanilla JavaScript — you can use it with any framework or static site generator (SSG) that can load static data files during the build process.
- Small footprint: The bundle size is less than 450 KB when minified and brotlied, which is much lighter than Netlify CMS (1.5 MB), Decap CMS (1.8 MB) and Static CMS (2.6 MB)[^57][^64], even though we haven’t implemented some features yet. That’s the power of Svelte + Vite.
- We have upgraded from Svelte 4 to [Svelte 5](https://svelte.dev/blog/svelte-5-is-alive) to further improve performance, including an even smaller bundle size. A full migration to the Runes reactivity API is in progress.
- Sveltia CMS is free of technical debt and [virtual DOM overhead](https://svelte.dev/blog/virtual-dom-is-pure-overhead).
- Uses the GraphQL API for GitHub and GitLab to quickly fetch content at once, so that entries and assets can be listed and searched instantly[^32][^65] (the useless `search` configuration option is ignored). It also avoids the slowness and potential API rate limit violations caused by hundreds of requests with Relation widgets[^14].
- Saving entries and assets to GitHub is also much faster thanks to the [GraphQL mutation](https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/).
- Sorting, filtering and grouping of entries is done instantly without reloading the entire content.
- Uses caching and lazy loading techniques. A list of repository files is stored locally for faster startup and bandwidth savings.
- Thumbnails of assets, including videos and PDF files, are generated and cached for faster rendering of the Asset Library and other parts of the CMS[^39].
- No typing lag on input widgets, especially within nested lists and objects[^77].

### Better productivity

- Developers can [work with a local Git repository](#working-with-a-local-git-repository) without any extra configuration or proxy server[^26].
  - In addition to a streamlined workflow, it offers improved performance by reading and writing files natively through the browser rather than using a slow, ad hoc REST API.
  - It also avoids a number of issues, including the 30 MB file size limit[^51], an unknown error with `publish_mode`[^75], and an unused `logo_url`[^49].
  - When you delete an entry or an asset file, the empty folder that contains it is also deleted, so you don’t have to delete it manually.
- Provides a smoother user experience in the Content Editor:
  - A local backup of an entry draft is automatically created without interruption by a confirmation dialog, which annoys users and can cause a page navigation problem if dismissed[^106]. The backup can then be reliably restored without unexpected overwriting[^85].
  - Click once (the Save button) instead of twice (Publish > Publish now) to save an entry. Or just hit the `Ctrl+S` (Windows/Linux) or `Command+S` (macOS) key to save your time.
  - The editor closes automatically when an entry is saved. This behaviour can be changed in the application settings.
- Uploading files can be done with drag and drop[^20].
- Users can upload multiple files at once to the Asset Library[^5].
- Users can delete multiple entries and assets at once.
- Some [keyboard shortcuts](#using-keyboard-shortcuts) are available for faster editing.

### Better accessibility

- Improved keyboard handling lets you efficiently navigate through UI elements using the Tab, Space, Enter and arrow keys[^17][^67].
- Comprehensive [WAI-ARIA](https://w3c.github.io/aria/) support enables users who rely on screen readers such as NVDA and VoiceOver.
- The rich text editor is built with [Lexical](https://lexical.dev/), which is said to follow accessibility best practices. The [Dragon NaturallySpeaking support](https://lexical.dev/docs/packages/lexical-dragon) is enabled.
- Ensures sufficient contrast between the foreground text and background colours.
- Enabled and disabled buttons can be clearly distinguished[^105].
- Links are underlined by default to make them easier to recognize. This behaviour can be changed in the Accessibility Settings if you prefer.
- Honours your operating system’s [reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) and [reduced transparency](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency) settings. Support for [high contrast mode](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast) will be added later.
- Browser console logs for developers are readable in either light or dark mode[^116].
- We’ll continue to test and improve the application to meet [WCAG 2.2](https://w3c.github.io/wcag/guidelines/22/).

### Better security

- Avoids vulnerabilities in dependencies through constant updates, [`pnpm audit`](https://pnpm.io/cli/audit), and frequent releases, unlike Netlify/Decap CMS where a number of high severity vulnerabilities are unpatched[^33].
- We have enabled [npm package provenance](https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/).
- We have documented how to [set up a Content Security Policy](#setting-up-content-security-policy) for the CMS to prevent any unexpected errors or otherwise insecure configuration[^108].
- The `unsafe-eval` and `unsafe-inline` keywords are not needed in the `script-src` CSP directive[^34].
- The `same-origin` referrer policy is automatically set with a `<meta>` tag.
- Sveltia CMS has a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) requirement that forces the site content, including the CMS configuration file, to be served over HTTPS.
- GitHub commits are automatically GPG-signed and [marked as verified](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)[^144].

### Better configuration

- Some servers and frameworks remove the trailing slash from the CMS URL (`/admin`) depending on the configuration. In such cases, the config file is loaded from a root-relative URL (`/admin/config.yml`) instead of a regular relative URL (`./config.yml` = `/config.yml`) that results in a 404 Not Found error[^107].
- Supports a [JSON configuration file](#providing-a-json-configuration-file) that can be generated for bulk or complex collections[^60].

### Better backend support

- Uses the GraphQL API where possible for better performance, as mentioned above. You don’t need to set the `use_graphql` option to enable it for GitHub and GitLab.
- The Git branch name is automatically set to the repository’s default branch (`main`, `master` or whatever) if not specified in the configuration file, preventing data loading errors due to a hardcoded fallback to `master`[^95][^27].
- It’s possible to [disable automatic deployments](#disabling-automatic-deployments) by default or on demand to save costs and resources associated with CI/CD and to publish multiple changes at once[^24].
- The GitLab backend support comes with background [service status](https://status.gitlab.com/) checking, just like GitHub.
- Service status checks are performed frequently and an incident notification is displayed prominently.
- Users can quickly open the source file of an entry or asset in your repository using View on GitHub (or GitLab) under the 3-dot menu when Developer Mode is enabled.
- We provide [our own OAuth client](https://github.com/sveltia/sveltia-cms-auth) for GitHub and GitLab.
- Users won’t get a 404 Not Found error when you sign in to the GitLab backend[^115].
- Features the all-new local backend that boosts DX. See the [productivity section](#better-productivity) above.
- Developers can select the local and remote backends while working on a local server.

### Better i18n support

Sveltia CMS has been built with a multilingual architecture from the very beginning. You can expect best-in-class internationalization (i18n) support, as it’s required by clients of maintainer [@kyoshino](https://github.com/kyoshino), who himself was a long-time Japanese localizer for Mozilla and currently lives in a [multicultural city](https://en.wikipedia.org/wiki/Toronto) where 150+ languages are spoken.

- Configuration
  - The [i18n limitations](https://decapcms.org/docs/i18n/#limitations) in Netlify/Decap CMS do not apply to Sveltia CMS:
    - File collections support multiple files/folders i18n structures[^87]. To enable it, simply use the `{{locale}}` template tag in the `file` path option, e.g. `content/pages/about.{{locale}}.json` or `content/pages/{{locale}}/about.json`. For backward compatibility, the global `structure` option only applies to folder collections, and the default i18n structure for file collections remains single file.
    - The List and Object widgets support the `i18n: duplicate` field configuration so that changes made with these widgets are duplicated between locales[^7][^68]. The `i18n` configuration can normally be used for the subfields.
  - [Entry-relative media folders](https://decapcms.org/docs/collection-folder/#media-and-public-folder) can be used in conjunction with the `multiple_folders` i18n structure[^21].
  - The `{{locale}}` template tag can be used in the [`preview_path`](https://decapcms.org/docs/configuration-options/#preview_path) collection option to provide site preview links for each language[^63].
  - It’s possible to [use a random UUID for an entry slug](#using-a-random-id-for-an-entry-slug), which is a good option for locales that write in non-Latin characters.
  - It’s possible to [localize entry slugs](#localizing-entry-slugs) while linking the localized files[^80], thanks to the support for Hugo’s `translationKey`[^81].
  - When the `clean_accents` option is enabled for [entry slugs](https://decapcms.org/docs/configuration-options/#slug-type), certain characters, such as German umlauts, will be [transliterated](https://en.wikipedia.org/wiki/Transliteration)[^99].
  - It’s possible to embed the locale code in an entry by using `widget: hidden` along with `default: '{{locale}}'`[^101].
- User interface
  - Eliminates UI confusion: The preview pane can be displayed without toggling i18n in the Content Editor. Both panes are scrollable. There is no condition where both panes are edited in the same language at the same time.
  - Users can easily switch between locales while editing by clicking a button instead of a dropdown list.
  - Language labels appear in human-readable display names instead of ISO 639 language codes because it’s not easy for everyone to recognize `DE` as German, `NL` as Dutch, `ZH` as Chinese, and so on.
- Content editing
  - [Integrates DeepL](#using-deepl-to-translate-entry-fields) to allow translation of text fields from another locale with one click. More translation services will be added in the future.
  - The Content Editor supports [RTL scripts](https://en.wikipedia.org/wiki/Right-to-left_script) such as Arabic, Hebrew and Persian[^146].
  - It’s possible to [disable non-default locale content](#disabling-non-default-locale-content)[^15].
  - Boolean, DateTime, List and Number fields in the entry preview are displayed in a localized format.
  - Boolean fields are updated in real time between locales like other widgets to avoid confusion[^35].
  - Relation fields with i18n enabled won’t trigger a change in the content draft status when you start editing an existing entry[^84].
  - Solves problems with Chinese, Japanese and Korean (CJK) [IME](https://en.wikipedia.org/wiki/Input_method) text input in the rich text editor for the Markdown widget[^54].
  - Raises a validation error instead of failing silently if the `single_file` structure is used and a required field is not filled in any of the locales[^55].
  - Fields in non-default locales are validated as expected[^13].
  - No internal error is thrown when changing the locale[^103].

### Better collections

- Configuration
  - Provides some new options, including:
    - `icon`: [Choose a custom icon for each collection](#using-a-custom-icon-for-a-collection)[^3].
    - `divider`: [Add dividers to the collection list](#adding-dividers-to-the-collection-list).
    - `thumbnail`: Specify the field name for a thumbnail displayed on the entry list[^130]. A nested field can be specified using dot notation, e.g. `images.0.src`. If undefined, the `name` of the first image field is used.
  - Enhancements to the entry `filter` option for folder collections:
    - Boolean `value` works as expected[^93].
    - `value` accepts `null` to match an undefined field value.
    - `value` accepts an array to provide multiple possible values[^151].
    - `pattern` can be used instead of `value` to provide a regular expression, just like the `view_filters` collection option[^153].
  - Nested fields (dot notation) can be used in the `path` option for a folder collection, e.g. `{{fields.state.name}}/{{slug}}`[^62].
  - Markdown is supported in the `description` collection option[^79]. Bold, italic, strikethrough, code and links are allowed.
  - The collection `folder` can be an empty string (or `.` or `/`) if you want to store entries in the root folder. This supports a typical VitePress setup.
  - Multiple [summary string transformations](https://decapcms.org/docs/summary-strings/) can be chained like `{{title | upper | truncate(20)}}`.
- Entry slugs
  - It’s possible to [use a random UUID for an entry slug](#using-a-random-id-for-an-entry-slug).
  - Slug generation is fail-safe: If a slug cannot be determined from entry content, part of a random UUID is used instead of throwing an error or filling in with arbitrary string field values[^133].
  - If a collection only has the Markdown `body` field, an entry slug will be generated from a header in the `body`, if exists. This supports a typical VitePress setup.
  - Entry slug template tags support [transformations](https://decapcms.org/docs/summary-strings/) just like summary string template tags[^29].
  - Single quotes (apostrophes) in a slug will be replaced with `sanitize_replacement` (default: hyphen) rather than being removed[^52].
  - The maximum number of characters for an entry slug can be set with the new `slug_length` collection option to avoid deployment errors with Netlify or other platforms[^25].
  - Setting the collection `path` doesn’t affect the entry slugs stored with the Relation widget[^137].
  - Entry slugs are [localizable](#localizing-entry-slugs)[^80].
- Entry listing
  - The collection list displays the number of items in each collection.
  - Sorting entries by a DateTime field works as expected[^110].
  - Entry grouping and sorting can work together. For example, it’s possible to group by year and then sort by year if configured properly.
  - Hugo’s special `_index.md` files, including localized ones like `_index.en.md`, are ignored in folder collections unless the `path` option is configured to end with `_index` and the `extension` is `md`[^120]. You can still manage these files as part of a file collection if necessary.
  - A console error won’t be thrown when a collection doesn’t have the `title` field[^152]. In that case, an entry summary will be generated from a header in the Markdown `body` field, if exists, or from the entry slug, so the summary will never be an empty. This supports a typical VitePress setup.
  - If there was an error while parsing an entry file, such as duplicate front matter keys, it won’t show up as a blank entry, and a clear error message will be displayed in the browser console[^121].
  - In an entry summary, basic Markdown syntax used in the title, including bold, italic and code, are parsed as Markdown. HTML character references (entities) are also parsed properly[^69].
  - If you update an entry field that appears in the collection’s `summary`, such as `title`, the entry list displays an updated summary after you save the entry.
  - If entries don’t have an Image field for thumbnails, the entry list will only be displayed in list view, because it doesn’t make sense to show grid view[^143].
  - Assets stored in a [collection media folder](#using-a-custom-media-folder-for-a-collection) can be displayed next to the entries.
  - The New Entry button won’t appear when a developer accidentally sets the `create: true` option on a file collection because it’s useless[^89].
  - The Delete Entry button won’t appear when a developer accidentally sets the `delete: true` option on a file collection because the preconfigured files should not be deleted.
  - A single file can be used for more than one item in a file collection[^127].

### Better content editing

- Required fields, not optional fields, are marked for efficient data entry.
- Users can revert changes to all fields or a specific field.
- If you revert changes and there are no unsaved changes, the Save button is disabled as expected[^118].
- The preview of a specific field can be hidden with `preview: false`[^126].
- Fields with validation errors are automatically expanded if they are part of nested, collapsed objects[^40].
- When you click on a field in the preview pane, the corresponding field in the edit pane is highlighted[^41]. It will be automatically expanded if collapsed.
- The preview pane displays all fields, including each label, making it easier to see which fields are populated.
- Provides better scroll synchronization between the panes when editing or previewing an entry[^92].
- The preview pane won’t cause a scrolling issue[^136].
- A full regular expression, including flags, can be used for the widget `pattern` option[^82]. For example, if you want to allow 280 characters or less in a multiline text field, you could write `/^.{0,280}$/s` (but you can now use the `maxlength` option instead.)
- A long validation error message is displayed in full, without being hidden behind the field label[^59].
- Any links to other entries will work as expected, with the Content Editor being updated for the other[^100].
- In the Boolean and Select widgets, you don’t have to update a value twice to re-enable the Save button after saving an entry[^139].

### Better data output

- Keys in generated JSON/TOML/YAML content are always sorted by the order of configured fields, making Git commits clean and consistent[^86].
- Netlify/Decap CMS often, but not always, omits optional and empty fields from the output. Sveltia CMS aims at complete and consistent data output — it always saves proper values, such as an empty string or an empty array, instead of nothing (`undefined`), regardless of the `required` field option[^45][^46][^44].
  - In other words, in Sveltia CMS, `required: false` makes data input optional, but doesn’t make data output optional.
  - Note: If you have any data validation (type definition) that expects `undefined` values, you may need to revise it or the output from Sveitia CMS may break it.
- JSON/TOML/YAML data is saved with a new line at the end of the file to prevent unnecessary changes being made to the file[^11].
- Leading and trailing spaces in text-type field values are automatically removed when you save an entry[^37].
- String values in YAML files can be quoted with the new `yaml_quote: true` option for a collection, mainly for framework compatibility[^9].
- YAML string folding (maximum line width) is disabled, mainly for framework compatibility[^119].
- DateTime field values in ISO 8601 format are stored in native date/time format instead of quoted strings when the data output is TOML[^147].

### Better widgets

- Boolean
  - A required Boolean field with no default value is saved as `false` by default, without raising a confusing validation error[^45].
  - An optional Boolean field with no default value is also saved as `false` by default, rather than nothing[^46].
- Color
  - The widget doesn’t cause scrolling issues[^128].
  - The preview shows both the RGB(A) hex value and the `rgb()` function notation.
- DateTime
  - A DateTime field doesn’t trigger a change in the content draft status when you’ve just started editing a new entry[^90].
  - User’s local time is not saved in UTC unless the `picker_utc` option is `true`[^150].
- Hidden
  - The `default` value supports the following template tags:
    - `{{locale}}`: The current locale code[^101].
    - `{{datetime}}`: The current date/time in [ISO 8601 format](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format)[^102].
    - `{{uuid}}`, `{{uuid_short}}` and `{{uuid_shorter}}`: A random UUID or its shorter version, just like the [slug template tags](#using-a-random-id-for-an-entry-slug)[^12].
  - The `default` value is saved when you create a file collection item, not just a folder collection item[^78].
- List
  - It’s possible to [edit data files with a top-level list](#editing-data-files-with-a-top-level-list) using the new `root` option[^148].
  - The `min` and `max` options can be used separately. You don’t need to specify both to use either option[^145].
  - The Add Item button appears at the bottom of the list when the `add_to_top` option is not `true`, so you don’t have to scroll up each time to add new items.
  - Users can expand or collapse the entire list, while the Expand All and Collapse All buttons allow you to expand or collapse all items in the list at once.
  - A required List field with no subfield or value is marked as invalid[^43].
  - An optional List field with no subfield or value is saved as an empty array, rather than nothing[^44].
  - Users can enter spaces in a simple text-based List field[^50].
  - Users can preview variable types without having to register a preview template[^42].
- Markdown
  - The rich text editor is built with the well-maintained [Lexical](https://lexical.dev/) framework, which solves various issues with a [Slate](https://github.com/ianstormtaylor/slate)-based editor in Netlify/Decap CMS, including fatal application crashes[^71][^72][^73][^111], lost formatting when pasting[^124], backslash injections[^53], dropdown visibility[^70], and text input difficulties with IME[^54].
  - The built-in `image` editor component can be inserted with a single click.
  - The default editor mode can be set by changing the order of the `modes` option[^58]. If you want to use the plain text editor by default, add `modes: [raw, rich_text]` to the field configuration.
  - Line breaks are rendered as line breaks in the preview pane according to GitHub Flavored Markdown (GFM).
- Object
  - Sveltia CMS offers two ways to have conditional fields in a collection[^30]:
    - The Object widget supports [variable types](https://decapcms.org/docs/variable-type-widgets/) (the `types` option) just like the List widget.
    - An optional Object field (`required: false`) can be manually added or removed with a checkbox[^88]. If unadded or removed, the required subfields won’t trigger validation errors[^16], and the field will be saved as `null`.
- Relation
  - Field options are displayed with no additional API requests[^14]. The confusing `options_length` option, which defaults to 20, is therefore ignored[^76].
  - `slug` can be used for `value_field` to show all available options instead of just one in some situations[^91].
  - Template strings with a wildcard like `{{cities.*.name}}` can also be used for `value_field`[^94].
  - `display_fields` is displayed in the preview pane instead of `value_field`.
  - The redundant `search_fields` option is not required in Sveltia CMS, as it defaults to `display_fields` (and `value_field`).
  - A new item created in a referenced collection is immediately available in the options[^138].
- Select
  - It’s possible to select an option with value `0`[^56].
  - `label` is displayed in the preview pane instead of `value`.
- String
  - When a YouTube video URL is entered in a String field, it appears as an embedded video in the preview pane. Check your site’s [CSP](#setting-up-content-security-policy) if the preview doesn’t work.
  - When a regular URL is entered in a String field, it appears as a link that can be opened in a new browser tab.
  - Supports the `type` option that accepts `url` or `email` as a value, which will validate the value as a URL or email.
  - Supports the `prefix` and `suffix` string options, which automatically prepend and/or append the developer-defined value to the user-input value.
- Boolean, Number and String
  - Supports the `before_input` and `after_input` string options, which allow developers to display custom labels before and/or after the input UI[^28]. Markdown is supported in the value.
    - Compatibility note: In Static CMS, these options are implemented as `prefix` and `suffix`, respectively, which have different meaning in Sveltia CMS.
- File and Image
  - Provides a reimagined all-in-one asset selection dialog for File and Image fields.
    - [Collection-specific assets](#using-a-custom-media-folder-for-a-collection) are listed for easy selection, while all assets are displayed in a separate tab[^19].
    - A new asset can be uploaded by dragging & dropping it into the dialog[^20].
    - A URL can also be entered in the dialog.
    - Integration with Pexels, Pixabay and Unsplash makes it easy to select and insert a free stock photo[^8]. More stock photo providers will be added in the future.
  - Users can also simply drag and drop a file onto a File/Image field to attach it without having to open the Select File dialog.
  - Large images automatically fit in the preview pane instead of being displayed at their original size, which can easily exceed the width of the pane.
  - If the `public_folder` contains `{{slug}}` and you’ve edited a slug field (e.g. `title`) of a new entry after uploading an asset, the updated slug will be used in the saved asset path[^140]. Other dynamic template tags such as `{{filename}}` will also be populated as expected[^141].
- List and Object
  - The `summary` is displayed correctly when it refers to a Relation field[^36] or a simple List field.
  - The `summary` template tags support [transformations](https://decapcms.org/docs/summary-strings/), e.g. `{{fields.date | date('YYYY-MM-DD')}}`.
- Markdown, String and Text
  - A required field containing only spaces or line breaks will result in a validation error, as if no characters were entered.
- Relation and Select
  - If a dropdown list has options with long wrapping labels, they won’t overlap with the next option[^83].
  - When there are 5 or fewer options, the UI switches from a dropdown list to radio buttons (single-select) or checkboxes (multi-select) for faster data entry[^61]. This number can be changed with the `dropdown_threshold` option for the `relation` and `select` widgets.
- String and Text
  - Supports the `minlength` and `maxlength` options, which allow developers to specify the minimum and maximum number of characters required for input without having to write a custom regular expression with the `pattern` option. A character counter is available when one of the options is given, and a user-friendly validation error is displayed if the condition is not met.

#### New widgets

- Compute
  - The experimental `compute` widget allows to reference the value of other fields in the same collection, similar to the `summary` property for the List and Object widgets[^104]. Use the `value` property to define the value template, e.g. `posts-{{fields.slug}}` ([example](https://github.com/sveltia/sveltia-cms/issues/111)).
  - The `value` property also supports a value of `{{index}}`, which can hold the index of a list item ([example](https://github.com/sveltia/sveltia-cms/issues/172)).
- UUID
  - In addition to [generating UUIDs for entry slugs](#using-a-random-id-for-an-entry-slug), Sveltia CMS also supports the proposed `uuid` widget with the following properties[^12]:
    - `prefix`: A string to be prepended to the value. Default: an empty string.
    - `use_b32_encoding`: Whether to encode the value with Base32. Default: `false`.
    - `read_only`: Whether to make the field read-only. Default: `true`.

### Better asset management

- A completely new, full-fledged Asset Library, built separately from the image selection dialog, makes it easy to manage all of your files, including images, videos and documents[^96].
  - Navigate between the global media folder and collection media folders[^6].
  - Preview image, audio, video, text and PDF files. Check your site’s [CSP](#setting-up-content-security-policy) if the preview doesn’t work.
  - Copy the public URL[^74], file path, text data or image data of a selected asset to clipboard. The file path starts with `/` as expected[^48].
  - Edit plain text assets, including SVG images.
  - Rename existing assets. If the asset is used in any entries, the File/Image fields will be automatically updated with a new file path.
  - Replace existing assets.
  - Download one or more selected assets at once.
  - Delete one or more selected assets at once.
  - Upload multiple assets at once, including files in nested folders, by browsing or dragging and dropping them into the library[^5].
  - Sort or filter assets by name or file type.
  - View asset details, including size, dimensions, commit author/date and a list of entries that use the selected asset.
- The global `media_folder` can be an empty string (or `.` or `/`) if you want to store assets in the root folder.
- PDF documents are displayed with a thumbnail image in both the Asset Library and the Select File dialog, making it easier to find the file you’re looking for[^38].
- Assets stored in an entry-relative media folder are displayed in the Asset Library[^142].
- These entry-relative assets are automatically deleted when the associated entry is deleted because these are not available for other entries[^22]. When you’re [working with a local repository](#working-with-a-local-git-repository), the empty enclosing folder is also deleted.
- Hidden files (dot files) don’t appear in the Asset Library[^47].
- Users can add assets using the Quick Add button in the upper right corner of the application.
- Files are uploaded with their original names, without converting uppercase letters and spaces to lowercase letters and hyphens[^97].
- No fatal application crash when uploading assets[^112].

### Better customization

- The application renders within the dimensions of a [custom mount element](https://decapcms.org/docs/custom-mounting/), if exists[^109].
- A custom logo defined with the `logo_url` property is displayed on the global application header and the browser tab (favicon)[^134]. A smaller logo is also correctly positioned on the authentication page[^135].
- `CMS.registerCustomFormat()` supports async parser/formatter functions[^149].

### Better localization

- The application UI locale is automatically selected based on the preferred language set with the browser[^132]. Users can also change the locale in the application settings. Therefore, the `locale` configuration option is ignored and `CMS.registerLocale()` is not required.
- The List widget’s `label` and `label_singular` are not converted to lowercase, which is especially problematic in German, where all nouns are capitalized[^98].
- Long menu item labels, especially in non-English locales, don’t overflow the dropdown container[^117].
- We are migrating from [svelte-i18n](https://github.com/kaisermann/svelte-i18n) to the new [MessageFormat 2](https://github.com/unicode-org/message-format-wg)-based sveltia-i18n library for natural-sounding translations in every locale.

## Compatibility

We are trying to make Sveltia CMS compatible with Netlify/Decap CMS where possible, so that more users can seamlessly switch to our modern alternative. It’s ready to be used as a drop-in replacement for Netlify/Decap CMS in some casual use case scenarios with a [single line of code update](#migration).

However, 100% feature parity is not planned, and some features are still missing or will not be added due to performance, deprecation and other factors. Look at the compatibility info below to see if you can migrate now or in the near future.

### Features not to be implemented

- **The Bitbucket, Gitea/Forgejo and Git Gateway backends will not be supported** for performance reasons. We plan to develop a high-performance Git Gateway alternative in the future. We may also support the other platforms if their APIs improve to allow the CMS to fetch multiple entries at once.
- **The Netlify Identity widget will not be supported**, as it’s not useful without Git Gateway. We may be able to support it in the future if a Git Gateway alternative is created.
- The deprecated client-side implicit grant for the GitLab backend will not be supported, as it has already been [removed from GitLab 15.0](https://gitlab.com/gitlab-org/gitlab/-/issues/344609). Use the client-side PKCE authorization instead.
- The deprecated Netlify Large Media service will not be supported. Consider other storage providers.
- The deprecated Date widget will not be supported, as it has already been removed from Decap CMS 3.0. Use the DateTime widget instead.
- Remark plugins will not be supported, as they are not compatible with our Lexical-based rich text editor.
- [Undocumented methods](https://github.com/sveltia/sveltia-cms/blob/c69446da7bb0bab7405be741c0f92850c5dddfa8/src/main.js#L14-L37) exposed on the `window.CMS` object will not be implemented. This includes custom backends and custom media libraries, if any; we may support these features in the future, but our implementation would likely be incompatible with Netlify/Decap CMS.

### Current limitations

These limitations are expected to be resolved before or shortly after GA:

| Feature | Status in Sveltia CMS |
| --- | --- |
| Backends | The [Test backend](https://decapcms.org/docs/test-backend/) needed for our demo site is not yet added. We’ll see if [Azure DevOps](https://decapcms.org/docs/azure-backend/) can also be supported. |
| Configuration | Comprehensive config validation is not yet implemented. |
| Localization | The application UI is only available in English and Japanese at this time. |
| Media Libraries | [Cloudinary](https://decapcms.org/docs/cloudinary/) and [Uploadcare](https://decapcms.org/docs/uploadcare/) are not yet supported. |
| Workflow | [Editorial Workflow](https://decapcms.org/docs/editorial-workflows/) and [Open Authoring](https://decapcms.org/docs/open-authoring/) are not yet supported and will be implemented after the 1.0 release. |
| Collections | [Nested collections](https://decapcms.org/docs/collection-nested/) (beta) are not yet supported and will be implemented after the 1.0 release. |
| Widgets | [Custom widgets](https://decapcms.org/docs/custom-widgets/) are not yet supported. See the table below for other limitations. |
| Customizations | [Custom previews](https://decapcms.org/docs/customization/) and [event subscriptions](https://decapcms.org/docs/registering-events/) are not yet supported. |

| Widget | Status in Sveltia CMS |
| --- | --- |
| [Code](https://decapcms.org/docs/widgets/#code) | Not yet supported. |
| [DateTime](https://decapcms.org/docs/widgets/#datetime) | The `date_format` and `time_format` options with Moment.js tokens are not yet supported. Note that [Decap CMS 3.1.1](https://github.com/decaporg/decap-cms/releases/tag/decap-cms%403.1.1) replaced Moment.js with [Day.js](https://day.js.org/), and [Decap CMS 3.3.0](https://github.com/decaporg/decap-cms/releases/tag/decap-cms%403.3.0) made other changes to the widget behaviour; we’ll follow these changes where it makes sense. |
| [File](https://decapcms.org/docs/widgets/#file) / [Image](https://decapcms.org/docs/widgets/#image) | Field-specific media folders (beta) and media library options are not yet supported other than `media_library.config.max_file_size` for the default media library. |
| [Map](https://decapcms.org/docs/widgets/#map) | Not yet supported. |
| [Markdown](https://decapcms.org/docs/widgets/#markdown) | The built-in `code-block` component and custom components are not yet supported. |

### Other notes

- Make sure you’re using the latest stable version of a web browser. Firefox ESR and its derivatives, including Tor Browser and Mullvad Browser, are not supported, although they may still work. The [local repository workflow](#working-with-a-local-git-repository) requires Chrome, Edge or another Chromium-based browser.
- Sveltia CMS requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts), meaning it only works with HTTPS, `localhost` or `127.0.0.1` URLs. If you’re running a remote server yourself and it’s served over HTTP, get a TLS certificate from [Let’s Encrypt](https://letsencrypt.org/).
- The GitLab backend requires GitLab 16.3 or later.
- We plan to provide partial compatibility with now-discontinued Static CMS, such as the [KeyValue widget](https://staticjscms.netlify.app/docs/widget-keyvalue).
- Found a compatibility issue or other missing feature? [Let us know](https://github.com/sveltia/sveltia-cms/issues/new?labels=bug).

## Getting started

### New users

Currently, Sveltia CMS is primarily intended for existing Netlify/Decap CMS users. If you don’t have it yet, follow [their documentation](https://decapcms.org/docs/basic-steps/) to add it to your site and create a configuration file first. Make sure you choose the [GitHub](https://decapcms.org/docs/github-backend/) or [GitLab](https://decapcms.org/docs/gitlab-backend/) backend (and ignore the Choosing a Backend page). Then migrate to Sveltia CMS as described below.

As the product evolves, we’ll implement a built-in configuration editor and provide comprehensive documentation to make it easier for everyone to get started with Sveltia CMS.

Here are some starter kits for popular frameworks created by community members. More to follow!

- [Eleventy starter template](https://github.com/danurbanowicz/eleventy-sveltia-cms-starter) by [@danurbanowicz](https://github.com/danurbanowicz)
- [Hugo module](https://github.com/privatemaker/headless-cms) by [@privatemaker](https://github.com/privatemaker)
- [hugolify-sveltia-cms](https://github.com/Hugolify/hugolify-sveltia-cms/) by [@sebousan](https://github.com/sebousan)
- Astro: [astro-sveltia-cms](https://github.com/majesticostudio/astro-sveltia-cms), [astro-starter](https://github.com/zankhq/astro-starter) and [astros](https://github.com/zankhq/astros) by [@zanhk](https://github.com/zanhk)

Alternatively, you can probably use one of the [Netlify/Decap CMS templates](https://decapcms.org/docs/start-with-a-template/) and make a quick migration to Sveltia CMS.

### Migration

Have a look at the [compatibility info](#compatibility) above first. If you’re already using Netlify/Decap CMS with the GitHub or GitLab backend and don’t have any unsupported features like custom widgets or nested collections, migrating to Sveltia CMS is super easy — it works as a drop-in replacement. Edit `/admin/index.html` to replace the CMS `<script>` tag, and push the change to your repository. Your new `<script>` tag is:

```html
<script src="https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js"></script>
```

From Netlify CMS:

```diff
-<script src="https://unpkg.com/netlify-cms@^2.0.0/dist/netlify-cms.js"></script>
+<script src="https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js"></script>
```

From Decap CMS:

```diff
-<script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
+<script src="https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js"></script>
```

That’s it! You can open `https://[hostname]/admin/` as before to start editing. There is even no authentication process if you’ve already been signed in with GitHub or GitLab on Netlify/Decap CMS because Sveltia CMS uses your auth token stored in the browser. Simple enough!

That said, we strongly recommend testing your new Sveltia CMS instance first on your local machine. [See below](#working-with-a-local-git-repository) for how.

#### Migrating from Git Gateway backend

Sveltia CMS does not support the Git Gateway backend due to performance limitations. If you don’t care about user management with Netlify Identity, you can use the [GitHub](https://decapcms.org/docs/github-backend/) or [GitLab](https://decapcms.org/docs/gitlab-backend/) backend instead. Make sure **you install an OAuth client** on GitHub or GitLab in addition to updating your configuration file. As noted in the document, Netlify is still able to facilitate the auth flow.

To allow multiple users to edit content, simply invite people to your GitHub repository with the write role assigned.

Once you have migrated from the Git Gateway and Netlify Identity combo, you can remove the Netlify Identity widget script tag from your HTML:

```diff
-<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
```

If you want to stay with Netlify Identity, unfortunately you can’t migrate to Sveltia CMS right now. We plan to develop a high-performance Git Gateway alternative with Netlify Identity support in the future.

### Installing with npm

For advanced users, we have also made the bundle available as an [npm package](https://www.npmjs.com/package/@sveltia/cms). You can install it by running `npm i @sveltia/cms` or `pnpm add @sveltia/cms` on your project. The [manual initialization](https://decapcms.org/docs/manual-initialization/) flow with the `init` method is the same as for Netlify/Decap CMS.

### Updates

Updating Sveltia CMS is transparent, unless you include a specific version in the `<script>` source URL or use the npm package. Whenever you (re)load the CMS, the latest version will be served via [UNPKG](https://unpkg.com/). The CMS also periodically checks for updates and notifies you when a new version is available. After the product reaches GA, you could use a semantic version range (`^1.0.0`) like Netlify/Decap CMS.

If you’ve chosen to install with npm, updating the package is your responsibility. We recommend using [`ncu`](https://www.npmjs.com/package/npm-check-updates) or a service like [Dependabot](https://github.blog/2020-06-01-keep-all-your-packages-up-to-date-with-dependabot/) to keep dependencies up to date, otherwise you’ll miss important bug fixes and new features.

## Tips & tricks

### Moving your site from Netlify to another hosting service

You can host your Sveltia CMS-managed site anywhere, such as [Cloudflare Pages](https://pages.cloudflare.com/) or [GitHub Pages](https://pages.github.com/). But moving away from Netlify means you can no longer sign in with GitHub or GitLab via Netlify. Instead, you can use [our own OAuth client](https://github.com/sveltia/sveltia-cms-auth), which can be easily deployed to Cloudflare Workers, or [any other 3rd party client](https://decapcms.org/docs/external-oauth-clients/) made for Netlify/Decap CMS.

### Providing a JSON configuration file

Sveltia CMS supports a configuration file written in the JSON format in addition to the standard YAML format. This allows developers to programmatically generate the CMS configuration to enable bulk or complex collections. To do this, simply add a `<link>` tag to your HTML, just like a [custom YAML config link](https://decapcms.org/docs/configuration-options/#configuration-file), but with the type `application/json`:

```html
<link href="path/to/config.json" type="application/json" rel="cms-config-url" />
```

Alternatively, you can [manually initialize](https://decapcms.org/docs/manual-initialization/) the CMS with a JavaScript configuration object.

### Working around an authentication error

If you get an “Authentication Aborted” error when trying to sign in to GitHub or GitLab using the authorization code flow, you may need to check your site’s [`Cross-Origin-Opener-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy). The COOP header is not widely used, but it’s known to break the OAuth flow with a popup window. If that’s your case, changing `same-origin` to `same-origin-allow-popups` solves the problem. ([Discussion](https://github.com/sveltia/sveltia-cms/issues/131))

### Working with a local Git repository

Sveltia CMS has simplified the local repository workflow by removing the need for additional configuration (the `local_backend` property) and a proxy server (`netlify-cms-proxy-server` or `decap-server`), thanks to the [File System Access API](https://developer.chrome.com/articles/file-system-access/) available in [some modern browsers](https://developer.mozilla.org/en-US/docs/web/api/window/showopenfilepicker#browser_compatibility).

Basically there are only two differences from Netlify/Decap CMS: you don’t need to run the proxy server, and you need to select your project folder in the browser instead. Here are the detailed steps:

1. Make sure you have configured the [GitHub](https://decapcms.org/docs/github-backend/) or [GitLab](https://decapcms.org/docs/gitlab-backend/) backend.
   - Please note that the Git Gateway backend mentioned in the Netlify/Decap CMS [local Git repository document](https://decapcms.org/docs/working-with-a-local-git-repository/) is not supported in Sveltia CMS, so `name: git-gateway` won’t work. You’ll need either `name: github` or `name: gitlab` along with the `repo` definition. If you haven’t determined your repository name yet, just use a tentative name.
1. Launch the local development server for your frontend framework, typically with `npm run dev` or `pnpm dev`.
1. Open `http://localhost:[port]/admin/index.html` with Chrome or Edge.
   - The port number varies by framework. Check the terminal output from the previous step.
   - The `127.0.0.1` addresses can also be used instead of `localhost`.
   - If your CMS instance is not located under `/admin/`, use the appropriate path.
   - Other Chromium-based browsers may also work. Brave user? [See below](#enabling-local-development-in-brave).
1. Click “Work with Local Repository” and select the project’s root directory once prompted.
   - If you get an error saying “not a repository root directory”, make sure you’ve turned the folder into a repository with either a CUI ([`git init`](https://github.com/git-guides/git-init)) or GUI, and the hidden `.git` folder exists.
   - If you’re using Windows Subsystem for Linux (WSL), you may get an error saying “Can’t open this folder because it contains system files.” This is due to a limitation in the browser, and you can try some workarounds mentioned in [this issue](https://github.com/coder/code-server/issues/4646) and [this thread](https://github.com/sveltia/sveltia-cms/discussions/101).
1. Edit your content using the CMS. All changes are made to local files.
1. Open the dev site at `http://localhost:[port]/` to check the rendered pages.
   - Depending on your framework, you may need to manually rebuild your site to reflect the changes you have made.
1. Use `git diff` or a GUI like [GitHub Desktop](https://desktop.github.com/) to see if the produced changes look good.
1. Commit and push the changes if satisfied, or discard them if you’re just testing.

Note that, as with Netlify/Decap CMS, the local repository support in Sveltia CMS doesn’t perform any Git operations. You’ll have to manually fetch, pull, commit and push all changes using a Git client. In the future, we’ll figure out if there’s a way to do this in a browser, because the proxy server actually has the undocumented, experimental `git` mode that creates commits to a local repository[^131].

You will also need to reload the CMS after making changes to the configuration file or retrieving remote updates. This manual work will hopefully be unnecessary once the proposed `FileSystemObserver` API, which is being [implemented in Chromium](https://issues.chromium.org/issues/40105284) behind a flag, becomes available.

If you have migrated from Netlify/Decap CMS and are happy with the local repository workflow of Sveltia CMS, you can remove the `local_backend` property from your configuration and uninstall the proxy server. If you have configured a custom port number with the `.env` file, you can remove it as well.

### Enabling local development in Brave

In the Brave browser, you must enable the File System Access API with an experiment flag to take advantage of the [local repository workflow](#working-with-a-local-git-repository).

1. Open `brave://flags/#file-system-access-api` in a new browser tab.
1. Click Default (Disabled) next to File System Access API and select Enabled.
1. Relaunch the browser.

### Using a custom icon for a collection

You can specify an icon for each collection for easy identification in the collection list. You don’t need to install a custom icon set because the Material Symbols font file is already loaded for the application UI. Just pick one of the 2,500+ icons:

1. Visit the [Material Symbols](https://fonts.google.com/icons?icon.set=Material+Symbols&icon.platform=android) page on Google Fonts.
1. Search and select an icon, and copy the icon name displayed on the right panel.
1. Add it to one of your collection definitions in `config.yml` as the new `icon` property, like the example below.
1. Repeat the same steps for all the collections if desired.
1. Commit and push the changes to your Git repository.
1. Reload Sveltia CMS once the updated config file is deployed.

```diff
   - name: tags
     label: Tags
+    icon: sell
     create: true
     folder: data/tags/
```

### Adding dividers to the collection list

Sveltia CMS allows developers to add dividers to the collection list to distinguish different types of collections. To do this, insert a fake collection with the `divider: true` option along with a random, unique `name`. In VS Code, you may get a validation error if `config.yml` is treated as a “Netlify YAML config” file. You can work around this by adding an empty `files` list as well:

```yaml
collections:
  - name: products
    ...
  - divider: true
    name: d1 # d2, d3, etc. Should be unique for each divider
    files: []
  - name: pages
    ...
```

### Using a custom media folder for a collection

This is actually not new in Sveltia CMS but rather an undocumented feature in Netlify/Decap CMS[^4]. You can specify media and public folders for each collection that override the [global media folder](https://decapcms.org/docs/configuration-options/#media-and-public-folders). Well, it’s [documented](https://decapcms.org/docs/collection-folder/#media-and-public-folder), but that’s probably not what you want.

Rather, if you’d like to add all the media files for a collection in one single folder, specify both `media_folder` and `public_folder` instead of leaving them empty. The trick is to use an **absolute path** for `media_folder` like the example below. You can try this with Netlify/Decap CMS first if you prefer.

```diff
 media_folder: static/media
 public_folder: /media

 collections:
   - name: products
     label: Products
     create: true
     folder: data/products/
+    media_folder: /static/media/products # start with a slash
+    public_folder: /media/products
```

In Sveltia CMS, those collection media folders are displayed prominently for easier asset management. We recommend setting `media_folder` and `public_folder` for each collection if it contains one or more File/Image fields.

### Using keyboard shortcuts

- View the Content Library: `Alt+1`
- View the Asset Library: `Alt+2`
- Search for entries and assets: `Ctrl+F` (Windows/Linux) or `Command+F` (macOS)
- Create a new entry: `Ctrl+E` (Windows/Linux) or `Command+E` (macOS)
- Save an entry: `Ctrl+S` (Windows/Linux) or `Command+S` (macOS)
- Cancel entry editing: `Escape`

### Using DeepL to translate entry fields

Sveltia CMS comes with a handy DeepL integration so that you can translate any text field from another locale without leaving the Content Editor. To enable the high quality, AI-powered, quick translation feature:

1. Update your configuration file to enable the [i18n support](https://decapcms.org/docs/i18n/) with multiple locales.
1. Sign up for [DeepL API](https://www.deepl.com/pro-api/) and copy your Authentication Key from DeepL’s Account page.
1. Open an entry in Sveltia CMS.
1. Click on the Translation button on the pane header or each field, right next to the 3-dot menu.
1. Paste your key when prompted.
1. The field(s) will be automatically translated.

Note that the Translation button on the pane header only translates empty fields, while in-field Translation buttons override any filled text.

If you have upgraded to DeepL API Pro, provide your new Authentication Key:

1. Click the Account button in the upper right corner, then click Settings.
1. Select the Language tab.
1. Paste your key to the DeepL API Authentication Key field.
1. Close the Settings dialog.

### Localizing entry slugs

In Sveltia CMS, it’s possible to localize entry slugs (filenames) if the i18n structure is `multiple_files` or `multiple_folders`. All you need is the `localize` filter for `slug` template tags:

```yaml
i18n:
  structure: multiple_folders
  locales: [en, fr]

slug:
  encoding: ascii
  clean_accents: true

collections:
  - name: posts
    label: Blog posts
    create: true
    folder: data/posts/
    slug: '{{title | localize}}' # This does the trick
    format: yaml
    i18n: true
    fields:
      - name: title
        label: Title
        widget: string
        i18n: true
```

With this configuration, an entry is saved with localized filenames, while the default locale’s slug is stored in each file as an extra `translationKey` property, which is used in [Hugo’s multilingual support](https://gohugo.io/content-management/multilingual/#bypassing-default-linking). Sveltia CMS and Hugo read this property to link localized files.

- `data/posts/en/my-trip-to-new-york.yaml`
  ```yaml
  translationKey: my-trip-to-new-york
  title: My trip to New York
  ```
- `data/posts/fr/mon-voyage-a-new-york.yaml`
  ```yaml
  translationKey: my-trip-to-new-york
  title: Mon voyage à New York
  ```

You can customize the property name and value for a different framework or i18n library by adding the `canonical_slug` option to your top-level or collection-level `i18n` configuration. The example below is for [@astrolicious/i18n](https://github.com/astrolicious/i18n), which requires a locale prefix in the value ([discussion](https://github.com/sveltia/sveltia-cms/issues/137)):

```yaml
i18n:
  canonical_slug:
    key: defaultLocaleVersion # default: translationKey
    value: 'en/{{slug}}' # default: {{slug}}
```

For [Jekyll](https://migueldavid.eu/how-to-make-jekyll-multilingual-c13e74c18f1c), you may want to use the `ref` property:

```yaml
i18n:
  canonical_slug:
    key: ref
```

### Disabling non-default locale content

You can disable output of content in selected non-default locales by adding the `save_all_locales` property to the top-level or collection-level `i18n` configuration. Then you’ll find “Disable (locale name)” in the three-dot menu in the top right corner of the Content Editor. This is useful if the translation isn’t ready yet, but you want to publish the default locale content first.

With the following configuration, you can disable the French and/or German translation while writing in English.

```diff
 i18n:
   structure: multiple_files
   locales: [en, fr, de]
   default_locale: en
+  save_all_locales: false
```

### Using a random ID for an entry slug

By default, the [slug for a new entry file](https://decapcms.org/docs/configuration-options/#slug) will be generated based on the entry’s `title` field. Or, you can specify the collection’s `slug` option to use the file creation date or other fields. While the behaviour is generally acceptable and SEO-friendly, it’s not useful if the title might change later or if it contains non-Latin characters like Chinese. In Sveltia CMS, you can easily generate a random [UUID](https://developer.mozilla.org/en-US/docs/Glossary/UUID) for a slug without a custom widget!

It’s simple — just specify `{{uuid}}` (full UUID v4), `{{uuid_short}}` (last 12 characters only) or `{{uuid_shorter}}` (first 8 characters only) in the `slug` option. The results would look like `4fc0917c-8aea-4ad5-a476-392bdcf3b642`, `392bdcf3b642` and `4fc0917c`, respectively.

```diff
   - name: members
     label: Members
     create: true
     folder: data/members/
+    slug: '{{uuid_short}}'
```

### Editing data files with a top-level list

Sveltia CMS allows you to edit and save a list at the top-level of a data file, without a field name. All you need to do is create a single List field with the new `root` option set to `true`. The configuration below reproduces [this Jekyll data file example](https://jekyllrb.com/docs/datafiles/#example-list-of-members):

```yaml
collections:
  - name: data
    label: Data Files
    files:
      - name: members
        label: Member List
        file: _data/members.yml
        fields:
          - name: members
            label: Members
            label_singular: Member
            widget: list
            root: true # This does the trick
            fields:
              - name: name
                label: Name
              - name: github
                label: GitHub account
```

Note: The `root` option is ignored if the collection or collection file contains multiple fields. You can still have subfields under the List field.

### Disabling automatic deployments

You may already have a CI/CD tool set up on your Git repository to automatically deploy changes to production. Occasionally, you make a lot of changes to your content to quickly reach the CI/CD provider’s (free) build limits, or you just don’t want to see builds triggered for every single small change.

With Sveltia CMS, you can disable automatic deployments by default and manually trigger deployments at your convenience. This is done by adding the `[skip ci]` prefix to commit messages, the convention supported by [GitHub Actions](https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs), [GitLab CI/CD](https://docs.gitlab.com/ee/ci/pipelines/#skip-a-pipeline), [CircleCI](https://circleci.com/docs/skip-build/#skip-jobs), [Travis CI](https://docs.travis-ci.com/user/customizing-the-build/#skipping-a-build), [Netlify](https://docs.netlify.com/site-deploys/manage-deploys/#skip-a-deploy), [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/branch-build-controls/#skip-builds) and others. Here are the steps to use it:

1. Add the new `automatic_deployments` property to your `backend` configuration with a value of `false`:
   ```diff
    backend:
      name: github
      repo: owner/repo
      branch: main
   +  automatic_deployments: false
   ```
1. Commit and deploy the change to the config file and reload the CMS.
1. Now, whenever you save an entry or asset, `[skip ci]` is automatically added to each commit message. However, deletions are always committed without the prefix to avoid unexpected data retention on your site.
1. If you want to deploy a new or updated entry, as well as any other unpublished entries and assets, click an arrow next to the Save button in the Content Editor, then select **Save and Publish**. This will trigger CI/CD by omitting `[skip ci]`.

If you set `automatic_deployments` to `true`, the behaviour is reversed. CI/CD will be triggered by default, while you have an option to **Save without Publishing** that adds `[skip ci]` only to the associated commit.

Gotcha: Unpublished entries and assets are not drafts. Once committed to your repository, those changes can be deployed any time another commit is pushed without `[skip ci]`, or when a manual deployment is triggered.

If the `automatic_deployments` property is defined, you can manually trigger a deployment by clicking the **Publish Changes** button on the application header. To use this feature:

- GitHub Actions:
  1. Without any configuration, Publish Changes will [trigger a `repository_dispatch` event](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event) with the `sveltia-cms-publish` event type. Update your build workflow to receive this event:
     ```diff
      on:
        push:
          branches: [$default-branch]
     +  repository_dispatch:
     +    types: [sveltia-cms-publish]
     ```
- Other CI/CD providers:
  1. Select Settings under the Account button in the top right corner of the CMS.
  1. Select the Advanced tab.
  1. Enter the deploy hook URL for your provider, e.g. [Netlify](https://docs.netlify.com/configure-builds/build-hooks/) or [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/deploy-hooks/).
  1. Configure the CSP if necessary. See below.

### Setting up Content Security Policy

If your site adopts Content Security Policy (CSP), use the following policy for Sveltia CMS, or some features may not work.

```csp
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' blob: data:;
media-src blob:;
frame-src blob:;
script-src 'self' https://unpkg.com;
connect-src 'self' blob: data: https://unpkg.com;
```

(UNPKG is used not only to download the CMS script bundle, but also to check for the latest version and retrieve additional dependencies such as [PDF.js](https://github.com/mozilla/pdf.js))

Then, add the following origins depending on your Git backend and enabled integrations.

- GitHub: (If you’re running a GitHub Enterprise Server, you’ll also need to add the origin to these directives.)
  - `img-src`
    ```
    https://*.githubusercontent.com
    ```
  - `connect-src`
    ```
    https://api.github.com https://www.githubstatus.com
    ```
- GitLab: (If you’re running a self-hosted instance, you’ll also need to add the origin to these directives.)
  - `img-src`
    ```
    https://gitlab.com https://secure.gravatar.com
    ```
  - `connect-src`
    ```
    https://gitlab.com https://status-api.hostedstatus.com
    ```
- Pexels:
  - `img-src`
    ```
    https://images.pexels.com
    ```
  - `connect-src`
    ```
    https://images.pexels.com https://api.pexels.com
    ```
- Pixabay:
  - `img-src`
    ```
    https://pixabay.com
    ```
  - `connect-src`
    ```
    https://pixabay.com
    ```
- Unsplash:
  - `img-src`
    ```
    https://images.unsplash.com
    ```
  - `connect-src`
    ```
    https://images.unsplash.com https://api.unsplash.com
    ```
- DeepL API Free:
  - `connect-src`
    ```
    https://api-free.deepl.com
    ```
- DeepL API Pro:
  - `connect-src`
    ```
    https://api.deepl.com
    ```
- YouTube:
  - `frame-src`
    ```
    https://www.youtube-nocookie.com
    ```

If you choose to [disable automatic deployments](#disabling-automatic-deployments) and have configured a webhook URL, you may need to add the origin to the `connect-src` directive. For example,

- Netlify:
  - `connect-src`
    ```csp
    https://api.netlify.com
    ```
- Cloudflare Pages
  - `connect-src`
    ```csp
    https://api.cloudflare.com
    ```

If you have image field(s) and expect that images will be inserted as URLs, you may want to allow any source using a wildcard instead of specifying individual origins:

```csp
img-src 'self' blob: data: https://*;
```

## Support & feedback

While we don’t have dedicated developer/user support resources, [quick questions](https://github.com/sveltia/sveltia-cms/discussions/new?category=q-a) and [feedback](https://github.com/sveltia/sveltia-cms/discussions/new?category=general) are welcome on the [Discussions](https://github.com/sveltia/sveltia-cms/discussions) page of our GitHub repository. We also have a [Discord channel](https://discord.gg/5hwCGqup5b) for casual chat.

Planning to build a website with Sveltia CMS? Looking for professional support? Maintainer [@kyoshino](https://github.com/kyoshino) is available for hire depending on your needs. Feel free to reach out!

## Contributions

See [Contributing to Sveltia CMS](https://github.com/sveltia/sveltia-cms/blob/main/CONTRIBUTING.md).

## Roadmap

### Before the 1.0 release

- Enhanced [compatibility with Netlify/Decap CMS](#compatibility)
- [Localization](https://github.com/sveltia/sveltia-cms/blob/main/src/lib/locales/README.md)
- Accessibility audit
- Developer documentation (implementation guide)
- Marketing site
- Live demo site
- Official starter templates for the most popular frameworks, including SvelteKit and Next.js
- Broad automation test coverage (Vitest + Playwright)

### After the 1.0 release

- Implementing the remaining Netlify/Decap CMS features: Editorial Workflow, Open Authoring and nested collections
- Tackling more Netlify/Decap CMS issues, including MDX support[^122], manual entry sorting[^125], roles[^23], mobile optimization[^18] and config editor[^10] — Some [top-voted features](https://github.com/decaporg/decap-cms/issues?q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc) are already implemented in Sveltia CMS
- Exploring compatibility with Static CMS, a now-discontinued community fork of Netlify CMS (Note: The [KeyValue widget](https://staticjscms.netlify.app/docs/widget-keyvalue) will be supported prior to the 1.0 release[^123])
- More integration options: stock photos, cloud storage providers, translators, maps, analytics
- Advanced digital asset management (DAM) features, including image editing and tagging[^114]
- AI integrations for image generation and content writing
- End-user documentation
- Contributor documentation
- Marketplace for custom widgets, etc.
- Git Gateway alternative
- and so much more!

## Related links

- Introducing Sveltia CMS: a short technical presentation by [@kyoshino](https://github.com/kyoshino) during the _This Week in Svelte_ online meetup on March 31, 2023 — [recording](https://youtu.be/-YjLubiieYs?t=1660) & [slides](https://docs.google.com/presentation/d/1Wi4ty-1AwOp2-zy7LctmzCV4rrdYPfke9NGhO0DdRdM)

### As seen on

- [LogRocket Blog – 9 best Git-based CMS platforms for your next project](https://blog.logrocket.com/9-best-git-based-cms-platforms/)
- [Jamstack – Headless CMS](https://jamstack.org/headless-cms/)
- [Hugo – Front-end interfaces](https://gohugo.io/tools/front-ends/)
- [Made with Svelte](https://madewithsvelte.com/sveltia-cms)

## Disclaimer

This software is provided “as is” without any express or implied warranty. We are not obligated to provide any support for the application. This product is not affiliated with or endorsed by Netlify, Decap CMS or any other integrated services. All product names, logos, and brands are the property of their respective owners.

[^1]: Netlify/Decap CMS [#2557](https://github.com/decaporg/decap-cms/issues/2557)

[^2]: Netlify/Decap CMS [#3267](https://github.com/decaporg/decap-cms/issues/3267)

[^3]: Netlify/Decap CMS [#1040](https://github.com/decaporg/decap-cms/issues/1040)

[^4]: Netlify/Decap CMS [#3671](https://github.com/decaporg/decap-cms/issues/3671)

[^5]: Netlify/Decap CMS [#1032](https://github.com/decaporg/decap-cms/issues/1032)

[^6]: Netlify/Decap CMS [#3240](https://github.com/decaporg/decap-cms/issues/3240)

[^7]: Netlify/Decap CMS [#4386](https://github.com/decaporg/decap-cms/issues/4386)

[^8]: Netlify/Decap CMS [#2579](https://github.com/decaporg/decap-cms/issues/2579)

[^9]: Netlify/Decap CMS [#3505](https://github.com/decaporg/decap-cms/issues/3505), [#4211](https://github.com/decaporg/decap-cms/issues/4211), [#5439](https://github.com/decaporg/decap-cms/issues/5439)

[^10]: Netlify/Decap CMS [#341](https://github.com/decaporg/decap-cms/issues/341), [#1167](https://github.com/decaporg/decap-cms/issues/1167)

[^11]: Netlify/Decap CMS [#1382](https://github.com/decaporg/decap-cms/issues/1382), [#6994](https://github.com/decaporg/decap-cms/issues/6994)

[^12]: Netlify/Decap CMS [#1975](https://github.com/decaporg/decap-cms/issues/1975), [#3712](https://github.com/decaporg/decap-cms/issues/3712)

[^13]: Netlify/Decap CMS [#5112](https://github.com/decaporg/decap-cms/issues/5112), [#5653](https://github.com/decaporg/decap-cms/issues/5653)

[^14]: Netlify/Decap CMS [#4635](https://github.com/decaporg/decap-cms/issues/4635), [#5920](https://github.com/decaporg/decap-cms/issues/5920), [#6410](https://github.com/decaporg/decap-cms/issues/6410), [#6827](https://github.com/decaporg/decap-cms/issues/6827), [#6924](https://github.com/decaporg/decap-cms/issues/6924)

[^15]: Netlify/Decap CMS [#6932](https://github.com/decaporg/decap-cms/issues/6932)

[^16]: Netlify/Decap CMS [#2103](https://github.com/decaporg/decap-cms/issues/2103), [#7302](https://github.com/decaporg/decap-cms/discussions/7302)

[^17]: Netlify/Decap CMS [#1333](https://github.com/decaporg/decap-cms/issues/1333)

[^18]: Netlify/Decap CMS [#441](https://github.com/decaporg/decap-cms/issues/441)

[^19]: Netlify/Decap CMS [#5910](https://github.com/decaporg/decap-cms/issues/5910)

[^20]: Netlify/Decap CMS [#4563](https://github.com/decaporg/decap-cms/issues/4563)

[^21]: Netlify/Decap CMS [#4781](https://github.com/decaporg/decap-cms/issues/4781)

[^22]: Netlify/Decap CMS [#3615](https://github.com/decaporg/decap-cms/issues/3615), [#4069](https://github.com/decaporg/decap-cms/issues/4069), [#5097](https://github.com/decaporg/decap-cms/issues/5097), [#6642](https://github.com/decaporg/decap-cms/issues/6642)

[^23]: Netlify/Decap CMS [#2](https://github.com/decaporg/decap-cms/issues/2)

[^24]: Netlify/Decap CMS [#6831](https://github.com/decaporg/decap-cms/issues/6831)

[^25]: Netlify/Decap CMS [#526](https://github.com/decaporg/decap-cms/issues/526), [#6987](https://github.com/decaporg/decap-cms/issues/6987)

[^26]: Netlify/Decap CMS [#3285](https://github.com/decaporg/decap-cms/issues/3285), [#7030](https://github.com/decaporg/decap-cms/issues/7030), [#7067](https://github.com/decaporg/decap-cms/issues/7067), [#7217](https://github.com/decaporg/decap-cms/issues/7217)

[^27]: Netlify/Decap CMS [#5617](https://github.com/decaporg/decap-cms/issues/5617)

[^28]: Netlify/Decap CMS [#2677](https://github.com/decaporg/decap-cms/pull/2677), [#6836](https://github.com/decaporg/decap-cms/pull/6836)

[^29]: Netlify/Decap CMS [#4783](https://github.com/decaporg/decap-cms/issues/4783)

[^30]: Netlify/Decap CMS [#565](https://github.com/decaporg/decap-cms/issues/565), [#6733](https://github.com/decaporg/decap-cms/discussions/6733)

[^31]: Netlify/Decap CMS [#1045](https://github.com/decaporg/decap-cms/issues/1045)

[^32]: Netlify/Decap CMS [#302](https://github.com/decaporg/decap-cms/issues/302), [#5549](https://github.com/decaporg/decap-cms/issues/5549)

[^33]: Netlify/Decap CMS [#542](https://github.com/decaporg/decap-cms/issues/542), [#6513](https://github.com/decaporg/decap-cms/issues/6513), [#7295](https://github.com/decaporg/decap-cms/issues/7295)

[^34]: Netlify/Decap CMS [#2138](https://github.com/decaporg/decap-cms/issues/2138), [#5932](https://github.com/decaporg/decap-cms/discussions/5932)

[^35]: Netlify/Decap CMS [#7086](https://github.com/decaporg/decap-cms/issues/7086)

[^36]: Netlify/Decap CMS [#6325](https://github.com/decaporg/decap-cms/issues/6325)

[^37]: Netlify/Decap CMS [#1481](https://github.com/decaporg/decap-cms/issues/1481)

[^38]: Netlify/Decap CMS [#1984](https://github.com/decaporg/decap-cms/issues/1984)

[^39]: Netlify/Decap CMS [#946](https://github.com/decaporg/decap-cms/issues/946)

[^40]: Netlify/Decap CMS [#5630](https://github.com/decaporg/decap-cms/issues/5630)

[^41]: Netlify/Decap CMS [#7011](https://github.com/decaporg/decap-cms/issues/7011)

[^42]: Netlify/Decap CMS [#2307](https://github.com/decaporg/decap-cms/issues/2307)

[^43]: Netlify/Decap CMS [#4387](https://github.com/decaporg/decap-cms/issues/4387), [#5381](https://github.com/decaporg/decap-cms/issues/5381)

[^44]: Netlify/Decap CMS [#2613](https://github.com/decaporg/decap-cms/issues/2613)

[^45]: Netlify/Decap CMS [#1424](https://github.com/decaporg/decap-cms/issues/1424)

[^46]: Netlify/Decap CMS [#4726](https://github.com/decaporg/decap-cms/issues/4726)

[^47]: Netlify/Decap CMS [#2370](https://github.com/decaporg/decap-cms/issues/2370), [#5596](https://github.com/decaporg/decap-cms/issues/5596)

[^48]: Netlify/Decap CMS [#5569](https://github.com/decaporg/decap-cms/issues/5569), [#6754](https://github.com/decaporg/decap-cms/discussions/6754)

[^49]: Netlify/Decap CMS [#5752](https://github.com/decaporg/decap-cms/issues/5752)

[^50]: Netlify/Decap CMS [#4646](https://github.com/decaporg/decap-cms/issues/4646), [#7167](https://github.com/decaporg/decap-cms/issues/7167)

[^51]: Netlify/Decap CMS [#6731](https://github.com/decaporg/decap-cms/issues/6731)

[^52]: Netlify/Decap CMS [#6970](https://github.com/decaporg/decap-cms/discussions/6970), [#7147](https://github.com/decaporg/decap-cms/issues/7147)

[^53]: Netlify/Decap CMS [#512](https://github.com/decaporg/decap-cms/issues/512), [#5673](https://github.com/decaporg/decap-cms/issues/5673), [#6707](https://github.com/decaporg/decap-cms/issues/6707)

[^54]: Netlify/Decap CMS [#1347](https://github.com/decaporg/decap-cms/issues/1347), [#4629](https://github.com/decaporg/decap-cms/issues/4629), [#6287](https://github.com/decaporg/decap-cms/issues/6287), [#6826](https://github.com/decaporg/decap-cms/issues/6826) — Decap 3.0 updated the Slate editor in an attempt to fix the problems, but the IME issues remain unresolved when using a mobile/tablet browser.

[^55]: Netlify/Decap CMS [#4480](https://github.com/decaporg/decap-cms/issues/4480), [#6353](https://github.com/decaporg/decap-cms/issues/6353)

[^56]: Netlify/Decap CMS [#6515](https://github.com/decaporg/decap-cms/issues/6515)

[^57]: Netlify/Decap CMS [#328](https://github.com/decaporg/decap-cms/issues/328)

[^58]: Netlify/Decap CMS [#5125](https://github.com/decaporg/decap-cms/issues/5125)

[^59]: Netlify/Decap CMS [#1654](https://github.com/decaporg/decap-cms/issues/1654)

[^60]: Netlify/Decap CMS [#386](https://github.com/decaporg/decap-cms/issues/386)

[^61]: Netlify/Decap CMS [#1489](https://github.com/decaporg/decap-cms/issues/1489), [#5838](https://github.com/decaporg/decap-cms/issues/5838)

[^62]: Netlify/Decap CMS [#7192](https://github.com/decaporg/decap-cms/issues/7192)

[^63]: Netlify/Decap CMS [#4877](https://github.com/decaporg/decap-cms/issues/4877)

[^64]: Netlify/Decap CMS [#3853](https://github.com/decaporg/decap-cms/issues/3853)

[^65]: Netlify/Decap CMS [#6034](https://github.com/decaporg/decap-cms/issues/6034)

[^66]: Netlify/Decap CMS [#3353](https://github.com/decaporg/decap-cms/issues/3353)

[^67]: Netlify/Decap CMS [#7077](https://github.com/decaporg/decap-cms/issues/7077)

[^68]: Netlify/Decap CMS [#6978](https://github.com/decaporg/decap-cms/issues/6978)

[^69]: Netlify/Decap CMS [#4350](https://github.com/decaporg/decap-cms/issues/4350)

[^70]: Netlify/Decap CMS [#6482](https://github.com/decaporg/decap-cms/issues/6482)

[^71]: Netlify/Decap CMS [#6999](https://github.com/decaporg/decap-cms/issues/6999), [#7000](https://github.com/decaporg/decap-cms/issues/7000), [#7001](https://github.com/decaporg/decap-cms/issues/7001), [#7152](https://github.com/decaporg/decap-cms/issues/7152), [#7220](https://github.com/decaporg/decap-cms/issues/7220), [#7283](https://github.com/decaporg/decap-cms/issues/7283), [#7316](https://github.com/decaporg/decap-cms/issues/7316)

[^72]: Netlify/Decap CMS [#7047](https://github.com/decaporg/decap-cms/issues/7047)

[^73]: Netlify/Decap CMS [#6993](https://github.com/decaporg/decap-cms/issues/6993), [#7123](https://github.com/decaporg/decap-cms/issues/7123), [#7127](https://github.com/decaporg/decap-cms/issues/7127), [#7128](https://github.com/decaporg/decap-cms/issues/7128), [#7237](https://github.com/decaporg/decap-cms/issues/7237), [#7251](https://github.com/decaporg/decap-cms/issues/7251)

[^74]: Netlify/Decap CMS [#4209](https://github.com/decaporg/decap-cms/issues/4209)

[^75]: Netlify/Decap CMS [#5472](https://github.com/decaporg/decap-cms/issues/5472)

[^76]: Netlify/Decap CMS [#4738](https://github.com/decaporg/decap-cms/issues/4738)

[^77]: Netlify/Decap CMS [#3415](https://github.com/decaporg/decap-cms/issues/3415), [#6565](https://github.com/decaporg/decap-cms/issues/6565)

[^78]: Netlify/Decap CMS [#2294](https://github.com/decaporg/decap-cms/issues/2294), [#3046](https://github.com/decaporg/decap-cms/issues/3046), [#4363](https://github.com/decaporg/decap-cms/issues/4363)

[^79]: Netlify/Decap CMS [#5726](https://github.com/decaporg/decap-cms/issues/5726)

[^80]: Netlify/Decap CMS [#5493](https://github.com/decaporg/decap-cms/issues/5493), [#6600](https://github.com/decaporg/decap-cms/issues/6600)

[^81]: Netlify/Decap CMS [#4645](https://github.com/decaporg/decap-cms/issues/4645)

[^82]: Netlify/Decap CMS [#6500](https://github.com/decaporg/decap-cms/issues/6500)

[^83]: Netlify/Decap CMS [#6508](https://github.com/decaporg/decap-cms/issues/6508)

[^84]: Netlify/Decap CMS [#7142](https://github.com/decaporg/decap-cms/issues/7142), [#7276](https://github.com/decaporg/decap-cms/issues/7276)

[^85]: Netlify/Decap CMS [#5055](https://github.com/decaporg/decap-cms/issues/5055), [#5470](https://github.com/decaporg/decap-cms/issues/5470), [#6989](https://github.com/decaporg/decap-cms/issues/6989)

[^86]: Netlify/Decap CMS [#5253](https://github.com/decaporg/decap-cms/issues/5253), [#6759](https://github.com/decaporg/decap-cms/issues/6759), [#6901](https://github.com/decaporg/decap-cms/issues/6901)

[^87]: Netlify/Decap CMS [#5280](https://github.com/decaporg/decap-cms/issues/5280)

[^88]: Netlify/Decap CMS [#1267](https://github.com/decaporg/decap-cms/issues/1267)

[^89]: Netlify/Decap CMS [#4255](https://github.com/decaporg/decap-cms/issues/4255)

[^90]: Netlify/Decap CMS [#725](https://github.com/decaporg/decap-cms/issues/725)

[^91]: Netlify/Decap CMS [#4954](https://github.com/decaporg/decap-cms/issues/4954)

[^92]: Netlify/Decap CMS [#1466](https://github.com/decaporg/decap-cms/issues/1466)

[^93]: Netlify/Decap CMS [#1000](https://github.com/decaporg/decap-cms/issues/1000)

[^94]: Netlify/Decap CMS [#5487](https://github.com/decaporg/decap-cms/issues/5487)

[^95]: Netlify/Decap CMS [#4417](https://github.com/decaporg/decap-cms/issues/4417)

[^96]: Netlify/Decap CMS [#962](https://github.com/decaporg/decap-cms/issues/962)

[^97]: Netlify/Decap CMS [#4288](https://github.com/decaporg/decap-cms/issues/4288)

[^98]: Netlify/Decap CMS [#3856](https://github.com/decaporg/decap-cms/issues/3856)

[^99]: Netlify/Decap CMS [#1685](https://github.com/decaporg/decap-cms/issues/1685)

[^100]: Netlify/Decap CMS [#4147](https://github.com/decaporg/decap-cms/issues/4147)

[^101]: Netlify/Decap CMS [#5969](https://github.com/decaporg/decap-cms/issues/5969)

[^102]: Netlify/Decap CMS [#1270](https://github.com/decaporg/decap-cms/issues/1270)

[^103]: Netlify/Decap CMS [#6307](https://github.com/decaporg/decap-cms/issues/6307)

[^104]: Netlify/Decap CMS [#6819](https://github.com/decaporg/decap-cms/issues/6819)

[^105]: Netlify/Decap CMS [#5701](https://github.com/decaporg/decap-cms/issues/5701)

[^106]: Netlify/Decap CMS [#2822](https://github.com/decaporg/decap-cms/issues/2822)

[^107]: Netlify/Decap CMS [#332](https://github.com/decaporg/decap-cms/issues/332), [#683](https://github.com/decaporg/decap-cms/issues/683), [#999](https://github.com/decaporg/decap-cms/issues/999), [#1456](https://github.com/decaporg/decap-cms/issues/1456), [#4175](https://github.com/decaporg/decap-cms/issues/4175), [#4818](https://github.com/decaporg/decap-cms/issues/4818), [#5688](https://github.com/decaporg/decap-cms/issues/5688), [#6828](https://github.com/decaporg/decap-cms/issues/6828), [#6829](https://github.com/decaporg/decap-cms/issues/6829), [#6862](https://github.com/decaporg/decap-cms/issues/6862), [#7023](https://github.com/decaporg/decap-cms/issues/7023)

[^108]: Netlify/Decap CMS [#6879](https://github.com/decaporg/decap-cms/discussions/6879)

[^109]: Netlify/Decap CMS [#7197](https://github.com/decaporg/decap-cms/issues/7197)

[^110]: Netlify/Decap CMS [#4637](https://github.com/decaporg/decap-cms/issues/4637)

[^111]: Netlify/Decap CMS [#7190](https://github.com/decaporg/decap-cms/issues/7190), [#7218](https://github.com/decaporg/decap-cms/issues/7218)

[^112]: Netlify/Decap CMS [#5815](https://github.com/decaporg/decap-cms/issues/5815), [#6522](https://github.com/decaporg/decap-cms/issues/6522), [#6532](https://github.com/decaporg/decap-cms/issues/6532), [#6588](https://github.com/decaporg/decap-cms/issues/6588), [#6617](https://github.com/decaporg/decap-cms/issues/6617), [#6640](https://github.com/decaporg/decap-cms/issues/6640), [#6663](https://github.com/decaporg/decap-cms/issues/6663), [#6695](https://github.com/decaporg/decap-cms/issues/6695), [#6697](https://github.com/decaporg/decap-cms/issues/6697), [#6764](https://github.com/decaporg/decap-cms/issues/6764), [#6765](https://github.com/decaporg/decap-cms/issues/6765), [#6835](https://github.com/decaporg/decap-cms/issues/6835), [#6983](https://github.com/decaporg/decap-cms/issues/6983), [#7205](https://github.com/decaporg/decap-cms/issues/7205)

[^113]: Netlify/Decap CMS [#5656](https://github.com/decaporg/decap-cms/issues/5656), [#5837](https://github.com/decaporg/decap-cms/issues/5837), [#5972](https://github.com/decaporg/decap-cms/issues/5972), [#6476](https://github.com/decaporg/decap-cms/issues/6476), [#6516](https://github.com/decaporg/decap-cms/issues/6516), [#6930](https://github.com/decaporg/decap-cms/issues/6930), [#6965](https://github.com/decaporg/decap-cms/issues/6965), [#7080](https://github.com/decaporg/decap-cms/issues/7080), [#7105](https://github.com/decaporg/decap-cms/issues/7105), [#7106](https://github.com/decaporg/decap-cms/issues/7106), [#7119](https://github.com/decaporg/decap-cms/issues/7119), [#7176](https://github.com/decaporg/decap-cms/issues/7176), [#7194](https://github.com/decaporg/decap-cms/issues/7194), [#7244](https://github.com/decaporg/decap-cms/issues/7244), [#7301](https://github.com/decaporg/decap-cms/issues/7301), [#7342](https://github.com/decaporg/decap-cms/issues/7342), [#7348](https://github.com/decaporg/decap-cms/issues/7348), [#7354](https://github.com/decaporg/decap-cms/issues/7354) — These `removeChild` crashes are common in React apps, likely caused by a [browser extension](https://github.com/facebook/react/issues/17256) or [Google Translate](https://github.com/facebook/react/issues/11538).

[^114]: Netlify/Decap CMS [#5029](https://github.com/decaporg/decap-cms/issues/5029), [#5048](https://github.com/decaporg/decap-cms/issues/5048)

[^115]: Netlify/Decap CMS [#7172](https://github.com/decaporg/decap-cms/issues/7172)

[^116]: Netlify/Decap CMS [#3431](https://github.com/decaporg/decap-cms/issues/3431)

[^117]: Netlify/Decap CMS [#3562](https://github.com/decaporg/decap-cms/issues/3562), [#6215](https://github.com/decaporg/decap-cms/issues/6215)

[^118]: Netlify/Decap CMS [#7267](https://github.com/decaporg/decap-cms/issues/7267)

[^119]: Netlify/Decap CMS [#5640](https://github.com/decaporg/decap-cms/issues/5640), [#6444](https://github.com/decaporg/decap-cms/issues/6444)

[^120]: Netlify/Decap CMS [#2727](https://github.com/decaporg/decap-cms/issues/2727), [#4884](https://github.com/decaporg/decap-cms/issues/4884)

[^121]: Netlify/Decap CMS [#7262](https://github.com/decaporg/decap-cms/issues/7262)

[^122]: Netlify/Decap CMS [#1776](https://github.com/decaporg/decap-cms/issues/1776), [#2064](https://github.com/decaporg/decap-cms/issues/2064), [#7158](https://github.com/decaporg/decap-cms/issues/7158), [#7259](https://github.com/decaporg/decap-cms/issues/7259)

[^123]: Netlify/Decap CMS [#5489](https://github.com/decaporg/decap-cms/issues/5489)

[^124]: Netlify/Decap CMS [#991](https://github.com/decaporg/decap-cms/issues/991), [#4488](https://github.com/decaporg/decap-cms/issues/4488), [#7233](https://github.com/decaporg/decap-cms/issues/7233)

[^125]: Netlify/Decap CMS [#475](https://github.com/decaporg/decap-cms/issues/475)

[^126]: Netlify/Decap CMS [#7279](https://github.com/decaporg/decap-cms/discussions/7279)

[^127]: Netlify/Decap CMS [#4518](https://github.com/decaporg/decap-cms/issues/4518)

[^128]: Netlify/Decap CMS [#7092](https://github.com/decaporg/decap-cms/issues/7092)

[^129]: Netlify/Decap CMS [#4961](https://github.com/decaporg/decap-cms/issues/4961), [#4979](https://github.com/decaporg/decap-cms/issues/4979), [#5545](https://github.com/decaporg/decap-cms/issues/5545), [#5778](https://github.com/decaporg/decap-cms/issues/5778), [#6279](https://github.com/decaporg/decap-cms/issues/6279), [#6464](https://github.com/decaporg/decap-cms/issues/6464), [#6810](https://github.com/decaporg/decap-cms/issues/6810), [#6922](https://github.com/decaporg/decap-cms/issues/6922), [#7118](https://github.com/decaporg/decap-cms/issues/7118), [#7293](https://github.com/decaporg/decap-cms/issues/7293) — A comment on one of the issues says the crash was due to Google Translate. Sveltia CMS has turned off Google Translate on the admin page.

[^130]: Netlify/Decap CMS [#6571](https://github.com/decaporg/decap-cms/issues/6571)

[^131]: Netlify/Decap CMS [#4429](https://github.com/decaporg/decap-cms/issues/4429)

[^132]: Netlify/Decap CMS [#6816](https://github.com/decaporg/decap-cms/discussions/6816)

[^133]: Netlify/Decap CMS [#445](https://github.com/decaporg/decap-cms/issues/445)

[^134]: Netlify/Decap CMS [#5548](https://github.com/decaporg/decap-cms/issues/5548)

[^135]: Netlify/Decap CMS [#2133](https://github.com/decaporg/decap-cms/issues/2133)

[^136]: Netlify/Decap CMS [#7085](https://github.com/decaporg/decap-cms/issues/7085)

[^137]: Netlify/Decap CMS [#4092](https://github.com/decaporg/decap-cms/issues/4092)

[^138]: Netlify/Decap CMS [#4841](https://github.com/decaporg/decap-cms/issues/4841)

[^139]: Netlify/Decap CMS [#6202](https://github.com/decaporg/decap-cms/issues/6202)

[^140]: Netlify/Decap CMS [#5444](https://github.com/decaporg/decap-cms/issues/5444)

[^141]: Netlify/Decap CMS [#3723](https://github.com/decaporg/decap-cms/issues/3723), [#6990](https://github.com/decaporg/decap-cms/issues/6990)

[^142]: Netlify/Decap CMS [#7124](https://github.com/decaporg/decap-cms/discussions/7124)

[^143]: Netlify/Decap CMS [#1341](https://github.com/decaporg/decap-cms/issues/1341)

[^144]: Netlify/Decap CMS [#3284](https://github.com/decaporg/decap-cms/issues/3284)

[^145]: Netlify/Decap CMS [#4733](https://github.com/decaporg/decap-cms/issues/4733)

[^146]: Netlify/Decap CMS [#2524](https://github.com/decaporg/decap-cms/issues/2524)

[^147]: Netlify/Decap CMS [#3583](https://github.com/decaporg/decap-cms/issues/3583)

[^148]: Netlify/Decap CMS [#531](https://github.com/decaporg/decap-cms/issues/531), [#1282](https://github.com/decaporg/decap-cms/issues/1282), [#1877](https://github.com/decaporg/decap-cms/issues/1877)

[^149]: Netlify/Decap CMS [#13](https://github.com/decaporg/decap-cms/issues/13) — The issue appears to have been closed without a fix being available.

[^150]: Netlify/Decap CMS [#7319](https://github.com/decaporg/decap-cms/issues/7319)

[^151]: Netlify/Decap CMS [#7328](https://github.com/decaporg/decap-cms/issues/7328)

[^152]: Netlify/Decap CMS [#2491](https://github.com/decaporg/decap-cms/issues/2491)

[^153]: Netlify/Decap CMS [#7347](https://github.com/decaporg/decap-cms/issues/7347)
