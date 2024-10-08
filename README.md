- [Sveltia CMS](#sveltia-cms)
  - [Motivation](#motivation)
    - [Our advantage](#our-advantage)
    - [Our goals](#our-goals)
  - [Development status](#development-status)
  - [Features](#features)
    - [Compatible with Netlify/Decap CMS](#compatible-with-netlifydecap-cms)
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
  - [Compatibility](#compatibility)
    - [Features not to be implemented](#features-not-to-be-implemented)
    - [Current limitations](#current-limitations)
  - [Roadmap](#roadmap)
    - [Before the 1.0 release](#before-the-10-release)
    - [After the 1.0 release](#after-the-10-release)
  - [Getting started](#getting-started)
    - [New users](#new-users)
    - [Migration](#migration)
    - [Installing with npm](#installing-with-npm)
    - [Updates](#updates)
  - [Tips \& tricks](#tips--tricks)
    - [Providing a JSON configuration file](#providing-a-json-configuration-file)
    - [Migrating from Git Gateway backend](#migrating-from-git-gateway-backend)
    - [Moving your site from Netlify to another hosting service](#moving-your-site-from-netlify-to-another-hosting-service)
    - [Working around authentication error](#working-around-authentication-error)
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
    - [Disabling automatic deployments](#disabling-automatic-deployments)
    - [Setting up Content Security Policy](#setting-up-content-security-policy)
  - [Support \& feedback](#support--feedback)
  - [Contributions](#contributions)
  - [Related links](#related-links)
    - [As seen on](#as-seen-on)
  - [Disclaimer](#disclaimer)
# Sveltia CMS

Sveltia CMS is a Git-based lightweight headless CMS under active development as a modern, quick replacement for Netlify CMS and Decap CMS. In some simple cases, migration is as easy as a single line of code change, although we are still working on improving compatibility. The free, open source, UX-focused alternative to Netlify/Decap CMS is now in public beta — with more features to come.

![Screenshot: Open Source Git-based Headless CMS](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-1-20240507.webp)<br>

![Screenshot: Fast and Lightweight; Modern UX with Dark Mode](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-2-20240507.webp)<br>

![Screenshot: Stock Photo Integration with Pexels, Pixabay and Unsplash](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-3-20240507.webp)<br>

![Screenshot: All-New Asset Library; First Class I18n Support with DeepL](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-4-20240507.webp)<br>

![Screenshot: Works with Remote (GitHub, GitLab) and Local Repositories; Single Line Migration from Netlify/Decap CMS (depending on your current setup); Sveltia CMS](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-5-20240507.webp)<br>

## Motivation

Sveltia CMS was born in November 2022, when the progress of Netlify CMS was stalled for more than six months. [@kyoshino](https://github.com/kyoshino)’s clients wanted to replace their Netlify CMS instances without much effort, mainly to get better internationalization (i18n) support.

To achieve radical improvements in UX, performance, i18n and other areas, it was decided to build an alternative from the ground up, while ensuring an easy migration path from the other. After proving the concept with a rapid [Svelte](https://svelte.dev/) prototype, development was accelerated to address their primary use cases. The new product has since been named Sveltia CMS and released as open source software to encourage wider adoption.

### Our advantage

Due to its unfortunate abandonment, Netlify CMS spawned 3 successors:

- [Static CMS](https://github.com/StaticJsCMS/static-cms): a community maintenance fork, initial commit made in September 2022, discontinued in September 2024
- **Sveltia CMS**: a total reboot, started in November 2022, first appeared on GitHub in March 2023
- [Decap CMS](https://github.com/decaporg/decap-cms): a rebranded version, owned by a Netlify agency partner, [announced in February 2023](https://www.netlify.com/blog/netlify-cms-to-become-decap-cms/) as the official successor

Sveltia CMS is the only project that doesn’t inherit the complexity, technical debt and miscellaneous bugs of Netlify CMS, which was launched back in 2016. We are confident that our decision to rebuild the application from scratch was the right one, as proven by the hundreds of improvements we have already made.

While Sveltia CMS is specifically designed to replace legacy Netlify CMS instances, it also aims to serve as a substitute for the other products. (Note: While we are closely following the development of Decap CMS, compatibility with Static CMS will be worked on after the release of Sveltia CMS 1.0)

### Our goals

- Making Sveltia CMS a viable, definitive successor to Netlify CMS
- Emerging as the leading open source offering in the Git-based CMS market
- Empowering small businesses and individuals who need a simple, free, yet powerful CMS solution
- Extending its capabilities as digital asset management (DAM) software
- Showcasing the vast potential of the Svelte framework

## Development status

Sveltia CMS is **still in beta**, so please be careful when trying it out.

While we fix reported bugs as quickly as possible, usually within 24 hours, our overall progress may be slower than you think. The thing is, it’s not just a personal project of [@kyoshino](https://github.com/kyoshino), but also involves different kinds of activities:

- Ensuring substantial [compatibility with existing versions of Netlify/Decap CMS](#compatibility)
- Tackling as many [Netlify/Decap CMS issues](https://github.com/decaporg/decap-cms/issues) as possible
  - So far, 120+ of them (or 215+ including duplicates) have been effectively solved in Sveltia CMS
  - Target: 150 issues by GA, 250 (or all the relevant and fixable issues) in a future release
  - [Let us know](https://github.com/sveltia/sveltia-cms/issues/new) if you have any specific issues you’d like to see solved!
- Responding to feedback from clients and regular users
- Implementing our own enhancement ideas for every part of the product

Sveltia CMS **version 1.0 is expected to ship by the end of 2024**. Check our [release notes](https://github.com/sveltia/sveltia-cms/releases) for updates. See also our [roadmap](#roadmap).

![120 Netlify/Decap CMS Issues Solved in Sveltia CMS](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/headline-1-20240928.webp)<br>

## Features

We are working hard to create a **significantly better alternative to Netlify CMS and Decap CMS** by improving everything. Here’s what makes Sveltia CMS different. Look how serious we are!

### Compatible with Netlify/Decap CMS

- Ready to be used as a drop-in replacement for Netlify/Decap CMS _in some casual use case scenarios_ with a single line of code update.
- Your existing [configuration file](https://decapcms.org/docs/configuration-options/) can be reused as is.
- However, some features are still missing or will not be added, most notably Git Gateway and Netlify Identity. Look at the [compatibility info](#compatibility) below to see if you can migrate now or soon.

### Better UX

- Created and maintained by an [experienced UX engineer](https://github.com/kyoshino) who loves code, design and marketing. You can expect constant improvements to the user experience (UX) and developer experience (DX) across the platform.
- Offers a modern, intuitive user interface, including an immersive dark mode[^2], inspired in part by the Netlify CMS v3 prototype[^1].
- Comes with touch device support, such as larger buttons for easier tapping. While the UI is not yet optimized for small screens, it should work well with large tablets like iPad Pro or Pixel Tablet. Mobile support and other optimizations such as swipe navigation are planned after the 1.0 release.
- Made with Svelte, not React, means we can spend more time on UX rather than tedious state management. It also allows us to avoid common fatal application crashes[^113][^129]. Best of all, Svelte offers unmatched performance!
- The Account menu contains relevant links, including release notes, feedback and help.
- Users can customize the application with various settings.
- Never miss out on the latest features and bug fixes by being notified when an update to the CMS is available[^31]. Then update to the latest version with a single click[^66].
- The screenshots above are worth a thousand words, but read on to learn about many other improvements in detail.

### Better performance

- Built completely from scratch with Svelte instead of forking React-based Netlify/Decap CMS. The app starts fast and stays fast. The compiled code is vanilla JavaScript — you can use it with any framework or static site generator (SSG) that can load static data files during the build process.
- Small footprint: The bundle size is less than 450 KB when minified and brotlied, which is much lighter than Netlify CMS (1.5 MB), Decap CMS (1.8 MB) and Static CMS (2.6 MB)[^57][^64], even though we haven’t implemented some features yet. That’s the power of Svelte + Vite.
- We have upgraded from Svelte 4 to [Svelte 5 Release Candidate](https://svelte.dev/blog/svelte-5-release-candidate) to further improve performance, including an even smaller bundle size. A full migration to the _runes_ reactivity API will follow.
- Sveltia CMS is free of technical debt and [virtual DOM overhead](https://svelte.dev/blog/virtual-dom-is-pure-overhead).
- Uses the GraphQL API for GitHub and GitLab to quickly fetch content at once, so that entries and assets can be listed and searched instantly[^32][^65]. It also avoids the slowness and potential API rate limit violations caused by hundreds of requests with Relation widgets[^14].
- Saving entries and assets to GitHub is also much faster thanks to the [GraphQL mutation](https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/).
- Using caching and lazy loading techniques. A list of repository files is stored locally for faster startup and bandwidth savings.
- Sorting, filtering and grouping of entries is done instantly without reloading the entire content.
- Thumbnails of assets, including videos and PDF files, are generated and cached for faster rendering of the Asset Library and other parts of the CMS[^39].
- No typing lag on input widgets, especially within nested lists and objects[^77].

### Better productivity

- You can [work with a local Git repository](#working-with-a-local-git-repository) without any extra configuration or proxy server[^26].
  - In addition to a streamlined workflow, it offers great performance by reading and writing files natively through the browser rather than using a slow, ad hoc REST API.
  - It also avoids a number of issues, including the 30 MB file size limit[^51], an unknown error with `publish_mode`[^75], and an unused `logo_url`[^49].
  - When you delete an entry or an asset file, the empty folder that contains it is also deleted, so you don’t have to delete it manually.
- Provides a smoother user experience in the Content Editor:
  - A local backup of an entry draft is automatically created without interruption by a confirmation dialog, which annoys users and can cause a page navigation problem if dismissed[^106]. The backup can then be reliably restored without unexpected overwriting[^85].
  - Click once (the Save button) instead of twice (Publish > Publish now) to save an entry.
  - The editor closes automatically when an entry is saved. This behaviour can be changed in Settings.
- You can upload multiple assets at once[^5].
- You can delete multiple entries and assets at once.
- Some [keyboard shortcuts](#using-keyboard-shortcuts) are available for faster editing.

### Better accessibility

- Improved keyboard handling lets you efficiently navigate through UI elements using the Tab, Space, Enter and arrow keys[^17][^67].
- Comprehensive [WAI-ARIA](https://w3c.github.io/aria/) support enables users who rely on screen readers such as NVDA and VoiceOver.
- The rich text editor is built with [Lexical](https://lexical.dev/), which is said to follow accessibility best practices. The [Dragon NaturallySpeaking support](https://lexical.dev/docs/packages/lexical-dragon) is enabled.
- Ensures sufficient contrast between the foreground text and background colours.
- Enabled and disabled buttons can be clearly distinguished[^105].
- Links are underlined by default to make them easier to recognize. This behaviour can be changed in the Accessibility Settings if you prefer.
- Honours your operating system’s [reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) and [reduced transparency](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency) settings. (Support for [high contrast mode](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast) will be added later.)
- Browser console logs for developers are readable in either light or dark mode[^116].
- We’ll continue to test and improve the application to meet [WCAG 2.2](https://w3c.github.io/wcag/guidelines/22/).

### Better security

- Avoids severity vulnerabilities through constant dependency updates, [`pnpm audit`](https://pnpm.io/cli/audit), and frequent releases[^33].
- We have enabled [npm package provenance](https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/).
- We have documented how to [set up a Content Security Policy](#setting-up-content-security-policy) for the CMS to prevent any unexpected errors or otherwise insecure configuration[^108].
- The `unsafe-eval` and `unsafe-inline` keywords are not needed in the `script-src` CSP directive[^34].
- The `same-origin` referrer policy is automatically set with a `<meta>` tag.

### Better configuration

- Some servers and frameworks remove the trailing slash from the CMS URL (`/admin`) depending on the configuration. In such cases, the config file is loaded from a root-relative URL (`/admin/config.yml`) instead of a regular relative URL (`./config.yml` = `/config.yml`) that results in a 404 Not Found error[^107].
- Supports a [JSON configuration file](#providing-a-json-configuration-file) that can be generated for bulk or complex collections[^60].
- The application renders within the dimensions of a [custom mount element](https://decapcms.org/docs/custom-mounting/), if exists[^109].

### Better backend support

- Uses the GraphQL API where possible for better performance, as mentioned above. You don’t need to set the `use_graphql` option to enable it for GitHub and GitLab.
- The Git branch name is automatically set to the repository’s default branch (`main`, `master` or whatever) if not specified in the configuration file, preventing data loading errors due to a hardcoded fallback to `master`[^95][^27].
- You can [disable automatic deployments](#disabling-automatic-deployments) by default or on demand to save costs and resources associated with CI/CD and to publish multiple changes at once[^24].
- The GitLab backend support comes with background [service status](https://status.gitlab.com/) checking, just like GitHub.
- Service status checks are performed frequently and an incident notification is displayed prominently.
- You can quickly open the source file of an entry or asset in your repository using View on GitHub (or GitLab) under the 3-dot menu.
- We provide [our own OAuth client](https://github.com/sveltia/sveltia-cms-auth) for GitHub and GitLab.
- You won’t get a 404 Not Found error when you sign in to the GitLab backend[^115].
- Features the all-new local backend that boosts DX. See the [productivity section](#better-productivity) above.
- You can select the local and remote backends while working on a local server.

### Better i18n support

Sveltia CMS has been built with a multilingual architecture from the very beginning. You can expect first-class internationalization (i18n) support, as it’s required by clients of maintainer [@kyoshino](https://github.com/kyoshino), who himself was a long-time Japanese localizer for Mozilla and currently lives in a [city](https://en.wikipedia.org/wiki/Toronto) where 150+ languages are spoken.

- Configuration
  - Supports multiple files/folders i18n structure for file collections[^87]. To enable it, simply use the `{{locale}}` template tag in the `file` path option, e.g. `content/pages/about.{{locale}}.json` or `content/pages/{{locale}}/about.json`. For backward compatibility, the global `structure` option only applies to folder collections as before.
  - [Entry-relative media folders](https://decapcms.org/docs/collection-folder/#media-and-public-folder) can be used in conjunction with the `multiple_folders` i18n structure[^21].
  - Removes the [limitations in the List and Object widgets](https://decapcms.org/docs/i18n/#limitations) so that changes made with these widgets will be duplicated between locales as expected when using the `i18n: duplicate` field configuration[^7][^68].
  - You can use the `{{locale}}` template tag in the [`preview_path`](https://decapcms.org/docs/configuration-options/#preview_path) collection option to provide site preview links for each language[^63].
  - You can [use a random UUID for an entry slug](#using-a-random-id-for-an-entry-slug), which is a good option for locales that write in non-Latin characters.
  - You can [localize entry slugs](#localizing-entry-slugs) while linking the localized files[^80], thanks to the support for Hugo’s `translationKey`[^81].
  - When the `clean_accents` option is enabled for [entry slugs](https://decapcms.org/docs/configuration-options/#slug-type), certain characters, such as German umlauts, will be [transliterated](https://www.npmjs.com/package/@sindresorhus/transliterate)[^99].
  - You can embed the locale code in an entry by using `widget: hidden` along with `default: '{{locale}}'`[^101].
- User interface
  - Eliminates UI confusion: The preview pane can be displayed without toggling i18n in the Content Editor. Both panes are scrollable. There is no condition where both panes are edited in the same language at the same time.
  - You can easily switch between locales while editing by clicking a button instead of a dropdown list. No internal error is thrown when changing the locale[^103].
  - Language labels appear in human-readable display names instead of ISO 639 language codes, which not everyone is familiar with. (For example, it might be difficult to recognize `DE` as German, `NL` as Dutch, or `ZH` as Chinese.)
  - The List widget’s `label` and `label_singular` are not converted to lowercase, which is especially problematic in German, where all nouns are capitalized[^98].
  - Long menu item labels, especially in non-English locales, don’t overflow the dropdown container[^117].
- Content editing
  - [Integrates DeepL](#using-deepl-to-translate-entry-fields) to allow translation of text fields from another locale with one click. More translation services will be added in the future.
  - You can [disable non-default locale content](#disabling-non-default-locale-content)[^15].
  - Boolean, DateTime, List and Number fields in the entry preview are displayed in a localized format.
  - Boolean fields are updated in real time between locales like other widgets to avoid confusion[^35].
  - Relation fields with i18n enabled won’t trigger a change in the content draft status when you start editing an existing entry[^84].
  - Solves problems with Chinese, Japanese and Korean (CJK) [IME](https://en.wikipedia.org/wiki/Input_method) text input in the rich text editor for the Markdown widget[^54].
  - Raises a validation error instead of failing silently if the `single_file` structure is used and a required field is not filled in any of the locales[^55].
  - Fields in non-default locales are validated as expected[^13].

### Better collections

- Configuration
  - You can [choose a custom icon for each collection](#using-a-custom-icon-for-a-collection) with the new `icon` collection option[^3].
  - You can [add dividers to the collection list](#adding-dividers-to-the-collection-list) with the new `divider` collection option.
  - You can specify the field name for a thumbnail displayed on the entry list with the new `thumbnail` collection option[^130]. A nested field can be specified using dot notation, e.g. `images.0.src`. If undefined, the `name` of the first image field is used.
  - You can use nested fields (dot notation) in the `path` option for a folder collection, e.g. `{{fields.state.name}}/{{slug}}`[^62].
  - You can use Markdown in the `description` collection option[^79]. Bold, italic, strikethrough, code and links are allowed.
- Entry slugs
  - You can [use a random UUID for an entry slug](#using-a-random-id-for-an-entry-slug).
  - Entry slug template tags support [filter transformations](https://decapcms.org/docs/summary-strings/) just like summary string template tags[^29].
  - Single quotes in a slug will be replaced with `sanitize_replacement` (default: hyphen) rather than being removed[^52].
  - You can set the maximum number of characters for an entry slug with the new `slug_length` collection option[^25].
- Entry listing
  - The collection list displays the number of items in each collection.
  - A folder collection filter with a boolean value works as expected[^93].
  - Hugo’s special `_index.md` files are ignored in folder collections unless the `path` option is configured to end with `_index` and the `extension` is `md`[^120]. You can still manage these files as part of a file collection if necessary.
  - If there was an error while parsing an entry file, such as duplicate front matter keys, it won’t show up as a blank entry, and a clear error message will be displayed in the browser console[^121].
  - Sorting entries by a DateTime field works as expected[^110].
  - Assets stored in a [per-collection media folder](#using-a-custom-media-folder-for-a-collection) can be displayed next to the entries.
  - The New Entry button won’t appear when a developer accidentally sets the `create: true` option on a file collection because it’s useless[^89].
  - The Delete Entry button won’t appear when a developer accidentally sets the `delete: true` option on a file collection because the preconfigured files should not be deleted.
  - A single file can be used for more than one item in a file collection[^127].

### Better content editing

- Required fields, not optional fields, are clearly marked for efficient data entry.
- You can revert changes to all fields or a specific field.
- If you revert changes and there are no unsaved changes, the Save button is disabled as expected[^118].
- You can hide the preview of a specific field with `preview: false`[^126].
- Fields with validation errors are automatically expanded if they are part of nested, collapsed objects[^40].
- When you click on a field in the preview pane, the corresponding field in the edit pane is highlighted. It will be automatically expanded if collapsed[^41].
- The preview pane displays all fields, including each title, making it easier to see which fields are populated.
- Provides better scroll synchronization between the panes when editing or previewing an entry[^92].
- You can use a full regular expression, including flags, for the widget `pattern` option[^82]. For example, if you want to allow 280 characters or less in a multiline text field, you could write `/^.{0,280}$/s` (but you can now use the `maxlength` option instead).
- A long validation error message is displayed in full, without being hidden behind the field label[^59].
- Any links to other entries will work as expected, with the Content Editor being updated for the other[^100].

### Better data output

- Keys in generated JSON/TOML/YAML content are always sorted by the order of configured fields, making Git commits clean and consistent[^86].
- For data consistency, Boolean, List (see below) and other fields are always saved as a proper value, such as an empty string or an empty array, rather than nothing, even if it’s optional or empty[^45][^46][^44].
- Leading and trailing spaces in text-type field values are automatically removed when you save an entry[^37].
- JSON/TOML/YAML data is saved with a new line at the end of the file to prevent unnecessary changes being made to the file[^11][^69].
- String values in YAML files can be quoted with the new `yaml_quote: true` option for a collection, mainly for framework compatibility[^9].
- YAML string folding (maximum line width) is disabled, mainly for framework compatibility[^119].

### Better widgets

- Boolean
  - A required Boolean field with no default value is saved as `false` by default, without raising a confusing validation error[^45].
  - An optional Boolean field with no default value is also saved as `false` by default, rather than nothing[^46].
- Color
  - The widget doesn’t cause scrolling issues[^128].
  - The preview shows both the RGB(A) hex value and the `rgb()` function notation.
- DateTime
  - A DateTime field doesn’t trigger a change in the content draft status when you’ve just started editing a new entry[^90].
- Hidden
  - The `default` value is saved when you create a file collection item, not just a folder collection item[^78].
  - The `default` value supports the `{{locale}}` and `{{datetime}}` template tags, which will be replaced by the locale code and the current date/time in [ISO 8601 format](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format), respectively[^101][^102].
- List
  - The Add Item button appears at the bottom of the list when the `add_to_top` option is not `true`, so you don’t have to scroll up each time to add new items.
  - You can expand or collapse the entire list, while the Expand All and Collapse All buttons allow you to expand or collapse all items in the list at once.
  - A required List field with no subfield or value is marked as invalid[^43].
  - An optional List field with no subfield or value is saved as an empty array, rather than nothing[^44].
  - You can enter spaces in a simple text-based List field[^50].
  - You can preview variable types without having to register a preview template[^42].
- Markdown
  - The rich text editor is built with [Lexical](https://lexical.dev/), which solves various issues with a [Slate](https://github.com/ianstormtaylor/slate)-based editor in Netlify/Decap CMS, including fatal application crashes[^71][^72][^73][^111], lost formatting when pasting[^124], backslash injections[^53], dropdown visibility[^70], and text input difficulties with IME[^54].
  - You can set the default editor mode by changing the order of the `modes` option[^58]. If you want to use the plain text editor by default, add `modes: [raw, rich_text]` to the field configuration.
  - Line breaks are rendered as line breaks in the preview pane according to GitHub Flavored Markdown.
- Object
  - Sveltia CMS offers two ways to have conditional fields in a collection[^30]:
    - You can use [variable types](https://decapcms.org/docs/variable-type-widgets/) (the `types` option) with the Object widget just like the List widget.
    - An optional Object field (`required: false`) can be manually added or removed with a checkbox[^88]. If unadded or removed, the required subfields won’t trigger validation errors[^16], and the field will be saved as `null`.
- Relation
  - Field options are displayed with no additional API requests[^14]. The confusing `options_length` option, which defaults to 20, is therefore ignored[^76].
  - `slug` can be used for `value_field` to show all available options instead of just one in some situations[^91].
  - Template strings with a wildcard like `{{cities.*.name}}` can also be used for `value_field`[^94].
  - `display_fields` is displayed in the preview pane instead of `value_field`.
  - The redundant `search_fields` option is not required in Sveltia CMS, as it defaults to `display_fields` (and `value_field`).
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
    - _Compatibility note_: In Static CMS, these options are implemented as `prefix` and `suffix`, respectively.
- File and Image
  - Provides a reimagined all-in-one asset selection dialog for File and Image fields.
    - [Collection-specific assets](#using-a-custom-media-folder-for-a-collection) are listed for easy selection, while all assets are displayed in a separate tab[^19].
    - A new asset can be uploaded by dragging & dropping it into the dialog[^20].
    - A URL can also be entered in the dialog.
    - Integration with Pexels, Pixabay and Unsplash makes it easy to select and insert a free stock photo[^8]. More stock photo providers will be added in the future.
  - Large images automatically fit in the preview pane instead of being displayed at their original size, which can easily exceed the width of the pane.
- List and Object
  - The `summary` is displayed correctly when it refers to a Relation field[^36] or a simple List field.
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

- A completely new Asset Library, built separately from the image selection dialog, makes it easy to manage all of your files, including images, videos and documents[^96].
  - Navigate between the global media folder and per-collection media folders[^6].
  - Preview image, audio, video, text and PDF files. Check your site’s [CSP](#setting-up-content-security-policy) if the preview doesn’t work.
  - Copy the public URL[^74], file path, text data or image data of a selected asset to clipboard. The file path starts with `/` as expected[^48].
  - Edit a plain text asset, including SVG images.
  - Rename an existing asset. If the asset is used in any entries, the File/Image fields will be automatically updated with a new file path.
  - Replace an existing asset.
  - Download one or more selected assets at once.
  - Delete one or more selected assets at once.
  - Upload multiple assets at once, including files in nested folders, by browsing or dragging and dropping them into the library[^5].
  - Sort or filter assets by name or file type.
  - View asset details, including size, dimensions, commit author/date and a list of entries that use the selected asset.
- PDF documents are displayed with a thumbnail image in both the Asset Library and the Select File dialog, making it easier to find the file you’re looking for[^38].
- Assets stored in an entry-relative media folder are automatically deleted when the associated entry is deleted because these assets are not available for other entries[^22]. When you’re [working with a local repository](#working-with-a-local-git-repository), the empty enclosing folder is also deleted.
- Hidden files (dot files) don’t appear in the Asset Library[^47].
- You can add assets using the Quick Add button in the upper right corner of the application.
- Files are uploaded with their original names, without converting uppercase letters and spaces to lowercase letters and hyphens[^97].
- No fatal application crash when uploading assets[^112].

## Compatibility

We are trying to make Sveltia CMS compatible with Netlify/Decap CMS where possible, so that more users can seamlessly switch to our modern, powerful, high performance alternative. However, some features will be omitted due to deprecations and other factors.

### Features not to be implemented

- **The Bitbucket, Gitea/Forgejo and Git Gateway backends will not be supported** for performance reasons. We may implement a high-performance Git Gateway alternative in the future. We may also support the other services if/when their APIs improve to allow the CMS to fetch multiple files at once.
- **The Netlify Identity widget will not be supported**, as it’s not useful without Git Gateway. We may be able to support it in the future if/when a Git Gateway alternative is created.
- The deprecated client-side implicit grant for the GitLab backend will not be supported, as it has already been [removed from GitLab 15.0](https://gitlab.com/gitlab-org/gitlab/-/issues/344609). Use the client-side PKCE authorization instead.
- The deprecated Netlify Large Media service will not be supported. Consider other storage providers.
- The deprecated Date widget will not be supported, as it has already been removed from Decap CMS 3.0. Use the DateTime widget instead.
- Remark plugins will not be supported, as they are not compatible with our Lexical-based rich text editor.
- [Undocumented methods](https://github.com/sveltia/sveltia-cms/blob/c69446da7bb0bab7405be741c0f92850c5dddfa8/src/main.js#L14-L37) exposed on the `window.CMS` object will not be implemented. This includes custom backends and custom media libraries, if any.

### Current limitations

These limitations are expected to be resolved before or shortly after GA:

| Feature | Status in Sveltia CMS |
| --- | --- |
| Backends | The Test backend needed for our demo site is not yet added. We’ll see if Azure can also be supported. |
| Configuration | Comprehensive config validation is not yet implemented. |
| Localization | The application UI is only available in English and Japanese at this time. |
| Media Libraries | Cloudinary and Uploadcare are not yet supported. |
| Workflow | Editorial Workflow and Open Authoring are not yet supported. |
| Collections | Nested collections are not yet supported. |
| Widgets | Custom widgets are not yet supported. See the table below for other limitations. |
| Customizations | Custom previews, custom formatters and event subscriptions are not yet supported. |

| Widget | Status in Sveltia CMS |
| --- | --- |
| Code | Not yet supported. |
| DateTime | The `date_format` and `time_format` options with Moment.js tokens are not yet supported. Note that [Decap CMS 3.1.1](https://github.com/decaporg/decap-cms/releases/tag/decap-cms%403.1.1) replaced Moment.js with [Day.js](https://day.js.org/), and [Decap CMS 3.3.0](https://github.com/decaporg/decap-cms/releases/tag/decap-cms%403.3.0) made other changes to the widget behaviour; we’ll follow these changes soon. |
| File/Image | Field-specific media folders and media library options are not yet supported other than `media_library.config.max_file_size` for the default media library. |
| Map | Not yet supported. |
| Markdown | Editor components, including built-in `image` and `code-block` as well as custom components, are not yet supported. |

Missing any other features? Let us know by [filing an issue](https://github.com/sveltia/sveltia-cms/issues/new).

## Roadmap

### Before the 1.0 release

- [Svelte 5](https://svelte.dev/blog/svelte-5-release-candidate) _runes_ migration
- Enhanced [compatibility with Netlify/Decap CMS](#compatibility)
- Certain compatibility with Static CMS, a now-discontinued community fork of Netlify CMS, specifically the [KeyValue widget](https://staticjscms.netlify.app/docs/widget-keyvalue)[^123]
- Localization with the new [Fluent](https://projectfluent.org)-powered sveltia-i18n library
- Accessibility audit
- Developer documentation (implementation guide)
- Marketing site
- Live demo site
- Official starter templates for the most popular frameworks, including SvelteKit and Next.js
- Broad automation test coverage (Vitest + Playwright)

### After the 1.0 release

- Tackling more Netlify/Decap CMS issues, especially the [top voted features](https://github.com/decaporg/decap-cms/issues?q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc), including MDX support[^122], manual entry sorting[^125], roles[^23], mobile optimization[^18] and config editor[^10] — Some features are already implemented in Sveltia CMS
- Advanced digital asset management (DAM) features, including image editing and tagging[^114]
- AI integrations for image generation and content writing
- End-user documentation
- Contributor documentation
- Marketplace for custom widgets, etc.
- and so much more!

## Getting started

### New users

Currently, Sveltia CMS is primarily intended for existing Netlify/Decap CMS users. If you don’t have it yet, follow [their documentation](https://decapcms.org/docs/basic-steps/) to add it to your site and create a configuration file first. Then migrate to Sveltia CMS as described below.

As the product evolves, we’ll implement a built-in configuration editor and provide comprehensive documentation to make it easier for everyone to get started with Sveltia CMS.

Here are some starter kits for popular frameworks created by community members. More to follow!

- [Eleventy starter template](https://github.com/danurbanowicz/eleventy-sveltia-cms-starter) by [@danurbanowicz](https://github.com/danurbanowicz)
- [Hugo module](https://github.com/privatemaker/headless-cms) by [@privatemaker](https://github.com/privatemaker)
- [hugolify-sveltia-cms](https://github.com/Hugolify/hugolify-sveltia-cms/) by [@sebousan](https://github.com/sebousan)
- Astro: [astro-sveltia-cms](https://github.com/majesticostudio/astro-sveltia-cms), [astro-starter](https://github.com/zankhq/astro-starter) and [astros](https://github.com/zankhq/astros) by [@zanhk](https://github.com/zanhk)

Alternatively, you can probably use one of the [Netlify/Decap CMS templates](https://decapcms.org/docs/start-with-a-template/) and make a quick migration to Sveltia CMS.

### Migration

Have a look at the [compatibility info](#compatibility) above first. If you’re already using Netlify/Decap CMS with the GitHub or GitLab backend and don’t have any custom widget, custom preview or plugin, migrating to Sveltia CMS is super easy — it works as a drop-in replacement. Edit `/admin/index.html` to replace the CMS `<script>` tag, and push the change to your repository. Your new `<script>` tag is:

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

### Installing with npm

For advanced users, we have also made the bundle available as an [npm package](https://www.npmjs.com/package/@sveltia/cms). You can install it by running `npm i @sveltia/cms` or `pnpm add @sveltia/cms` on your project. The [manual initialization](https://decapcms.org/docs/manual-initialization/) flow with the `init` method is the same as for Netlify/Decap CMS.

### Updates

Updating Sveltia CMS is transparent, unless you include a specific version in the `<script>` source URL or use the npm package. Whenever you (re)load the CMS, the latest version will be served via [UNPKG](https://unpkg.com/). The CMS also periodically checks for updates and notifies you when a new version is available. After the product reaches GA, you could use a semantic version range (`^1.0.0`) like Netlify/Decap CMS.

If you’ve chosen to install with npm, updating the package is your responsibility. We recommend using [`ncu`](https://www.npmjs.com/package/npm-check-updates) or a service like [Dependabot](https://github.blog/2020-06-01-keep-all-your-packages-up-to-date-with-dependabot/) to keep dependencies up to date, otherwise you’ll miss important bug fixes and new features.

## Tips & tricks

### Providing a JSON configuration file

Sveltia CMS supports a configuration file written in the JSON format in addition to the standard YAML format. This allows developers to programmatically generate the CMS configuration to enable bulk or complex collections. To do this, simply add a `<link>` tag to your HTML, just like a [custom YAML config link](https://decapcms.org/docs/configuration-options/#configuration-file), but with the type `application/json`:

```html
<link href="path/to/config.json" type="application/json" rel="cms-config-url" />
```

Alternatively, you can [manually initialize](https://decapcms.org/docs/manual-initialization/) the CMS with a JavaScript configuration object.

### Migrating from Git Gateway backend

Sveltia CMS does not support the Git Gateway backend due to performance limitations. If you don’t care about user management with Netlify Identity, you can use the [GitHub backend](https://decapcms.org/docs/github-backend/) or [GitLab backend](https://decapcms.org/docs/gitlab-backend/) instead. Make sure **you install an OAuth client** on GitHub or GitLab in addition to updating your configuration file. As noted in the document, Netlify is still able to facilitate the auth flow.

Once you have migrated from the Git Gateway and Netlify Identity combo, you can remove the Netlify Identity widget script tag from your HTML:

```diff
-<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
```

### Moving your site from Netlify to another hosting service

You can host your Sveltia CMS-managed site anywhere, such as [Cloudflare Pages](https://pages.cloudflare.com/) or [GitHub Pages](https://pages.github.com/). But moving away from Netlify means you can no longer sign in with GitHub or GitLab via Netlify. Instead, you can use [our own OAuth client](https://github.com/sveltia/sveltia-cms-auth), which can be easily deployed to Cloudflare Workers, or [any other 3rd party client](https://decapcms.org/docs/external-oauth-clients/) made for Netlify/Decap CMS.

### Working around authentication error

If you get an “Authentication Aborted” error when trying to sign in to GitHub or GitLab using the authorization code flow, you may need to check your site’s [`Cross-Origin-Opener-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy). The COOP header is not widely used, but it’s known to break the OAuth flow with a popup window. If that’s your case, changing `same-origin` to `same-origin-allow-popups` solves the problem. ([Discussion](https://github.com/sveltia/sveltia-cms/issues/131))

### Working with a local Git repository

You can use Sveltia CMS with a local Git repository like Netlify/Decap CMS, but Sveltia CMS has simplified the workflow by removing the need for additional configuration (the `local_backend` property) and a proxy server, thanks to the [File System Access API](https://developer.chrome.com/articles/file-system-access/) available in [some modern browsers](https://developer.mozilla.org/en-US/docs/web/api/window/showopenfilepicker#browser_compatibility).

1. Make sure you have configured the [GitHub](https://decapcms.org/docs/github-backend/) or [GitLab](https://decapcms.org/docs/gitlab-backend/) backend.
   - Please note that the Git Gateway backend mentioned in the Netlify/Decap CMS [local Git repository document](https://decapcms.org/docs/working-with-a-local-git-repository/) is not supported in Sveltia CMS, so `name: git-gateway` won’t work. You’ll need either `name: github` or `name: gitlab` along with the `repo` definition. If you haven’t determined your repository name yet, just use a random one.
   - You can remove `local_backend` from your configuration, as it will be ignored by Sveltia CMS.
1. Launch the local development server for your frontend framework, typically with `npm run dev` or `pnpm dev`.
1. Visit `http://localhost:[port]/admin/index.html` with Chrome or Edge. The port number varies by framework.
   - Other Chromium-based browsers may also work. Brave user? [See below](#enabling-local-development-in-brave).
1. Click “Work with Local Repository” and select the project’s root directory once prompted.
   - If you get an error saying “not a repository root directory”, make sure you’ve turned the folder into a repository with either a CUI ([`git init`](https://github.com/git-guides/git-init)) or GUI, and the hidden `.git` folder exists.
   - If you’re using Windows Subsystem for Linux (WSL), you may get an error saying “Can’t open this folder because it contains system files.” This is due to a limitation in the browser, and you can try some workarounds mentioned in [this issue](https://github.com/coder/code-server/issues/4646) and [this thread](https://github.com/sveltia/sveltia-cms/discussions/101).
1. Make some changes to your content on Sveltia CMS.
1. See if the produced changes look good using `git diff` or a GUI like [GitHub Desktop](https://desktop.github.com/).
1. Open the dev site at `http://localhost:[port]/` to check the rendered pages.
1. Commit and push the changes if satisfied, or discard them if you’re just testing.

Keep in mind that the local repository support doesn’t perform any Git operations. You’ll have to manually fetch, pull, commit and push all changes using a Git client. In the near future, we’ll figure out if there’s a way to do this in a browser (because `netlify-cms-proxy-server` actually has undocumented `git` mode that allows developers to create commits to a local repository).

Also, at this point, you have to reload the CMS to see the latest content after retrieving remote updates. This manual work will be unnecessary once the proposed `FileSystemObserver` API, which is being [implemented in Chromium](https://issues.chromium.org/issues/40105284) behind a flag, becomes available.

### Enabling local development in Brave

In the Brave browser, you must enable the File System Access API with an experiment flag to take advantage of local development.

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

Sveltia CMS allows developers to add dividers to the collection list to distinguish different types of collections. To do this, insert a fake collection with the `divider: true` option along with a random `name`. In VS Code, you may get a validation error if `config.yml` is treated as a “Netlify YAML config” file. You can work around this by adding an empty `files` as well:

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

This is actually not new in Sveltia CMS but rather an _undocumented_ feature in Netlify/Decap CMS[^4]. You can specify media and public folders for each collection that override the [global media folder](https://decapcms.org/docs/configuration-options/#media-and-public-folders). Well, it’s [documented](https://decapcms.org/docs/collection-folder/#media-and-public-folder), but that’s probably not what you want.

Rather, if you’d like to add all the media files for a collection in one single folder, specify both `media_folder` and `public_folder` instead of leaving them empty. The trick is to use an _absolute path_ for `media_folder` like the example below. You can try this with Netlify/Decap CMS first if you prefer.

```diff
 media_folder: static/media
 public_folder: /media

 collections:
   - name: products
     label: Products
     create: true
     folder: data/products/
+    media_folder: /static/media/products
+    public_folder: /media/products
```

In Sveltia CMS, those per-collection media folders are displayed prominently for easier asset management.

### Using keyboard shortcuts

- View the Content Library: `Alt+1`
- View the Asset Library: `Alt+2`
- Search for entries and assets: `Ctrl+F` (Windows/Linux) or `Command+F` (macOS)
- Create a new entry: `Ctrl+E` (Windows/Linux) or `Command+E` (macOS)
- Save an entry: `Ctrl+S` (Windows/Linux) or `Command+S` (macOS)
- Cancel entry editing: `Escape`

### Using DeepL to translate entry fields

Sveltia CMS comes with a handy DeepL integration so that you can translate any text field from another locale without leaving the content editor. To enable the high quality, AI-powered, quick translation feature:

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
  title: My trip to New York
  translationKey: my-trip-to-new-york
  ```
- `data/posts/fr/mon-voyage-a-new-york.yaml`
  ```yaml
  title: Mon voyage à New York
  translationKey: my-trip-to-new-york
  ```

You can customize the property name and value for a different framework or i18n library by adding the `canonical_slug` option to your top-level or per-collection `i18n` configuration. The example below is for [@astrolicious/i18n](https://github.com/astrolicious/i18n), which requires a locale prefix in the value ([discussion](https://github.com/sveltia/sveltia-cms/issues/137)):

```yaml
i18n:
  canonical_slug:
    key: defaultLocaleVersion # default: translationKey
    value: 'en/{{slug}}' # default: {{slug}}
```

Or, for [Jekyll](https://migueldavid.eu/how-to-make-jekyll-multilingual-c13e74c18f1c), you may want to use the `ref` property:

```yaml
i18n:
  canonical_slug:
    key: ref
```

### Disabling non-default locale content

You can now disable output of content in selected non-default locales by adding the `save_all_locales` property to the top-level or per-collection `i18n` configuration. Then you’ll find “Disable (locale name)” in the three-dot menu in the top right corner of the content editor. This is useful if the translation isn’t ready yet, but you want to publish the default locale content first.

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

### Disabling automatic deployments

You may already have a CI/CD tool set up on your Git repository to automatically deploy changes to production. Occasionally, you make a lot of changes to your content to quickly reach the CI/CD provider’s (free) build limits, or you just don’t want to see builds triggered for every single small change.

With Sveltia CMS, you can disable automatic deployments by default and manually trigger deployments at your convenience. This is done by adding the `[skip ci]` prefix to commit messages, the convention supported by [GitHub](https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs), [GitLab](https://docs.gitlab.com/ee/ci/pipelines/#skip-a-pipeline), [CircleCI](https://circleci.com/docs/skip-build/#skip-jobs), [Travis CI](https://docs.travis-ci.com/user/customizing-the-build/#skipping-a-build), [Netlify](https://docs.netlify.com/site-deploys/manage-deploys/#skip-a-deploy), [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/branch-build-controls/#skip-builds) and others. Here are the steps to use it:

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
1. If you want to deploy a new or updated entry, as well as any other unpublished entries and assets, click an arrow next to the Save button in the content editor, then select **Save and Publish**. This will trigger CI/CD by omitting `[skip ci]`.

If you set `automatic_deployments` to `true`, the behaviour is reversed. CI/CD will be triggered by default, while you have an option to **Save without Publishing** that adds `[skip ci]` only to the associated commit.

_Gotcha:_ Unpublished entries and assets are not drafts. Once committed to your repository, those changes can be deployed any time another commit is pushed without `[skip ci]`, or when a manual deployment is triggered.

If the `automatic_deployments` property is defined, you can manually trigger a deployment by selecting **Publish Changes** under the Account button in the top right corner of the CMS. To use this feature:

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

While we don’t have dedicated developer/user support resources, quick questions and feedback are welcome on the [Discussions](https://github.com/sveltia/sveltia-cms/discussions) page of this GitHub repository. We also have a [Discord channel](https://discord.gg/5hwCGqup5b) for casual chat and instant help.

Looking to build a website with Sveltia CMS? Maintainer [@kyoshino](https://github.com/kyoshino) is available for hire depending on your requirements. Feel free to reach out!

## Contributions

See [Contributing to Sveltia CMS](https://github.com/sveltia/sveltia-cms/blob/main/CONTRIBUTING.md).

## Related links

- Introducing Sveltia CMS: a short technical presentation by [@kyoshino](https://github.com/kyoshino) during the _This Week in Svelte_ online meetup on March 31, 2023 — [recording](https://youtu.be/-YjLubiieYs?t=1660) & [slides](https://docs.google.com/presentation/d/1Wi4ty-1AwOp2-zy7LctmzCV4rrdYPfke9NGhO0DdRdM)

### As seen on

- [Made with Svelte](https://madewithsvelte.com/sveltia-cms)
- [LogRocket Blog](https://blog.logrocket.com/9-best-git-based-cms-platforms/)

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

[^11]: Netlify/Decap CMS [#1382](https://github.com/decaporg/decap-cms/issues/1382)

[^12]: Netlify/Decap CMS [#1975](https://github.com/decaporg/decap-cms/issues/1975), [#3712](https://github.com/decaporg/decap-cms/issues/3712)

[^13]: Netlify/Decap CMS [#5112](https://github.com/decaporg/decap-cms/issues/5112), [#5653](https://github.com/decaporg/decap-cms/issues/5653)

[^14]: Netlify/Decap CMS [#4635](https://github.com/decaporg/decap-cms/issues/4635), [#5920](https://github.com/decaporg/decap-cms/issues/5920), [#6410](https://github.com/decaporg/decap-cms/issues/6410), [#6924](https://github.com/decaporg/decap-cms/issues/6924)

[^15]: Netlify/Decap CMS [#6932](https://github.com/decaporg/decap-cms/issues/6932)

[^16]: Netlify/Decap CMS [#2103](https://github.com/decaporg/decap-cms/issues/2103)

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

[^27]: Netlify/Decap CMS [#3285](https://github.com/decaporg/decap-cms/issues/5617)

[^28]: Netlify/Decap CMS [#2677](https://github.com/decaporg/decap-cms/pull/2677), [#6836](https://github.com/decaporg/decap-cms/pull/6836)

[^29]: Netlify/Decap CMS [#4783](https://github.com/decaporg/decap-cms/issues/4783)

[^30]: Netlify/Decap CMS [#565](https://github.com/decaporg/decap-cms/issues/565)

[^31]: Netlify/Decap CMS [#1045](https://github.com/decaporg/decap-cms/issues/1045)

[^32]: Netlify/Decap CMS [#302](https://github.com/decaporg/decap-cms/issues/302), [#5549](https://github.com/decaporg/decap-cms/issues/5549)

[^33]: Netlify/Decap CMS [#6513](https://github.com/decaporg/decap-cms/issues/6513), [#7295](https://github.com/decaporg/decap-cms/issues/7295)

[^34]: Netlify/Decap CMS [#2138](https://github.com/decaporg/decap-cms/issues/2138)

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

[^48]: Netlify/Decap CMS [#5569](https://github.com/decaporg/decap-cms/issues/5569)

[^49]: Netlify/Decap CMS [#5752](https://github.com/decaporg/decap-cms/issues/5752)

[^50]: Netlify/Decap CMS [#4646](https://github.com/decaporg/decap-cms/issues/4646), [#7167](https://github.com/decaporg/decap-cms/issues/7167)

[^51]: Netlify/Decap CMS [#6731](https://github.com/decaporg/decap-cms/issues/6731)

[^52]: Netlify/Decap CMS [#7147](https://github.com/decaporg/decap-cms/issues/7147)

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

[^69]: Netlify/Decap CMS [#6994](https://github.com/decaporg/decap-cms/issues/6994)

[^70]: Netlify/Decap CMS [#6482](https://github.com/decaporg/decap-cms/issues/6482)

[^71]: Netlify/Decap CMS [#6999](https://github.com/decaporg/decap-cms/issues/6999), [#7000](https://github.com/decaporg/decap-cms/issues/7000), [#7001](https://github.com/decaporg/decap-cms/issues/7001), [#7152](https://github.com/decaporg/decap-cms/issues/7152), [#7220](https://github.com/decaporg/decap-cms/issues/7220), [#7283](https://github.com/decaporg/decap-cms/issues/7283)

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

[^107]: Netlify/Decap CMS [#332](https://github.com/decaporg/decap-cms/issues/332), [#683](https://github.com/decaporg/decap-cms/issues/683), [#999](https://github.com/decaporg/decap-cms/issues/999), [#1456](https://github.com/decaporg/decap-cms/issues/1456), [#4175](https://github.com/decaporg/decap-cms/issues/4175), [#4818](https://github.com/decaporg/decap-cms/issues/4818), [#5688](https://github.com/decaporg/decap-cms/issues/5688), [#6828](https://github.com/decaporg/decap-cms/issues/6828), [#6862](https://github.com/decaporg/decap-cms/issues/6862), [#7023](https://github.com/decaporg/decap-cms/issues/7023)

[^108]: Netlify/Decap CMS [#6829](https://github.com/decaporg/decap-cms/issues/6829)

[^109]: Netlify/Decap CMS [#7197](https://github.com/decaporg/decap-cms/issues/7197)

[^110]: Netlify/Decap CMS [#4637](https://github.com/decaporg/decap-cms/issues/4637)

[^111]: Netlify/Decap CMS [#7190](https://github.com/decaporg/decap-cms/issues/7190), [#7218](https://github.com/decaporg/decap-cms/issues/7218)

[^112]: Netlify/Decap CMS [#5815](https://github.com/decaporg/decap-cms/issues/5815), [#6522](https://github.com/decaporg/decap-cms/issues/6522), [#6532](https://github.com/decaporg/decap-cms/issues/6532), [#6588](https://github.com/decaporg/decap-cms/issues/6588), [#6617](https://github.com/decaporg/decap-cms/issues/6617), [#6640](https://github.com/decaporg/decap-cms/issues/6640), [#6663](https://github.com/decaporg/decap-cms/issues/6663), [#6695](https://github.com/decaporg/decap-cms/issues/6695), [#6697](https://github.com/decaporg/decap-cms/issues/6697), [#6764](https://github.com/decaporg/decap-cms/issues/6764), [#6765](https://github.com/decaporg/decap-cms/issues/6765), [#6835](https://github.com/decaporg/decap-cms/issues/6835), [#6983](https://github.com/decaporg/decap-cms/issues/6983), [#7205](https://github.com/decaporg/decap-cms/issues/7205)

[^113]: Netlify/Decap CMS [#5656](https://github.com/decaporg/decap-cms/issues/5656), [#5837](https://github.com/decaporg/decap-cms/issues/5837), [#5972](https://github.com/decaporg/decap-cms/issues/5972), [#6476](https://github.com/decaporg/decap-cms/issues/6476), [#6516](https://github.com/decaporg/decap-cms/issues/6516), [#6930](https://github.com/decaporg/decap-cms/issues/6930), [#6965](https://github.com/decaporg/decap-cms/issues/6965), [#7080](https://github.com/decaporg/decap-cms/issues/7080), [#7105](https://github.com/decaporg/decap-cms/issues/7105), [#7106](https://github.com/decaporg/decap-cms/issues/7106), [#7119](https://github.com/decaporg/decap-cms/issues/7119), [#7176](https://github.com/decaporg/decap-cms/issues/7176), [#7194](https://github.com/decaporg/decap-cms/issues/7194), [#7244](https://github.com/decaporg/decap-cms/issues/7244), [#7301](https://github.com/decaporg/decap-cms/issues/7301) — These `removeChild` crashes are common in React apps and seem to be caused by a [browser extension](https://github.com/facebook/react/issues/17256) or [Google Translate](https://github.com/facebook/react/issues/11538).

[^114]: Netlify/Decap CMS [#5029](https://github.com/decaporg/decap-cms/issues/5029), [#5048](https://github.com/decaporg/decap-cms/issues/5048)

[^115]: Netlify/Decap CMS [#7172](https://github.com/decaporg/decap-cms/issues/7172)

[^116]: Netlify/Decap CMS [#3431](https://github.com/decaporg/decap-cms/issues/3431)

[^117]: Netlify/Decap CMS [#3562](https://github.com/decaporg/decap-cms/issues/3562)

[^118]: Netlify/Decap CMS [#7267](https://github.com/decaporg/decap-cms/issues/7267)

[^119]: Netlify/Decap CMS [#5640](https://github.com/decaporg/decap-cms/issues/5640), [#6444](https://github.com/decaporg/decap-cms/issues/6444)

[^120]: Netlify/Decap CMS [#2727](https://github.com/decaporg/decap-cms/issues/2727), [#4884](https://github.com/decaporg/decap-cms/issues/4884)

[^121]: Netlify/Decap CMS [#7262](https://github.com/decaporg/decap-cms/issues/7262)

[^122]: Netlify/Decap CMS [#1776](https://github.com/decaporg/decap-cms/issues/1776), [#2064](https://github.com/decaporg/decap-cms/issues/2064), [#7158](https://github.com/decaporg/decap-cms/issues/7158), [#7259](https://github.com/decaporg/decap-cms/issues/7259)

[^123]: Netlify/Decap CMS [#5489](https://github.com/decaporg/decap-cms/issues/5489)

[^124]: Netlify/Decap CMS [#991](https://github.com/decaporg/decap-cms/issues/991), [#4488](https://github.com/decaporg/decap-cms/issues/4488), [#7233](https://github.com/decaporg/decap-cms/issues/7233)

[^125]: Netlify/Decap CMS [#475](https://github.com/decaporg/decap-cms/issues/475)

[^126]: Netlify/Decap CMS [#7279](https://github.com/decaporg/decap-cms/issues/7279)

[^127]: Netlify/Decap CMS [#4518](https://github.com/decaporg/decap-cms/issues/4518)

[^128]: Netlify/Decap CMS [#7092](https://github.com/decaporg/decap-cms/issues/7092)

[^129]: Netlify/Decap CMS [#4961](https://github.com/decaporg/decap-cms/issues/4961), [#4979](https://github.com/decaporg/decap-cms/issues/4979), [#5545](https://github.com/decaporg/decap-cms/issues/5545), [#5778](https://github.com/decaporg/decap-cms/issues/5778), [#6279](https://github.com/decaporg/decap-cms/issues/6279), [#6464](https://github.com/decaporg/decap-cms/issues/6464), [#6810](https://github.com/decaporg/decap-cms/issues/6810), [#6922](https://github.com/decaporg/decap-cms/issues/6922), [#7118](https://github.com/decaporg/decap-cms/issues/7118), [#7293](https://github.com/decaporg/decap-cms/issues/7293) — A comment on one of the issues says the crash was due to Google Translate. Sveltia CMS has turned off Google Translate on the admin page.

[^130]: Netlify/Decap CMS [#6571](https://github.com/decaporg/decap-cms/issues/6571)
