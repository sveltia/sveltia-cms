# Sveltia CMS

Sveltia CMS is a Git-based lightweight headless CMS under active development as a modern, powerful, quick replacement for Netlify CMS and Decap CMS. In some simple cases, migration is as easy as a single line of code change, although we are still working on improving compatibility.

The free, open source alternative/successor to Netlify/Decap CMS is now in public beta, turbocharged with great UX, performance, i18n support and so many more enhancements.

![Git-based headless CMS made right](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-1.webp?20250405)<br>

![Fast and lightweight; modern UX/UI with dark mode](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-2.webp?20250405)<br>

![Stock photo integration: Pexels, Pixabay, Unsplash](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-3.webp?20250405)<br>

![Full-fledged Asset Library; first-class internationalization support; DeepL integration](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-4.webp?20250405)<br>

![Built-in image optimizer for WebP and SVG; mobile & tablet support](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-5.webp?20250409)<br>

![Streamlined local and remote workflow; GitHub, GitLab & Gitea support; single-line migration from Netlify/Decap CMS (depending on your current setup); Sveltia CMS](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-6.webp?20250526)<br>

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
  - [Better installation](#better-installation)
  - [Better configuration](#better-configuration)
  - [Better backend support](#better-backend-support)
  - [Better i18n support](#better-i18n-support)
  - [Better collections](#better-collections)
  - [Better content editing](#better-content-editing)
  - [Better content preview](#better-content-preview)
  - [Better data output](#better-data-output)
  - [Better widgets](#better-widgets)
    - [New widgets](#new-widgets)
  - [Better asset management](#better-asset-management)
  - [Better customization](#better-customization)
  - [Better localization](#better-localization)
- [Compatibility](#compatibility)
  - [Features not to be implemented](#features-not-to-be-implemented)
  - [Current limitations](#current-limitations)
  - [Compatibility with Static CMS](#compatibility-with-static-cms)
  - [Framework support](#framework-support)
  - [Backend support](#backend-support)
  - [Browser support](#browser-support)
  - [Other notes](#other-notes)
- [Getting started](#getting-started)
  - [Installation \& setup](#installation--setup)
  - [Migration](#migration)
    - [Migrating from Git Gateway backend](#migrating-from-git-gateway-backend)
  - [Installing with npm](#installing-with-npm)
  - [Updates](#updates)
- [Tips \& tricks](#tips--tricks)
  - [Moving your site from Netlify to another hosting service](#moving-your-site-from-netlify-to-another-hosting-service)
  - [Providing a JSON configuration file](#providing-a-json-configuration-file)
  - [Providing multiple configuration files](#providing-multiple-configuration-files)
  - [Working around an authentication error](#working-around-an-authentication-error)
  - [Working with a local Git repository](#working-with-a-local-git-repository)
  - [Enabling local development in Brave](#enabling-local-development-in-brave)
  - [Using a custom icon for a collection](#using-a-custom-icon-for-a-collection)
  - [Adding dividers to the collection list](#adding-dividers-to-the-collection-list)
  - [Using a custom media folder for a collection](#using-a-custom-media-folder-for-a-collection)
  - [Specifying default sort field and direction](#specifying-default-sort-field-and-direction)
  - [Including Hugo’s special index file in a folder collection](#including-hugos-special-index-file-in-a-folder-collection)
  - [Using keyboard shortcuts](#using-keyboard-shortcuts)
  - [Using DeepL to translate entry fields](#using-deepl-to-translate-entry-fields)
  - [Localizing entry slugs](#localizing-entry-slugs)
  - [Disabling non-default locale content](#disabling-non-default-locale-content)
  - [Using a random ID for an entry slug](#using-a-random-id-for-an-entry-slug)
  - [Configuring multiple media libraries](#configuring-multiple-media-libraries)
  - [Optimizing images for upload](#optimizing-images-for-upload)
  - [Disabling stock assets](#disabling-stock-assets)
  - [Editing data files with a top-level list](#editing-data-files-with-a-top-level-list)
  - [Changing the input type of a DateTime field](#changing-the-input-type-of-a-datetime-field)
  - [Rendering soft line breaks as hard line breaks in Markdown](#rendering-soft-line-breaks-as-hard-line-breaks-in-markdown)
  - [Controlling data output](#controlling-data-output)
  - [Disabling automatic deployments](#disabling-automatic-deployments)
  - [Setting up Content Security Policy](#setting-up-content-security-policy)
  - [Showing the CMS version](#showing-the-cms-version)
- [Support \& feedback](#support--feedback)
- [Contributions](#contributions)
- [Roadmap](#roadmap)
  - [v1.0](#v10)
  - [v2.0](#v20)
  - [Future](#future)
- [Trivia](#trivia)
- [Related links](#related-links)
  - [As seen on](#as-seen-on)
- [Disclaimer](#disclaimer)

## Motivation

Sveltia CMS was born in November 2022, when the progress of Netlify CMS was stalled for more than six months. [@kyoshino](https://github.com/kyoshino)’s clients wanted to replace their Netlify CMS instances without much effort, mainly to get better internationalization (i18n) support.

To achieve radical improvements in UX, performance, i18n and other areas, it was ultimately decided to build an alternative from the ground up, while ensuring an easy migration path from the other. After proving the idea with a rapid [Svelte](https://svelte.dev/) prototype, development was accelerated to address their primary use cases. The new product has since been named Sveltia CMS and released as open source software to encourage wider adoption.

We loved the simple architecture of Netlify CMS that turned a Git repository into a database with a single page app served from a CDN plus a plain YAML config file. In support of the [Jamstack](https://jamstack.org/) concept, we wanted to revive it, modernize it, and take it to the next level.

### Our advantage

Due to its unfortunate abandonment in early 2022, Netlify CMS spawned 3 successors:

- [Static CMS](https://github.com/StaticJsCMS/static-cms): a community fork, initial commit made in September 2022 — discontinued in September 2024 after making meaningful improvements
- **Sveltia CMS**: not a fork but a **complete rewrite** or “total reboot”, started in November 2022, first appeared on GitHub in March 2023
- [Decap CMS](https://github.com/decaporg/decap-cms): a rebranded version, [announced in February 2023](https://www.netlify.com/blog/netlify-cms-to-become-decap-cms/) as the official successor with a Netlify agency partner taking ownership — mostly stagnant, with only occasional releases

Sveltia CMS is the only project that doesn’t inherit the complexity, technical debt, and numerous bugs of Netlify CMS, which was launched in 2015. Our product is better by design: We rebuilt the app from the ground up using a [modern framework](https://svelte.dev/) without looking at the predecessor’s code, while closely monitoring and analyzing their issue tracker. This lets us make [hundreds of improvements](#differentiators) without getting stuck in the old system.

While Sveltia CMS was created to replace legacy Netlify CMS instances, it can also be used as an alternative to other Netlify CMS successors. With its [solid i18n support](#better-i18n-support), we’re hoping our product will eventually be an appearing option for anyone looking for a free headless CMS.

### Our goals

- Making Sveltia CMS a viable, definitive successor to Netlify CMS
- Empowering SMBs and individuals who need a free, yet powerful, high-quality CMS solution
- Emerging as the leading open source offering in the Git-based CMS market
- Extending its capabilities as digital asset management (DAM) software
- Showcasing the power of Svelte and UX engineering

## Development status

Sveltia CMS is currently in **beta** and version 1.0 (GA) is expected to ship in Q4 2025. Check our [release notes](https://github.com/sveltia/sveltia-cms/releases) and follow us on [Bluesky](https://bsky.app/profile/sveltiacms.app) for updates. See also our [roadmap](#roadmap).

While we fix reported bugs as quickly as possible, usually within 24 hours, our overall progress may be slower than you think. The thing is, it’s not just a personal project of [@kyoshino](https://github.com/kyoshino), but also a complicated system involving various kinds of activities that require considerable effort:

- Ensuring substantial [compatibility with Netlify/Decap CMS](#compatibility)
- Providing partial [compatibility with Static CMS](#compatibility-with-static-cms)
- Tackling as many [Netlify/Decap CMS issues](https://github.com/decaporg/decap-cms/issues) as possible
  - So far, 215+ issues, or 430+ if including duplicates, have been effectively solved in Sveltia CMS
  - Target:
    - 200 issues, or 400 if including duplicates, by GA — We did it! 🎉
    - 350 issues, or 700 if including duplicates, in the future 💪
    - or every single issue that’s relevant, fixable, and worth dealing with 🔥
  - Issues include everything from feature requests to bug reports and [issues closed as stale](https://github.com/decaporg/decap-cms/issues?q=is%3Aissue+%22Closing+as+stale%22) or without an effective solution, as well as [discussions](https://github.com/decaporg/decap-cms/discussions) and stalled [pull requests](https://github.com/decaporg/decap-cms/pulls)
  - Many of the bugs, including the annoying crashes, have already been solved
    - The remaining bugs are mostly related to [unimplemented features](#current-limitations)
  - Many of their [top-voted features](https://github.com/decaporg/decap-cms/issues?q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc) are on our table or already implemented in Sveltia CMS
- Solving [our own issues](https://github.com/sveltia/sveltia-cms/issues)
- Implementing our own enhancement ideas for every part of the product
- Responding to requests from the maintainer’s clients
- Making the code clean and maintainable

![215 Netlify/Decap CMS issues solved in Sveltia CMS](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/headline-1.webp?20250530)<br>

## Differentiators

Netlify/Decap CMS users will definitely be pleased and surprised by the numerous improvements we have made, from the small to the large. Here’s what makes Sveltia CMS different. Look how serious we are!

### Better UX

- Created and actively maintained by an [experienced UX engineer](https://github.com/kyoshino) who loves code, design, marketing and problem solving. You can expect constant improvements to the user experience (UX) and developer experience (DX) across the platform.
- The maintainer tries to respond to bug reports as quickly as possible. While there are no guarantees, the typical turnaround time for a bug fix is less than 24 hours.
- Frequent releases deliver new features and enhancements to users faster. Most of our minor [releases](https://github.com/sveltia/sveltia-cms/releases) address one or more Netlify/Decap CMS issues, giving you even more reasons to switch from the legacy predecessor.
- Offers a modern, intuitive user interface that utilizes the full viewport,[^178] inspired in part by the Netlify CMS v3 prototype.[^1][^211][^212][^213][^214]
- Provides immersive dark mode.[^2] The UI theme follows the user’s system preference by default and can be changed in the application settings.
- Users can easily manage content on-the-go with mobile and tablet support.[^18][^215]
  - For a smoother experience, we even go beyond responsive design with optimized navigation, [view transitions](https://developer.chrome.com/docs/web-platform/view-transitions), larger buttons, and other tweaks. However, there are still rough edges, and we are working to fully optimize the app for small screens and touch devices.
  - If you’re already signed in on your desktop, open the Account menu in the top right corner of the CMS, click Sign In with Mobile, and scan the QR code for passwordless sign-in. Your settings will be automatically copied.
- Made with [Svelte](https://svelte.dev/), not React, means we can spend more time on UX rather than tedious state management. It also allows us to avoid common fatal React application crashes.[^113][^129] Best of all, Svelte offers great performance.
- Other crashes in Netlify/Decap CMS are also irrelevant to us, making Sveltia CMS much more stable.[^112][^203][^204]
- We build [our own UI component library](https://github.com/sveltia/sveltia-ui), including custom dialogs, to ensure optimal usability without compromising accessibility.[^196][^205][^206][^207][^208][^209][^210]
- Users can personalize the application with various settings, including appearance and language. Developer Mode can also be enabled.
- Never miss out on the latest features and bug fixes by being notified when an update to the CMS is available.[^31] Then update to the latest version with a single click.[^66]
<!-- - The in-app Help menu provides all links to useful resources, including release notes, feedback and support. -->

### Better performance

- Built completely from scratch with [Svelte](https://svelte.dev/) instead of forking React-based Netlify/Decap CMS. The app starts fast and stays fast with [no virtual DOM overhead](https://svelte.dev/blog/virtual-dom-is-pure-overhead). Note that Svelte is a compiler and Sveltia CMS is framework-agnostic; it’s served as a vanilla JavaScript bundle.
- Small footprint: The bundle size is less than 500 KB when minified and [brotlied](https://en.wikipedia.org/wiki/Brotli), which is much lighter than Netlify CMS (1.5 MB), Decap CMS (1.5 MB) and Static CMS (2.6 MB).[^57][^64] This number is remarkable because even though some Netlify/Decap CMS features are [omitted](#features-not-to-be-implemented) or [unimplemented](#current-limitations) in Sveltia CMS, we have added a lot of new features. That’s the power of [Svelte 5](https://svelte.dev/blog/svelte-5-is-alive) + [Vite](https://vite.dev/).
- Uses the GraphQL API for GitHub and GitLab to quickly fetch content at once, so that entries and assets can be listed and searched instantly[^32][^65] (the useless `search` configuration option is therefore ignored). It also avoids the slowness and potential API rate limit violations caused by hundreds of requests with Relation widgets.[^14]
- Saving entries and assets to GitHub is also much faster thanks to the [GraphQL mutation](https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/).
- The Gitea backend is also faster because it utilizes an efficient API method introduced in Gitea 1.24.
- Our [local repository workflow](#working-with-a-local-git-repository) utilizes the modern [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) to read and write files natively through the web browser, rather than using a slow, ad hoc REST API through a proxy server.
- Sorting, filtering and grouping of entries is done instantly without reloading the entire content.
- Uses caching, lazy loading and infinite scrolling techniques. A list of repository files is stored locally for faster startup and bandwidth savings.
- Thumbnails of assets, including videos and PDF files, are generated and cached for faster rendering of the Asset Library and other parts of the CMS.[^39][^38]
- No typing lag on input widgets, especially within nested lists and objects.[^77]
- The entry preview doesn’t use an `<iframe>` because it’s a performance overhead.[^179]

### Better productivity

- Developers can [work with a local Git repository](#working-with-a-local-git-repository) without any additional configuration or proxy server, resulting in a streamlined workflow and improved performance.[^26]
  - It also avoids a number of issues, including potential dependency corruption,[^158] a 30 MB file size limit,[^51] an unknown error with `publish_mode`,[^75] and an unused `logo_url`.[^49]
  - When you delete an entry or an asset file, the empty folder that contains it is also deleted, so you don’t have to delete it manually.
- Provides a smoother user experience in the Content Editor:
  - A local backup of an entry draft is automatically created without interruption by a confirmation dialog, which annoys users and can cause a page navigation problem if dismissed.[^106] The backup can then be reliably restored without unexpected overwriting.[^85]
  - Click once (the Save button) instead of twice (Publish > Publish now) to save an entry. Or just hit the `Ctrl+S` (Windows/Linux) or `Command+S` (macOS) key to save your time.
  - The editor closes automatically when an entry is saved. This behaviour can be changed in the application settings.
- Uploading files can be done with drag and drop.[^20]
- Users can upload multiple files at once to the Asset Library.[^5]
- Users can delete multiple entries and assets at once.
- Instant full-text search with results sorted by relevance helps you find entries faster.
- Some [keyboard shortcuts](#using-keyboard-shortcuts) are available for faster editing.

### Better accessibility

- Improved keyboard handling lets you efficiently navigate through UI elements using the Tab, Space, Enter and arrow keys.[^17][^67]
- Comprehensive [WAI-ARIA](https://w3c.github.io/aria/) support enables users who rely on screen readers such as NVDA and VoiceOver. An announcement is read out when you navigate to another page.
- The rich text editor is built with [Lexical](https://lexical.dev/), which is said to follow accessibility best practices. The [Dragon NaturallySpeaking support](https://lexical.dev/docs/packages/lexical-dragon) is enabled.
- Ensures sufficient contrast between the foreground text and background colours.
- Enabled and disabled buttons can be clearly distinguished.[^105]
- Links are underlined by default to make them easier to recognize. This behaviour can be changed in the Accessibility Settings if you prefer.
- Honours your operating system’s [reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) and [reduced transparency](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency) settings. Support for [high contrast mode](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast) will be added later.
- Browser console logs for developers are readable in either light or dark mode.[^116]
- We’ll continue to test and improve the application to meet [WCAG 2.2](https://w3c.github.io/wcag/guidelines/22/).

### Better security

- Avoids vulnerabilities in dependencies through constant updates, [`pnpm audit`](https://pnpm.io/cli/audit), and frequent releases, unlike Netlify/Decap CMS where a number of high severity vulnerabilities remain unpatched for a long time.[^33]
- Our [local repository workflow](#working-with-a-local-git-repository) doesn’t require a proxy server, reducing an attack surface.[^158]
- We have enabled [npm package provenance](https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/).
- We have documented how to [set up a Content Security Policy](#setting-up-content-security-policy) for the CMS to prevent any unexpected errors or otherwise insecure configuration.[^108]
- The `unsafe-eval` and `unsafe-inline` keywords are not needed in the `script-src` CSP directive.[^34]
- The `same-origin` referrer policy is automatically set with a `<meta>` tag.
- Sveltia CMS has a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) requirement that forces the site content, including the CMS configuration file, to be served over HTTPS.
- GitHub commits are automatically GPG-signed and [marked as verified](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification).[^144]

### Better installation

- Sveltia CMS is built with [Svelte](https://svelte.dev/), and we only publish compiled vanilla JavaScript bundles, so there are no React compatibility issues that might prevent developers from upgrading a project for many months.[^177] We haven’t actually integrated React for custom widgets and other features yet, but anyway, no dependencies will be installed when you [install the app with npm](#installing-with-npm).
- Sveltia CMS also won’t cause peer dependency conflicts due to legacy third-party React UI libraries.[^175] We build the app using [our own Svelte UI component library](https://github.com/sveltia/sveltia-ui) to reduce reliance on third parties.
- Some servers and frameworks are known to remove the trailing slash from the CMS URL (`/admin`) depending on the configuration. In such cases, the config file is loaded from a root-relative URL (`/admin/config.yml`) instead of a regular relative URL (`./config.yml` = `/config.yml`) that results in a 404 Not Found error.[^107]
- The [robots `meta` tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) is automatically added to HTML to prevent the admin page from being indexed by search engines.[^174] Developers are still encouraged to manually add `<meta name="robots" content="noindex">` to `index.html`, as not all crawlers support dynamically added tags. However, our solution should at least work with Google in case you forget to do so.

### Better configuration

- Sveltia CMS supports a [JSON configuration file](#providing-a-json-configuration-file) that can be generated for bulk or complex collections.[^60]
- Also supports [multiple configuration files](#providing-multiple-configuration-files) to allow developers to modularize the configuration.[^197]
- Improved TypeScript support: We try to keep our type definitions for `CMS.init()` and other methods complete, accurate, up-to-date and annotated.[^190][^191][^192][^193] This makes it easier to provide a site config object when [manually initializing](https://decapcms.org/docs/manual-initialization/) the CMS.

### Better backend support

- Uses the GraphQL API where possible for better performance, as mentioned above. You don’t need to set the `use_graphql` option to enable it for GitHub and GitLab.
- The Git branch name is automatically set to the repository’s default branch (`main`, `master` or whatever) if not specified in the configuration file, preventing data loading errors due to a hardcoded fallback to `master`.[^95][^27]
- It’s possible to [disable automatic deployments](#disabling-automatic-deployments) by default or on demand to save costs and resources associated with CI/CD and to publish multiple changes at once.[^24]
- The GitLab backend support comes with background [service status](https://status.gitlab.com/) checking, just like GitHub.
- Service status checks are performed frequently and an incident notification is displayed prominently.
- Users can quickly open the source file of an entry or asset in your repository using View on GitHub (or GitLab or Gitea) under the 3-dot menu when Developer Mode is enabled.
- We provide [our own OAuth client](https://github.com/sveltia/sveltia-cms-auth) for GitHub and GitLab.
- Users won’t get a 404 Not Found error when you sign in to the GitLab backend.[^115]
- Our Gitea backend is high-performing because it retrieves multiple entries at once. [Git LFS](https://git-lfs.com/) is supported out of the box if your Gitea instance has enabled [built-in LFS support](https://docs.gitea.com/administration/git-lfs-setup). Additionally, the backend won’t cause 400 Bad Request errors due to the presence of `DRAFT_MEDIA_FILES` in file paths.[^222]
- The OAuth access token is automatically renewed when using the GitLab or Gitea backend with PKCE authorization.[^224] Token renewal for other backend configurations will be implemented later.
- Features the all-new [local repository workflow](#working-with-a-local-git-repository) that boosts DX. See the [productivity section](#better-productivity) above.
- Developers can select the local and remote backends while working on a local server.
- The Test backend saves entries and assets in the browser’s [origin private file system](https://web.dev/articles/origin-private-file-system) (OPFS) so that changes are not discarded when the browser tab is closed or reloaded.[^194] The persistent storage support works with all modern browsers [except Safari](https://bugs.webkit.org/show_bug.cgi?id=254726).

### Better i18n support

Sveltia CMS has been built with a multilingual architecture from the very beginning. You can expect unparalleled internationalization (i18n) support, as it’s required by clients of maintainer [@kyoshino](https://github.com/kyoshino), who himself was a long-time Japanese localizer for [Mozilla](https://www.mozilla.org/) and currently lives in the [most diverse city in the world](https://en.wikipedia.org/wiki/Toronto) where 150+ languages are spoken.

- Configuration
  - The [i18n limitations](https://decapcms.org/docs/i18n/#limitations) in Netlify/Decap CMS do not apply to Sveltia CMS:
    - File collections support multiple files/folders i18n structures.[^87] To enable it, simply use the `{{locale}}` template tag in the `file` path option, e.g. `content/pages/about.{{locale}}.json` or `content/pages/{{locale}}/about.json`. For backward compatibility, the global `structure` option only applies to folder collections, and the default i18n structure for file collections remains single file.
    - The List and Object widgets support the `i18n: duplicate` field configuration so that changes made with these widgets are duplicated between locales.[^7][^68] The `i18n` configuration can normally be used for the subfields.
  - The new `multiple_folders_i18n_root` i18n structure allows to have locale folders below the project root: `<locale>/<folder>/<slug>.<extension>`. [^182]
  - The new `omit_default_locale_from_filename` i18n option allows to exclude the default locale from filenames. This option applies to entry collections with the `multiple_files` i18n structure enabled, as well as to file collection items with the `file` path ending with `.{{locale}}.<extension>`, aiming to support [Zola’s multilingual sites](https://www.getzola.org/documentation/content/multilingual/). ([Discussion](https://github.com/sveltia/sveltia-cms/discussions/394))
  - The `required` field option accepts an array of locale codes in addition to a boolean, making the field required for a subset of locales when i18n support is enabled. For example, if only English is required, you could write `required: [en]`. An empty array is equivalent to `required: false`.
  - [Entry-relative media folders](https://decapcms.org/docs/collection-folder/#media-and-public-folder) can be used in conjunction with the `multiple_folders` i18n structure.[^21]
  - The `{{locale}}` template tag can be used in the [`preview_path`](https://decapcms.org/docs/configuration-options/#preview_path) collection option to provide site preview links for each language.[^63]
  - It’s possible to [use a random UUID for an entry slug](#using-a-random-id-for-an-entry-slug), which is a good option for locales that write in non-Latin characters.
  - It’s possible to [localize entry slugs](#localizing-entry-slugs) while linking the localized files,[^80] thanks to the support for Hugo’s `translationKey`.[^81]
  - When the `clean_accents` option is enabled for [entry slugs](https://decapcms.org/docs/configuration-options/#slug-type), certain characters, such as German umlauts, will be [transliterated](https://en.wikipedia.org/wiki/Transliteration).[^99]
  - It’s possible to embed the locale code in an entry by using `widget: hidden` along with `default: '{{locale}}'`.[^101]
  - The `value_field` Relation field option can contain a locale prefix like `{{locale}}/{{slug}}`, which will be replaced with the current locale. It’s intended to support i18n in Astro. ([Discussion](https://github.com/sveltia/sveltia-cms/discussions/302))
- User interface
  - Eliminates UI confusion: The Preview Pane can be displayed without toggling i18n in the Content Editor. Both panes are scrollable. There is no condition where both panes are edited in the same language at the same time.
  - Users can easily switch between locales while editing by clicking a button instead of a dropdown list when there are less than 5 locales.
  - Language labels appear in human-readable display names instead of ISO 639 language codes because it’s not easy for everyone to recognize `DE` as German, `NL` as Dutch, `ZH` as Chinese, and so on.
- Content editing
  - [Integrates DeepL](#using-deepl-to-translate-entry-fields) to allow translation of text fields from another locale with one click. More translation services will be added in the future.
  - The Content Editor supports [RTL scripts](https://en.wikipedia.org/wiki/Right-to-left_script) such as Arabic, Hebrew and Persian.[^146]
  - It’s possible to [disable non-default locale content](#disabling-non-default-locale-content).[^15]
  - Boolean, DateTime, List and Number fields in the entry preview are displayed in a localized format.
  - Boolean fields are updated in real time between locales like other widgets to avoid confusion.[^35]
  - Relation fields with i18n enabled won’t trigger a change in the content draft status when you start editing an existing entry.[^84]
  - Solves problems with Chinese, Japanese and Korean (CJK) [IME](https://en.wikipedia.org/wiki/Input_method) text input in the rich text editor for the Markdown widget.[^54]
  - Raises a validation error instead of failing silently if the `single_file` structure is used and a required field is not filled in any of the locales.[^55]
  - Fields in non-default locales are validated as expected.[^13]
  - No internal error is thrown when changing the locale.[^103]
  - Duplicating an entry duplicates all locale content, not just the default locale.[^170]

### Better collections

- Configuration
  - Provides some new options, including:
    - `icon`: [Choose a custom icon for each collection](#using-a-custom-icon-for-a-collection).[^3]
    - `thumbnail`: Specify the field name for a thumbnail displayed on the entry list, like `thumbnail: featuredImage`.[^130]
      - A nested field can be specified using dot notation, e.g. `heroImage.src`.
      - A wildcard in the field name is also supported, e.g. `images.*.src`.
      - Multiple field names can be specified as an array for fallback purpose, e.g. `[thumbnail, cover]`.
      - Occasionally, you may not have suitable images for thumbnails. For example, your images may have subtle differences or varied aspect ratios. In that case, you can disable the thumbnail with `thumbnail: []`.
      - If this option is omitted, any non-nested, non-empty Image or File field will be used.[^173]
    - `limit`: Specify the maximum number of entries that can be created in a folder collection.[^185]
    - `divider`: [Add dividers to the collection list](#adding-dividers-to-the-collection-list).
  - Enhancements to the entry `filter` option for folder collections:
    - Boolean `value` works as expected.[^93]
    - `value` accepts `null` to match an undefined field value.
    - `value` accepts an array to provide multiple possible values.[^151]
    - `pattern` can be used instead of `value` to provide a regular expression, just like the `view_filters` collection option.[^153]
  - Enhancements to [summary string transformations](https://decapcms.org/docs/summary-strings/):
    - Transformations can be used in more places than just the collection `summary`:
      - The `slug` and `preview_path` collection options[^29]
      - The `summary` field option for the List and Object widgets
    - The `default` transformation accepts a template tag like `{{fields.slug | default('{{fields.title}}')}}`, making it possible to fall back to a different field value. ([Discussion](https://github.com/sveltia/sveltia-cms/issues/345))
    - The `date` transformation supports the time zone argument. The only available value is `utc`, which converts a date to UTC. This is useful if the specified DateTime field is local, but you want to force UTC in the entry slug, e.g. `{{date | date('YYYYMMDD-HHmm', 'utc')}}`. ([Discussion](https://github.com/sveltia/sveltia-cms/issues/278#issuecomment-2565313420))
    - The `date` transformation returns an empty string if an invalid date is given.[^176]
    - Multiple transformations can be chained like `{{title | upper | truncate(20)}}`.
  - The collection `label` defaults to the `name` value according to the [Decap CMS document](https://decapcms.org/docs/configuration-options/#collections), while Netlify/Decap CMS actually throws a configuration error if the `label` option is omitted.
  - Nested fields (dot notation) can be used in the `path` option for a folder collection, e.g. `{{fields.state.name}}/{{slug}}`.[^62]
  - Markdown is supported in the `description` collection option.[^79] Bold, italic, strikethrough, code and links are allowed.
  - The collection `folder` can be an empty string (or `.` or `/`) if you want to store entries in the root folder. This supports a typical VitePress setup.
  - Each file in a file collection has the `format` and `frontmatter_delimiter` options, which can be used to specify the file format, making it possible to have `yaml-frontmatter`, `toml-frontmatter` and `json-frontmatter` side by side.[^218]
- Entry slugs
  - It’s possible to [use a random UUID for an entry slug](#using-a-random-id-for-an-entry-slug).
  - Slug generation is fail-safe: If a slug cannot be determined from entry content, part of a random UUID is used instead of throwing an error or filling in with arbitrary string field values.[^133]
  - Users can edit entry slugs via the 3-dot menu in the Content Editor.[^184]
  - If a collection only has the Markdown `body` field, an entry slug will be generated from a header in the `body`, if exists. This supports a typical VitePress setup.
  - Entry slug template tags support [transformations](https://decapcms.org/docs/summary-strings/) just like summary string template tags.[^29]
  - Single quotes (apostrophes) in a slug will be replaced with `sanitize_replacement` (default: hyphen) rather than being removed.[^52]
  - The maximum number of characters for an entry slug can be set with the new `slug_length` collection option to avoid deployment errors with Netlify or other platforms.[^25]
  - Setting the collection `path` doesn’t affect the entry slugs stored with the Relation widget.[^137]
  - Entry slugs are [localizable](#localizing-entry-slugs).[^80]
- Entry listing
  - [Default sort field and direction](#specifying-default-entry-sort-field-and-direction) can be specified.[^172]
  - Sorting entries by a DateTime field works as expected.[^110]
  - Entry grouping and sorting can work together. For example, it’s possible to group by year and then sort by year if configured properly.
  - [Index file inclusion](#including-hugos-special-index-file-in-a-folder-collection) allows users to edit Hugo’s special `_index.md` file, including localized ones like `_index.en.md`, within a folder collection.[^201] If the `index_file` option is not defined, these files will be hidden in a folder collection unless the `path` option is configured to end with `_index` and the `extension` is `md`.[^120]
  - A console error won’t be thrown when a collection doesn’t have the `title` field.[^152] In that case, an entry summary will be generated from a header in the Markdown `body` field, if exists, or from the entry slug, so the summary will never be an empty.[^161] This supports a typical VitePress setup.
  - If there was an error while parsing an entry file, such as duplicate front matter keys, it won’t show up as a blank entry, and a clear error message will be displayed in the browser console.[^121]
  - A single file can be used for more than one item in a file collection.[^127]
- User interface
  - The collection list displays the number of items in each collection.
  - Users can select multiple entries and delete them at once.
  - In an entry summary, basic Markdown syntax used in the title, including bold, italic and code, are parsed as Markdown. HTML character references (entities) are also parsed properly.[^69]
  - If you update an entry field that appears in the collection’s `summary`, such as `title`, the entry list displays an updated summary after you save the entry.[^159]
  - Thumbnails of entries are displayed not only in the grid view but also in the list view, making it easier to navigate.
  - If entries don’t have an Image field for thumbnails, the entry list will only be displayed in the list view, because it doesn’t make sense to show the grid view.[^143]
  - Assets stored in a [collection media folder](#using-a-custom-media-folder-for-a-collection) can be displayed next to the entries.
  - The New Entry button won’t appear when a developer accidentally sets the `create: true` option on a file collection because it’s useless.[^89]
  - The Delete Entry button won’t appear when a developer accidentally sets the `delete: true` option on a file collection because the preconfigured files should not be deleted.

### Better content editing

- Required fields, not optional fields, are marked for efficient data entry.
- Users can revert changes to all fields or a specific field.
- If you revert changes and there are no unsaved changes, the Save button is disabled as expected.[^118]
- The new `readonly` field option makes the field read-only. This is useful when a `default` value is provided and the field should not be editable by users.[^223]
- Fields with validation errors are automatically expanded if they are part of nested, collapsed objects.[^40]
- A full regular expression, including flags, can be used for the widget `pattern` option.[^82] For example, if you want to allow 280 characters or less in a multiline text field, you could write `/^.{0,280}$/s` (but you can now use the `maxlength` option instead.)
- A long validation error message is displayed in full, without being hidden behind the field label.[^59]
- Any links to other entries will work as expected, with the Content Editor being updated for the other.[^100]
- In the Boolean and Select widgets, you don’t have to update a value twice to re-enable the Save button after saving an entry.[^139]
- `data` can be used as a field name without causing an error when saving the entry.[^180]

### Better content preview

- The Preview Pane comes with a minimal default style.[^168] It looks nice without a custom preview style or template.
- For better performance, the Preview Pane doesn’t use an `<iframe>`.[^179]
- The Preview Pane displays all fields, including each label, making it easier to see which fields are populated.
- Clicking a field in the Preview Pane focuses the corresponding field in the Edit Pane.[^41] It automatically expands when collapsed.
  - This is equivalent to the (misleading) visual editing feature introduced in [Decap CMS 3.6.0](https://github.com/decaporg/decap-cms/releases/tag/decap-cms%403.6.0), but our click-to-highlight feature is enabled by default; you don’t need to opt in with the `editor.visualEditing` collection option.
  - Our implementation doesn’t cause a module import error[^225] or broken image previews.[^188]
- The Preview Pane doesn’t cause a scrolling issue.[^136]
- The Preview Pane doesn’t crash with a Minified React error.[^186]
- Provides better scroll synchronization between the panes when editing or previewing an entry.[^92]
- Developers can hide the preview of a specific field using a new field option: `preview: false`.[^126]
- [See below](#better-widgets) for widget-specific enhancements, including support for variable types[^42] and YouTube videos.

### Better data output

- Keys in generated JSON/TOML/YAML content are always sorted by the order of configured fields, making Git commits clean and consistent.[^86]
- Netlify/Decap CMS often, but not always, omits optional and empty fields from the output.[^154] Sveltia CMS aims at complete and consistent data output — it always saves proper values, such as an empty string, an empty array or `null`, instead of nothing (`undefined`), regardless of the `required` field option.[^45][^46][^44][^157]
  - In other words, in Sveltia CMS, `required: false` makes data input optional, but doesn’t make data output optional.
  - To omit empty optional fields from data output, use `omit_empty_optional_fields: true` in the [data output options](#controlling-data-output). This is useful if you have data type validations that expect `undefined`.[^156]
- JSON/TOML/YAML data is saved with a new line at the end of the file to prevent unnecessary changes being made to the file.[^11]
- Leading/trailing whitespaces in text-type field values are automatically removed when you save an entry.[^37]
- YAML string folding (maximum line width) is disabled, mainly for framework compatibility.[^119]
- A standard time is formatted as `HH:mm:ss` instead of `HH:mm` for framework compatibility.
- DateTime field values in ISO 8601 format are stored in native date/time format instead of quoted strings when the data output is TOML.[^147]
- Provides JSON/YAML format options as part of the [data output options](#controlling-data-output), including indentation and quotes.[^155][^9]
  - The `yaml_quote` collection option added in [v0.5.10](https://github.com/sveltia/sveltia-cms/releases/tag/v0.5.10) is now deprecated and will be removed in v1.0.0. `yaml_quote: true` is equivalent to `quote: double` in the new YAML format options.

### Better widgets

Sveltia CMS supports all [built-in widgets](https://decapcms.org/docs/widgets/) available in Netlify/Decap CMS except Map. We have made significant improvements to these widgets while adding some new ones. The remaining Map widget will be added soon, followed by support for [custom widgets](https://decapcms.org/docs/custom-widgets/).

Note: The Date widget has been deprecated in Netlify CMS and removed from both Decap CMS and Sveltia CMS in favour of the DateTime widget, as noted in the [Compatibility](#compatibility) section.

- Boolean
  - A required Boolean field with no default value is saved as `false` by default, without raising a confusing validation error.[^45]
  - An optional Boolean field with no default value is also saved as `false` by default, rather than nothing.[^46]
- Code
  - More than 300 languages are available, thanks to [Prism](https://prismjs.com/)’s extensive language support.
  - The language switcher always appears in the user interface, so it’s easy to spot and change the selected language.
  - Dynamic loading of language modes work as expected.[^198]
  - A Code field under a List field work as expected, saving both code and language.[^181]
- Color
  - The widget doesn’t cause scrolling issues.[^128]
  - The preview shows both the RGB(A) hex value and the `rgb()` function notation.
- DateTime
  - A DateTime field doesn’t trigger a change in the content draft status when you’ve just started editing a new entry.[^90]
  - User’s local time is not saved in UTC unless the `picker_utc` option is `true`.[^150]
- Hidden
  - The `default` value supports the following template tags:
    - `{{locale}}`: The current locale code.[^101]
    - `{{datetime}}`: The current date/time in [ISO 8601 format](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format).[^102]
    - `{{uuid}}`, `{{uuid_short}}` and `{{uuid_shorter}}`: A random UUID or its shorter version, just like the [slug template tags](#using-a-random-id-for-an-entry-slug).[^12]
  - The `default` value is saved when you create a file collection item, not just a folder collection item.[^78]
- List
  - It’s possible to [edit data files with a top-level list](#editing-data-files-with-a-top-level-list) using the new `root` option.[^148]
  - The `min` and `max` options can be used separately. You don’t need to specify both to use either option.[^145]
  - The Add Item button appears at the bottom of the list when the `add_to_top` option is not `true`, so you don’t have to scroll up each time to add new items.
  - A list item comes with a menu that allows users to duplicate the item, insert a new item above/below it, or remove it.[^187]
  - Users can expand or collapse the entire list, while the Expand All and Collapse All buttons allow you to expand or collapse all items in the list at once.[^164]
  - A required List field with no subfield or value is marked as invalid.[^43] No need to set the `min` and `max` options for the `required` option to work.
  - An optional List field with no subfield or value is saved as an empty array, rather than nothing.[^44]
  - An optional List field won’t populate an item by default when the subfield has the `default` value.[^162]
  - A simple List field with no subfields is displayed as a multiline text field,[^219] where users can use spaces[^50] and commas[^220] for list items. A comma is no longer treated as a list delimiter.
  - Users can preview variable types without having to register a preview template.[^42]
  - It’s possible to omit `fields` in a variable type object.[^163] In that case, only the `typeKey` (default: `type`) is saved in the output.
  - A collapsed List field will not display a programmatic summary like `List [ Map { "key": "value" } ]` if the `summary` option is not set.[^183]
- Markdown
  - The rich text editor is built with the well-maintained [Lexical](https://lexical.dev/) framework, which solves various issues with a [Slate](https://github.com/ianstormtaylor/slate)-based editor in Netlify/Decap CMS, including fatal application crashes,[^71][^72][^73][^111] lost formatting when pasting,[^124] an extra line break when pasting,[^169] backslash injections,[^53] dropdown visibility,[^70] and text input difficulties with IME.[^54]
  - The default editor mode can be set by changing the order of the `modes` option.[^58] If you want to use the plain text editor by default, add `modes: [raw, rich_text]` to the field configuration.
  - A Markdown field plays well with a variable type List field.[^202]
  - A combination of bold and italic doesn’t create a confusing 3-asterisk markup.[^160] In our editor, bold is 2 asterisks and italic is an underscore.
  - The built-in `image` component can be inserted with a single click.
  - The built-in `image` component allows users to add, edit or remove a link on an image.[^171]
  - It’s possible to paste/drop local/remote images into the rich text editor to insert them as expected. Note: Pasting multiple images is [not supported in Firefox](https://bugzilla.mozilla.org/show_bug.cgi?id=864052). In Netlify/Decap CMS, pasting an image may cause the application to crash.
  - The built-in `code-block` component is implemented just like a blockquote. You can simply convert a normal paragraph into a code block instead of adding a component.
  - Code in a code block in the editor can be copied as expected.[^165]
  - Language-annotated code block doesn’t trigger unsaved changes.[^189]
  - Soft line breaks are [rendered as hard line breaks](#rendering-soft-line-breaks-as-hard-line-breaks-in-markdown) in the Preview Pane.
- Number
  - If the `value_type` option is `int` (default) or `float`, the `required` option is `false`, and the value is not entered, the field will be saved as `null` instead of an empty string.[^157] If `value_type` is anything else, the data type will remain a string.
- Object
  - Sveltia CMS offers two ways to have conditional fields in a collection:[^30]
    - The Object widget supports [variable types](https://decapcms.org/docs/variable-type-widgets/) (the `types` and `typeKey` options) just like the List widget.[^226]
    - An optional Object field (`required: false`) can be manually added or removed with a checkbox.[^88] If unadded or removed, the required subfields won’t trigger validation errors,[^16] and the field will be saved as `null`.
- Relation
  - Field options are displayed with no additional API requests.[^14] The confusing `options_length` option, which defaults to 20, is therefore ignored.[^76]
  - `slug` can be used for `value_field` to show all available options instead of just one in some situations.[^91]
  - Template strings with a wildcard like `{{cities.*.name}}` can also be used for `value_field`.[^94]
  - `display_fields` is displayed in the Preview Pane instead of `value_field`.
  - The redundant `search_fields` option is optional in Sveltia CMS, as it defaults to `display_fields`, `value_field` or the collection’s `identifier_field`, which is `title` by default.
  - The `value_field` option is also optional in Sveltia CMS, as it defaults to `{{slug}}` (entry slugs).
  - A new item created in a referenced collection is immediately available in the options.[^138]
  - A referenced DateTime field value is displayed in the specified format.[^221]
  - It’s possible to refer to a List field with the `field` option, which produces a single subfield but does not output the subfield `name` in the data, using the `value_field: cities.*.name` syntax. ([Discussion](https://github.com/sveltia/sveltia-cms/discussions/400))
- Select
  - It’s possible to select an option with value `0`.[^56]
  - `label` is displayed in the Preview Pane instead of `value`.
- String
  - When a YouTube video URL is entered in a String field, it appears as an embedded video in the Preview Pane. Check your site’s [CSP](#setting-up-content-security-policy) if the preview doesn’t work.
  - When a regular URL is entered in a String field, it appears as a link that can be opened in a new browser tab.
  - Supports the `type` option that accepts `url` or `email` as a value, which will validate the value as a URL or email.
  - Supports the `prefix` and `suffix` string options, which automatically prepend and/or append the developer-defined value to the user-input value, if it’s not empty.
- Boolean, Number and String
  - Supports the `before_input` and `after_input` string options, which allow developers to display custom labels before and/or after the input UI.[^28] Markdown is supported in the value.
    - Compatibility note: In Static CMS, these options are implemented as `prefix` and `suffix`, respectively, which have different meaning in Sveltia CMS.
- File and Image
  - The new `accept` option allows files to be filtered by a comma-separated list of unique file type specifiers, in the same way as the HTML [`accept` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/accept) for `<input type="file">`.[^216]
    - By default, the Image widget only accepts an AVIF, GIF, JPEG, PNG, WebP or SVG image. BMP, HEIC, JPEG XL, PSD, TIFF and other less common or non-standard files are excluded.[^217]
    - The File widget has no default restriction.
  - Provides a reimagined all-in-one asset selection dialog for File and Image fields.
    - Entry, file, [collection](#using-a-custom-media-folder-for-a-collection) and global assets are listed on separate tabs for easy selection.[^19]
    - A new asset can be uploaded by dragging & dropping it into the dialog.[^20]
    - A URL can also be entered in the dialog.
    - Integration with Pexels, Pixabay and Unsplash makes it easy to select and insert a free stock photo.[^8] More stock photo providers will be added in the future.
  - Users can also simply drag and drop a file onto a File/Image field to attach it without having to open the Select File dialog.
  - Large images automatically fit in the Preview Pane instead of being displayed at their original size, which can easily exceed the width of the pane.
  - If the `public_folder` contains `{{slug}}` and you’ve edited a slug field (e.g. `title`) of a new entry after uploading an asset, the updated slug will be used in the saved asset path.[^140] Other dynamic template tags such as `{{filename}}` will also be populated as expected.[^141]
  - The CMS prevents the same file from being uploaded twice. It compares the hashes and selects an existing asset instead.
- List and Object
  - The `summary` is displayed correctly when it refers to a Relation field[^36] or a simple List field.
  - The `summary` template tags support [transformations](https://decapcms.org/docs/summary-strings/), e.g. `{{fields.date | date('YYYY-MM-DD')}}`.
- Markdown, String and Text
  - A required field containing only spaces or line breaks will result in a validation error, as if no characters were entered.
- Relation and Select
  - If a dropdown list has options with long wrapping labels, they won’t overlap with the next option.[^83]
  - When there are 5 or fewer options, the UI automatically switches from a dropdown list to radio buttons (single-select) or checkboxes (multi-select) for faster data entry.[^61] This number can be changed with the `dropdown_threshold` option for the `relation` and `select` widgets.
- String and Text
  - Supports the `minlength` and `maxlength` options, which allow developers to specify the minimum and maximum number of characters required for input without having to write a custom regular expression with the `pattern` option. A character counter is available when one of the options is given, and a user-friendly validation error is displayed if the condition is not met.

#### New widgets

- Compute
  - The experimental `compute` widget allows to reference the value of other fields in the same collection, similar to the `summary` property for the List and Object widgets.[^104] Use the `value` property to define the value template, e.g. `posts-{{fields.slug}}`. ([Example](https://github.com/sveltia/sveltia-cms/issues/111))
  - The `value` property also supports a value of `{{index}}`, which can hold the index of a list item. ([Example](https://github.com/sveltia/sveltia-cms/issues/172))
- KeyValue (Dictionary)
  - The new `keyvalue` widget allows users to add arbitrary key-value string pairs to a field.[^123]
  - While the implementation is compatible with [Static CMS](https://staticjscms.netlify.app/docs/widget-keyvalue), we provide a more intuitive UI. You can press Enter to move focus or add a new row while editing, and the preview is displayed in a clean table.
- UUID
  - In addition to [generating UUIDs for entry slugs](#using-a-random-id-for-an-entry-slug), Sveltia CMS supports the proposed `uuid` widget with the following properties:[^12]
    - `prefix`: A string to be prepended to the value. Default: an empty string.
    - `use_b32_encoding`: Whether to encode the value with Base32. Default: `false`.
    - `read_only`: Whether to make the field read-only. Default: `true`.

### Better asset management

- A completely new, full-fledged Asset Library, built separately from the image selection dialog, makes it easy to manage all of your files, including images, videos and documents.[^96]
  - Navigate between the global media folder and [collection media folders](#using-a-custom-media-folder-for-a-collection).[^6]
  - Preview image, audio, video, text and PDF files. Check your site’s [CSP](#setting-up-content-security-policy) if the preview doesn’t work.
  - Copy the public URL,[^74] file path, text data or image data of a selected asset to clipboard. The file path starts with `/` as expected.[^48]
  - Edit plain text assets, including SVG images.
  - Rename existing assets. If the asset is used in any entries, the File/Image fields will be automatically updated with a new file path.
  - Replace existing assets.
  - Download one or more selected assets at once.
  - Delete one or more selected assets at once.
  - Upload multiple assets at once, including files in nested folders, by browsing or dragging and dropping them into the library.[^5]
  - Sort or filter assets by name or file type.
  - View asset details, including size, dimensions, commit author/date and a list of entries that use the selected asset.
- Enhancements to media libraries:
  - Supports multiple media libraries with the [new `media_libraries` option](#configuring-multiple-media-libraries).[^195]
  - Default media library
    - It comes with a [built-in image optimizer](#optimizing-images-for-upload). With a few lines of configuration, images selected by users for upload are automatically converted to WebP format for reduced size,[^199] and it’s also possible to specify a maximum width and/or height.[^200] SVG images can also be optimized.
    - The `max_file_size` option for the File/Image widget can be defined within the global `media_library` option, using `default` as the library name. It applies to all File/Image entry fields, as well as direct uploads to the Asset Library. The option can also be part of the [new `media_libraries` option](#configuring-multiple-media-libraries).
  - Other integrations
    - Integrates stock photo providers, including Pexels, Pixabay and Unsplash.[^8] Developers can [disable them](#disabling-stock-assets) if needed.
    - More integration options, including Amazon S3 and Cloudflare R2/Images/Stream, would be added in the future.
- The global `media_folder` can be an empty string (or `.` or `/`) if you want to store assets in the root folder.
- PDF documents are displayed with a thumbnail image in both the Asset Library and the Select File dialog, making it easier to find the file you’re looking for.[^38]
- Assets stored in an entry-relative media folder are displayed in the Asset Library.[^142]
- These entry-relative assets are automatically deleted when the associated entry is deleted because these are not available for other entries.[^22] When you’re [working with a local repository](#working-with-a-local-git-repository), the empty enclosing folder is also deleted.
- Hidden files (dot files) don’t appear in the Asset Library.[^47]
- Users can add assets using the Quick Add button in the upper right corner of the application.
- Files are uploaded with their original names, without converting uppercase letters and spaces to lowercase letters and hyphens.[^97]

### Better customization

- The application renders within the dimensions of a [custom mount element](https://decapcms.org/docs/custom-mounting/), if exists.[^109]
- A custom logo defined with the `logo_url` property is displayed on the global application header and the browser tab (favicon).[^134] A smaller logo is also correctly positioned on the authentication page.[^135]
- [`CMS.registerCustomFormat()`](https://decapcms.org/docs/custom-formatters/) supports async parser/formatter functions.[^149]
- The component definition for [`CMS.registerEditorComponent()`](https://decapcms.org/docs/custom-widgets/#registereditorcomponent) accepts the `icon` property. Developers can specify a Material Symbols icon name just like [custom collection icons](#using-a-custom-icon-for-a-collection).

### Better localization

- The application UI locale is automatically selected based on the preferred language set with the browser.[^132] Users can also change the locale in the application settings. Therefore, the `locale` configuration option is ignored and `CMS.registerLocale()` is not required.
- The List widget’s `label` and `label_singular` are not converted to lowercase, which is especially problematic in German, where all nouns are capitalized.[^98]
- Long menu item labels, especially in non-English locales, don’t overflow the dropdown container.[^117]

## Compatibility

We are trying to make Sveltia CMS compatible with Netlify/Decap CMS where possible, so that more users can seamlessly switch to our modern alternative. It’s ready to be used as a drop-in replacement for Netlify/Decap CMS in some casual use case scenarios with a [single line of code update](#migration).

However, 100% feature parity is not planned, and some features are still missing or will not be added due to performance, deprecation and other factors. Look at the compatibility info below to see if you can migrate now or in the near future.

### Features not to be implemented

- **Azure, Bitbucket and Forgejo backends**: For performance reasons. We may support these platforms if their APIs improve to allow the CMS to fetch multiple entries at once. Our Gitea backend is not compatible with Forgejo due to API differences. [Forgejo support](https://github.com/sveltia/sveltia-cms/issues/381) will not be added until they implement an equivalent API enhancement.
- **Git Gateway backend**: Also for performance reasons. [Git Gateway](https://github.com/netlify/git-gateway) has not been actively maintained since Netlify CMS was abandoned, and it’s known to be slow and prone to rate limit violations. We plan to develop a GraphQL-based high-performance alternative in the future.
- **Netlify Identity Widget**: It’s not useful without Git Gateway, and the Netlify Identity service itself is now [deprecated](https://www.netlify.com/changelog/deprecation-netlify-identity/). We plan to develop an alternative solution with role support in the future, most likely using [Cloudflare Workers](https://workers.cloudflare.com/) and [Auth.js](https://authjs.dev/).
- The deprecated client-side implicit grant for the GitLab backend: It has already been [removed from GitLab 15.0](https://gitlab.com/gitlab-org/gitlab/-/issues/344609). Use the client-side PKCE authorization instead.
- The deprecated Netlify Large Media service: Consider other storage providers.
- Deprecated camel case configuration options: Use snake case instead, according to the current Decap CMS document.
  - [Collection](https://decapcms.org/docs/configuration-options/#sortable_fields): `sortableFields`
  - [DateTime](https://decapcms.org/docs/widgets/#datetime) widget: `dateFormat`, `timeFormat`, `pickerUtc`
  - [Markdown](https://decapcms.org/docs/widgets/#markdown) widget: `editorComponents`
  - [Number](https://decapcms.org/docs/widgets/#number) widget: `valueType`
  - [Relation](https://decapcms.org/docs/widgets/#relation) widget: `displayFields`, `searchFields`, `valueField`
  - Note: Some other camel case options, including Color widget options, are not deprecated.
- The deprecated Date widget: It was removed from Decap CMS 3.0 and Sveltia CMS 0.10. Use the DateTime widget with the [`time_format: false` option](#changing-the-input-type-of-a-datetime-field) instead.
- Some date/time format tokens: [Decap CMS 3.1.1](https://github.com/decaporg/decap-cms/releases/tag/decap-cms%403.1.1) replaced Moment.js with Day.js, and Sveltia CMS will follow suit soon. Since [Day.js tokens](https://day.js.org/docs/en/display/format) are not 100% compatible with [Moment.js tokens](https://momentjs.com/docs/#/displaying/format/), this could be a breaking change in certain cases.
- The theme and keymap inline settings of the Code widget, along with support for some languages: We use the [Prism](https://prismjs.com/)-powered code block functionality in Lexical instead of [CodeMirror](https://codemirror.net/). Prism may be [replaced by Shiki](https://github.com/facebook/lexical/issues/6575) in the future.
- Remark plugins for the Markdown widget: Not compatible with our Lexical-based rich text editor.
- An absolute URL in the [`public_folder`](https://decapcms.org/docs/configuration-options/#public-folder) option: Such configuration is not recommended, as stated in the Netlify/Decap CMS document.
- Performance-related options: Sveltia CMS has [drastically improved performance](#better-performance) with GraphQL enabled by default, so these are no longer relevant:
  - Global: [`search`](https://decapcms.org/docs/configuration-options/#search)
  - Backend: [`use_graphql`](https://decapcms.org/docs/github-backend/#graphql-api)
  - Relation widget: `options_length`
- The global [`locale`](https://decapcms.org/docs/configuration-options/#locale) option and `CMS.registerLocale()` method: Sveltia CMS automatically detects the user’s preferred language and changes the UI locale as [mentioned above](#better-localization).
- [Undocumented methods](https://github.com/sveltia/sveltia-cms/blob/c69446da7bb0bab7405be741c0f92850c5dddfa8/src/main.js#L14-L37) exposed on the `CMS` object: This includes custom backends and custom media libraries, if any. We may support these features in the future, but our implementation would likely be incompatible with Netlify/Decap CMS.
- Any other undocumented options/features. Exceptions apply.

### Current limitations

These Netlify/Decap CMS features are not yet implemented in Sveltia CMS. We are working hard to add them before the 1.0 release due Q4 2025. Check the [release notes](https://github.com/sveltia/sveltia-cms/releases) and [Bluesky](https://bsky.app/profile/sveltiacms.app) for updates.

- Comprehensive site config validation
- [Localization](https://github.com/sveltia/sveltia-cms/blob/main/src/lib/locales/README.md) other than English and Japanese
- [Cloudinary](https://decapcms.org/docs/cloudinary/) and [Uploadcare](https://decapcms.org/docs/uploadcare/) media libraries ([#4](https://github.com/sveltia/sveltia-cms/discussions/4))
- Field-specific media folders (beta) for the [File](https://decapcms.org/docs/widgets/#file) and [Image](https://decapcms.org/docs/widgets/#image) widgets
- [Map](https://decapcms.org/docs/widgets/#map) widget
- [Custom widgets](https://decapcms.org/docs/custom-widgets/)
- [Custom editor components](https://decapcms.org/docs/custom-widgets/#registereditorcomponent): Support for preview, Object/List widgets, and the `default` field option
- [Custom previews](https://decapcms.org/docs/customization/) ([#51](https://github.com/sveltia/sveltia-cms/issues/51))
- [Event hooks](https://decapcms.org/docs/registering-events/) ([#167](https://github.com/sveltia/sveltia-cms/issues/167))

Due to the complexity, we have decided to defer the following features to the 2.0 release. Netlify/Decap CMS has a number of open issues with the collaboration and beta features — we want to implement them the right way.

- [Editorial Workflow](https://decapcms.org/docs/editorial-workflows/)
- [Open Authoring](https://decapcms.org/docs/open-authoring/)
- [Nested Collections](https://decapcms.org/docs/collection-nested/) (beta)

Found a compatibility issue or other missing feature? [Let us know](https://github.com/sveltia/sveltia-cms/issues/new?type=bug). Bear in mind that undocumented behaviour can easily be overlooked.

### Compatibility with Static CMS

Sveltia CMS provides partial compatibility with [Static CMS](https://github.com/StaticJsCMS/static-cms), a now-defunct fork of Netlify CMS. This README will be updated as our development progresses.

- Configuration options
  - Static CMS made [some breaking changes](https://staticjscms.netlify.app/docs/decap-migration-guide) to view filters/groups, List widget, etc. while Sveltia CMS follows Netlify/Decap CMS, so you should review your configuration carefully.
  - The `default` option for sortable fields is [implemented in Sveltia CMS](#specifying-default-sort-field-and-direction).
  - Directory navigation in the Asset Library is partially supported in Sveltia CMS. If you define [collection-specific `media_folder`s](#using-a-custom-media-folder-for-a-collection), these folders will be displayed in the Asset Library and Select File/Image dialog. Display of subfolders within a configured folder will be implemented before GA. We don’t plan to support the `folder_support` and `display_in_navigation` options for `media_library`; subfolders will be displayed with no configuration. ([#301](https://github.com/sveltia/sveltia-cms/issues/301))
  - The `logo_link` global option will not be supported. Use `display_url` or `site_url` instead.
  - The `yaml` global option will not be supported, as Sveltia CMS doesn’t expose the underlying `yaml` library options for forward compatibility reasons. However, we do have some [data output options](#controlling-data-output), including YAML indentation and quotes.
- I18n support
  - The `enforce_required_non_default` i18n option will not be supported. Sveitia CMS enforces required fields in all locales by default. However, the `save_all_locales` or `initial_locales` i18n option allows users to [disable non-default locales](#disabling-non-default-locale-content) if needed. Developers can also specify a subset of locales with the `required` field option, e.g. `required: [en]`.
- Widgets
  - The date/time format options for the DateTime widget are incompatible since Static CMS [switched to date-fns](https://staticjscms.netlify.app/docs/decap-migration-guide#dates) while Sveltia CMS continues to use Moment.js (and will soon switch to Day.js). Update your formats accordingly.
  - The KeyValue widget is implemented in Sveltia CMS with the same options.
  - The UUID widget is also implemented, but with different options.
  - The `prefix` and `suffix` options for the Boolean, Number and String widgets are implemented as `before_input` and `after_input` in Sveltia CMS, respectively. Our `prefix` and `suffix` options for the String widget are literally a prefix and suffix to the value.
  - The `multiple` option for the File and Image widgets will be implemented in Sveltia CMS before GA. ([#10](https://github.com/sveltia/sveltia-cms/issues/10))
- Customization
  - `CMS.registerIcon()` will not be supported, as Sveltia CMS includes the Material Symbols font for [custom collection icons](#using-a-custom-icon-for-a-collection) that doesn’t require manual registration.

### Framework support

While Sveltia CMS is built with Svelte, the application is **framework-agnostic**. It’s a small, compiled, vanilla JavaScript bundle that manages content in a Git repository directly via an API. It doesn’t interact with the framework that builds your site.

So you can use the CMS with any framework or static site generator (SSG) that can load static files during the build process, including but not limited to Astro, Eleventy, Hugo, Jekyll, Next.js, SvelteKit and VitePress.

We have added support for features and file structures used in certain frameworks and i18n libraries, such as [index file inclusion](#including-hugos-special-index-file-in-a-folder-collection) and [slug localization](#localizing-entry-slugs) for Hugo, i18n support for Astro and Zola, and [some enhancements](https://github.com/sveltia/sveltia-cms/issues/230) for VitePress. [Let us know](https://github.com/sveltia/sveltia-cms/issues/new?type=feature) if your framework has specific requirements.

### Backend support

- The GitLab backend requires GitLab 16.3 or later.
- The Gitea backend requires Gitea 1.24 or later. It’s not compatible with Forgejo due to API differences. Support for Forgejo is tracked in [#381](https://github.com/sveltia/sveltia-cms/issues/381). The default origin of the `base_url` and `api_root` [backend options](https://decapcms.org/docs/backends-overview/#backend-configuration) is set to `https://gitea.com` (public free service) instead of `https://try.gitea.io` (test instance).

### Browser support

Sveitia CMS works with all modern browsers, but there are a few limitations because it utilizes some new web technologies:

- The [local repository workflow](#working-with-a-local-git-repository) requires a Chromium-based browser, including Chrome, Edge and Brave.
- Safari: The Test backend doesn’t save changes locally; [image optimization](#optimizing-images-for-upload) is slower than in other browsers.
- Firefox Extended Support Release (ESR) and its derivatives, including Tor Browser and Mullvad Browser, are not officially supported, although they may still work.

### Other notes

- Sveltia CMS requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts), meaning it only works with HTTPS, `localhost` or `127.0.0.1` URLs. If you’re running a remote server yourself and the content is served over HTTP, get a TLS certificate from [Let’s Encrypt](https://letsencrypt.org/).

## Getting started

### Installation & setup

Currently, Sveltia CMS is primarily intended for existing Netlify/Decap CMS users. If you don’t have it yet, follow [their documentation](https://decapcms.org/docs/basic-steps/) to add it to your site and create a configuration file first. Skip the [Choosing a Backend](https://decapcms.org/docs/choosing-a-backend/) page and choose the [GitHub](https://decapcms.org/docs/github-backend/), [GitLab](https://decapcms.org/docs/gitlab-backend/) or [Gitea](https://decapcms.org/docs/gitea-backend/) backend instead. Then migrate to Sveltia CMS as described below.

Or try one of the starter kits for popular frameworks created by community members:

- Astro
  - [astro-sveltia-cms](https://github.com/majesticostudio/astro-sveltia-cms), [astro-starter](https://github.com/zankhq/astro-starter) and [astros](https://github.com/zankhq/astros) by [@zanhk](https://github.com/zanhk)
  - [Astro i18n Starter](https://github.com/yacosta738/astro-cms) by [@yacosta738](https://github.com/yacosta738)
- Eleventy (11ty)
  - [Eleventy starter template](https://github.com/danurbanowicz/eleventy-sveltia-cms-starter) by [@danurbanowicz](https://github.com/danurbanowicz)
- Hugo
  - [Hugo module](https://github.com/privatemaker/headless-cms) by [@privatemaker](https://github.com/privatemaker)
  - [hugolify-admin](https://github.com/Hugolify/hugolify-admin) by [@sebousan](https://github.com/sebousan)

The Netlify/Decap CMS website has more [templates](https://decapcms.org/docs/start-with-a-template/) and [examples](https://decapcms.org/docs/examples/). You can probably use one of them and switch to Sveltia CMS. (Note: These third-party resources are not necessarily reviewed by the Sveltia CMS team.)

Unfortunately, we are unable to provide free installation and setup support at this time. As the product evolves, we’ll provide a built-in configuration editor, comprehensive documentation and official starter kits to make it easier for everyone to get started with Sveltia CMS.

### Migration

Have a look at the [compatibility info](#compatibility) above first. If you’re already using Netlify/Decap CMS with the GitHub, GitLab or Gitea backend and don’t have any unsupported features like custom widgets or nested collections, migrating to Sveltia CMS is super easy — it works as a drop-in replacement.

Open `/admin/index.html` locally with an editor like VS Code and replace the CMS `<script>` tag with the new one:

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

Next, let’s [test Sveltia CMS on your local machine](#working-with-a-local-git-repository). If everything looks good, push the change to your repository.

You can now open `https://[hostname]/admin/` as usual to start editing. There is even no authentication process if you’re already signed in with GitHub or GitLab on Netlify/Decap CMS because Sveltia CMS uses your auth token stored in the browser. Simple enough!

#### Migrating from Git Gateway backend

Sveltia CMS does not support the Git Gateway backend due to performance limitations. If you don’t care about user management with Netlify Identity, you can use the [GitHub](https://decapcms.org/docs/github-backend/) or [GitLab](https://decapcms.org/docs/gitlab-backend/) backend instead. Make sure **you install an OAuth client** on GitHub or GitLab in addition to updating your configuration file. As noted in the document, Netlify is still able to facilitate the auth flow.

To allow multiple users to edit content, simply invite people to your GitHub repository with the write role assigned.

Once you have migrated from the Git Gateway and Netlify Identity combo, you can remove the Netlify Identity Widget script tag from your HTML:

```diff
-<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
```

If you want to stay with Netlify Identity, unfortunately you can’t migrate to Sveltia CMS right now. We plan to develop an alternative to Git Gateway and Netlify Identity Widget in the future.

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

### Providing multiple configuration files

With Sveltia CMS, developers can modularize the site configuration. Just provide multiple config links and the CMS will automatically merge them in the order of `<link>` tag appearance. It’s possible to use YAML, [JSON](#providing-a-json-configuration-file) or both.

```html
<link href="/admin/config.yml" type="application/yaml" rel="cms-config-url" />
<link href="/admin/collections/authors.yml" type="application/yaml" rel="cms-config-url" />
<link href="/admin/collections/pages.yml" type="application/yaml" rel="cms-config-url" />
<link href="/admin/collections/posts.yml" type="application/yaml" rel="cms-config-url" />
```

Both standard `application/yaml` and non-standard `text/yaml` are acceptable for the YAML config link `type`.

Limitation: YAML anchors, aliases and merge keys only work if they are in the same file, as files are merged with the [`deepmerge`](https://www.npmjs.com/package/deepmerge) library after being parsed as separate JavaScript objects.

### Working around an authentication error

If you get an “Authentication Aborted” error when trying to sign in to GitHub, GitLab or Gitea using the authorization code flow, you may need to check your site’s [`Cross-Origin-Opener-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy). The COOP header is not widely used, but it’s known to break the OAuth flow with a popup window. If that’s your case, changing `same-origin` to `same-origin-allow-popups` solves the problem. ([Discussion](https://github.com/sveltia/sveltia-cms/issues/131))

### Working with a local Git repository

Sveltia CMS has simplified the local repository workflow by removing the need for additional configuration (the `local_backend` property) and a proxy server (`netlify-cms-proxy-server` or `decap-server`), thanks to the [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) available in [some modern browsers](https://developer.mozilla.org/en-US/docs/web/api/window/showopenfilepicker#browser_compatibility).

Here are the workflow steps and tips:

1. Make sure you have configured the [GitHub](https://decapcms.org/docs/github-backend/), [GitLab](https://decapcms.org/docs/gitlab-backend/) or [Gitea](https://decapcms.org/docs/gitea-backend/) backend.
   - The Git Gateway backend mentioned in the Netlify/Decap CMS [local Git repository document](https://decapcms.org/docs/working-with-a-local-git-repository/) is not supported in Sveltia CMS, so `name: git-gateway` won’t work. Use `github`, `gitlab` or `gitea` for the `name` along with the `repo` definition. If you haven’t determined your repository name yet, just use a tentative name.
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

Note that, as with Netlify/Decap CMS, the local repository support in Sveltia CMS doesn’t perform any Git operations. You’ll have to manually fetch, pull, commit and push all changes using a Git client. In the future, we’ll figure out if there’s a way to commit in a browser, because the proxy server actually has the undocumented, experimental `git` mode that creates commits to a local repository.[^131] ([Discussion](https://github.com/sveltia/sveltia-cms/discussions/31))

You will also need to reload the CMS after making changes to the configuration file or retrieving remote updates. We plan to eliminate this manual work with the newly available [File System Observer API](https://developer.chrome.com/blog/file-system-observer).

If you have migrated from Netlify/Decap CMS and are happy with the local repository workflow of Sveltia CMS, you can remove the `local_backend` property from your configuration and uninstall the proxy server. If you have configured a custom port number with the `.env` file, you can remove it as well.

### Enabling local development in Brave

In the Brave browser, you must enable the File System Access API with an experiment flag to take advantage of the [local repository workflow](#working-with-a-local-git-repository).

1. Open `brave://flags/#file-system-access-api` in a new browser tab.
1. Click Default (Disabled) next to File System Access API and select Enabled.
1. Relaunch the browser.

### Using a custom icon for a collection

You can specify an icon for each collection for easy identification in the collection list. You don’t need to install a custom icon set because the Material Symbols font file is already loaded for the application UI. Just pick one of the 2,500+ icons:

1. Visit the [Material Symbols](https://fonts.google.com/icons?icon.set=Material+Symbols&icon.platform=web) page on Google Fonts.
1. Browse and select an icon, and copy the icon name that appears at the bottom of the right pane.
1. Add it to one of your collection definitions in `config.yml` as the new `icon` property, like the example below.
1. Repeat the same steps for all the collections if desired.
1. Commit and push the changes to your Git repository.
1. Reload Sveltia CMS once the updated config file is deployed.

```yaml
fields:
  - name: tags
    label: Tags
    icon: sell # or any icon name
    create: true
    folder: content/tags
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

This is actually not new in Sveltia CMS but rather an undocumented feature in Netlify/Decap CMS.[^4] You can specify media and public folders for each collection that override the [global media folder](https://decapcms.org/docs/configuration-options/#media-and-public-folders). Well, it’s [documented](https://decapcms.org/docs/collection-folder/#media-and-public-folder), but that’s probably not what you want.

Rather, if you’d like to add all the media files for a collection in one single folder, specify both `media_folder` and `public_folder` instead of leaving them empty. The trick is to use a **project relative path starting with a slash** for `media_folder` like the example below. You can try this with Netlify/Decap CMS first if you prefer.

```yaml
media_folder: static/media # leading slash is optional
public_folder: /media

collections:
  - name: products
    label: Products
    folder: content/products
    media_folder: /static/media/products # make sure to append a slash
    public_folder: /media/products
```

In Sveltia CMS, those collection media folders are displayed prominently for easier asset management. We recommend setting `media_folder` and `public_folder` for each collection if it contains one or more File/Image fields.

### Specifying default sort field and direction

Sveltia CMS has extended the `sortable_fields` collection option to allow developers to define the field name and direction to be used for sorting entries by default. Our implementation is compatible with Static CMS. This is especially useful if you want to show entries sorted by date from new to old:

```yaml
collections:
  - name: posts
    sortable_fields:
      fields: [title, published_date, author]
      default:
        field: published_date
        direction: descending # default: ascending
```

For backward compatibility with [Netlify/Decap CMS](https://decapcms.org/docs/configuration-options/#sortable_fields), `sortable_fields` with a field list (an array) will continue to work.

For backward compatibility with [Static CMS](https://staticjscms.netlify.app/docs/collection-overview#sortable-fields), the `direction` option accepts title case values: `Ascending` and `Descending`. However, `None` is not supported and has the same effect as `ascending`.

### Including Hugo’s special index file in a folder collection

Before this feature, Hugo’s [special `_index.md` file](https://gohugo.io/content-management/organization/#index-pages-_indexmd) was hidden in a folder collection, and you had to create a file collection to manage the file, since it usually comes with a different set of fields than regular entry fields. Now, with the new `index_file` option, you can add the index file to the corresponding folder collection, above regular entries, for easier editing:

```yaml
collections:
  - name: posts
    label: Blog posts
    folder: content/posts
    fields: # Fields for regular entries
      ...
    index_file:
      name: _index # File name, required
      fields: # Fields for the index file. If omitted, regular entry fields are used
        ...
      editor:
        preview: false # Hide the preview pane if needed
```

Note that the special index file is placed right under the `folder`, regardless of the collection’s [`path` option](https://decapcms.org/docs/collection-folder/#folder-collections-path). For example, if the `path` is `{{year}}/{{slug}}`, a regular entry would be saved as `content/posts/2025/title.md`, but the index file remains at `content/posts/_index.md`.

### Using keyboard shortcuts

- View the Content Library: `Alt+1`
- View the Asset Library: `Alt+2`
- Search for entries and assets: `Ctrl+F` (Windows/Linux) or `Command+F` (macOS)
- Create a new entry: `Ctrl+E` (Windows/Linux) or `Command+E` (macOS)
- Save an entry: `Ctrl+S` (Windows/Linux) or `Command+S` (macOS)
- Cancel entry editing: `Escape`

Standard keyboard shortcuts are also available in the Markdown editor, including `Ctrl+B`/`Command+B` for bold text, `Ctrl+I`/`Command+I` for italics, and `Tab` to indent a list item.

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
1. Select the Contents tab.
1. Replace your free API key ending with `:fx` with the new paid API key in the DeepL API Authentication Key field.
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
    folder: content/posts
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

- `content/posts/en/my-trip-to-new-york.yaml`
  ```yaml
  translationKey: my-trip-to-new-york
  title: My trip to New York
  ```
- `content/posts/fr/mon-voyage-a-new-york.yaml`
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

```yaml
i18n:
  structure: multiple_files
  locales: [en, fr, de]
  default_locale: en
  save_all_locales: false # default: true
```

Alternatively, developers can specify locales to be enabled by default when users create a new entry draft, using the new `initial_locales` option, which accepts a locale list, `default` (default locale only) or `all` (all locales). The default locale is always enabled, even if it’s excluded from `initial_locales`. When this option is used, `save_all_locales` is deemed `false`.

The following example disables German by default, but users can manually enable it if needed. Users can also disable French, which is enabled by default.

```yaml
i18n:
  structure: multiple_files
  locales: [en, fr, de]
  default_locale: en
  initial_locales: [en, fr]
```

### Using a random ID for an entry slug

By default, the [slug for a new entry file](https://decapcms.org/docs/configuration-options/#slug) will be generated based on the entry’s `title` field. Or, you can specify the collection’s `slug` option to use the file creation date or other fields. While the behaviour is generally acceptable and SEO-friendly, it’s not useful if the title might change later or if it contains non-Latin characters like Chinese. In Sveltia CMS, you can easily generate a random [UUID](https://developer.mozilla.org/en-US/docs/Glossary/UUID) for a slug without a custom widget!

It’s simple — just specify `{{uuid}}` (full UUID v4), `{{uuid_short}}` (last 12 characters only) or `{{uuid_shorter}}` (first 8 characters only) in the `slug` option. The results would look like `4fc0917c-8aea-4ad5-a476-392bdcf3b642`, `392bdcf3b642` and `4fc0917c`, respectively.

```yaml
collections:
  - name: members
    label: Members
    slug: '{{uuid_short}}' # or {{uuid}} or {{uuid_shorter}}
```

### Configuring multiple media libraries

The traditional [`media_library`](https://decapcms.org/docs/configuration-options/#media-library) option allows developers to configure only one media library:

```yaml
media_library:
  name: default
  config:
    max_file_size: 1024000
```

Sveltia CMS has added support for multiple media libraries with the new `media_libraries` option so you can mix up the default media library (your repository), [Cloudinary](https://decapcms.org/docs/cloudinary/) and [Uploadcare](https://decapcms.org/docs/uploadcare/). The new option can be used as a global option as well as a File/Image field option.

```yaml
media_libraries:
  default:
    config:
      max_file_size: 1024000
      transformations:
        # See the next section
  cloudinary:
    config:
      cloud_name: YOUR_CLOUD_NAME
      api_key: YOUR_API_KEY
    output_filename_only: true
  uploadcare:
    config:
      publicKey: YOUR_PUBLIC_KEY
    settings:
      autoFilename: true
      defaultOperations: '/resize/800x600/'
```

Note: Cloudinary and Uploadcare are not yet supported in Sveltia CMS.

### Optimizing images for upload

Ever wanted to prevent end-users from adding huge images to your repository? The built-in image optimizer in Sveltia CMS makes developers’ lives easier with a simple configuration like this:

```yaml
media_libraries:
  default:
    config:
      transformations:
        raster_image: # original format
          format: webp # new format, only `webp` is supported
          quality: 85 # default: 85
          width: 2048 # default: original size
          height: 2048 # default: original size
        svg:
          optimize: true
```

Then, whenever a user selects images to upload, those images are automatically optimized, all within the browser. Raster images such as JPEG and PNG are converted to WebP format and resized if necessary. SVG images are minified using the [SVGO](https://github.com/svg/svgo) library.

In case you’re not aware, [WebP](https://developers.google.com/speed/webp) offers better compression than conventional formats and is now [widely supported](https://caniuse.com/webp) across major browsers. So there is no reason not to use WebP on the web.

- As [noted above](#configuring-multiple-media-libraries), the `media_libraries` option can be global at the root level of `config.yml`, which applies to both entry fields and the Asset Library, or field-specific for the File/Image widgets.
- `raster_image` applies to any supported raster image format: `avif`, `bmp`, `gif`, `jpeg`, `png` and `webp`. If you like, you can use a specific format as key instead of `raster_image`.
- The `width` and `height` options are the maximum width and height, respectively. If an image is larger than the specified dimension, it will be scaled down. Smaller images will not be resized.
- File processing is a bit slow on Safari because [native WebP encoding](https://caniuse.com/mdn-api_htmlcanvaselement_toblob_type_parameter_webp) is [not supported](https://bugs.webkit.org/show_bug.cgi?id=183257) and the [jSquash](https://github.com/jamsinclair/jSquash) library is used instead.
- AVIF conversion is not supported because no browser has native AVIF encoding support ([Chromium won’t fix it](https://issues.chromium.org/issues/40848792)) and the third-party library (and AVIF encoding in general) is very slow.
- This feature is not intended for creating image variants in different formats and sizes. It should be done with a framework during the build process.
- We may add more transformation options in the future.

### Disabling stock assets

The Select File/Image dialog includes some stock photo providers for convenience, but sometimes these may be irrelevant. Developers can hide them with the following configuration:

```yaml
media_libraries:
  stock_assets:
    providers: []
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

### Changing the input type of a DateTime field

It may be worth mentioning this topic here because the current [Decap CMS doc about the DateTime widget](https://decapcms.org/docs/widgets/#datetime) is unclear. By default, a DateTime field lets users pick both [date and time](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/datetime-local), but developers can change the input type if needed.

Use `time_format: false` to hide the time picker and make the input [date only](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date):

```yaml
- label: Start Date
  name: startDate
  widget: datetime
  time_format: false
```

Use `date_format: false` to hide the date picker and make the input [time only](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/time):

```yaml
- label: Start Time
  name: startTime
  widget: datetime
  date_format: false
```

We understand that this configuration may be a bit confusing, but it’s necessary to maintain backward compatibility with Netlify CMS. We plan to improve the widget options and introduce new input types: [month](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/month) and [week](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/week).

### Rendering soft line breaks as hard line breaks in Markdown

This tip is not really specific to Sveltia CMS, but some developers have asked the maintainer about it:

In the Markdown editor, pressing `Shift+Enter` inserts a [soft line break](https://spec.commonmark.org/0.31.2/#soft-line-breaks) (`\n`). We can’t change the behaviour to add a [hard line break](https://spec.commonmark.org/0.31.2/#hard-line-breaks) (`<br>`) — it’s a limitation of the underlying [Lexical](https://lexical.dev/) framework. However, if you look at the preview, you may notice that soft line breaks are rendered as hard line breaks. That’s because the preview is using the [Marked](https://github.com/markedjs/marked) library with the [`breaks` option](https://marked.js.org/using_advanced#options) enabled, which mimics how comments are rendered on GitHub.

Chances are the Markdown parser you use for your frontend can do the same:

- [markdown-it](https://github.com/markdown-it/markdown-it) (used in Eleventy and VitePress) also has the `breaks` option
- [remarkable](https://github.com/jonschlinkert/remarkable) also has the `breaks` option
- [Showdown](https://github.com/showdownjs/showdown) has the `simpleLineBreaks` option
- [goldmark](https://github.com/yuin/goldmark/) (used in Hugo) has the `html.WithHardWraps` option
- [kramdown](https://github.com/gettalong/kramdown) (used in Jekyll) has the `hard_wrap` option with the GFM parser
- [remark](https://github.com/remarkjs/remark) (used in Astro) offers a [plugin](https://github.com/remarkjs/remark-breaks)
- [micromark](https://github.com/micromark/micromark) clarifies it doesn’t have such an option and recommends alternatives

### Controlling data output

Sveltia CMS supports some [data output](#better-data-output) options, including JSON/YAML formatting preferences, at the root level of the configuration file. The default options are listed below:

```yaml
output:
  omit_empty_optional_fields: false
  encode_file_path: false # true to URL-encode file paths for File/Image fields
  json:
    indent_style: space # or tab
    indent_size: 2
  yaml:
    quote: none # or single or double
    indent_size: 2
```

### Disabling automatic deployments

You may already have a CI/CD tool set up on your Git repository to automatically deploy changes to production. Occasionally, you make a lot of changes to your content to quickly reach the CI/CD provider’s (free) build limits, or you just don’t want to see builds triggered for every single small change.

With Sveltia CMS, you can disable automatic deployments by default and manually trigger deployments at your convenience. This is done by adding the `[skip ci]` prefix to commit messages, the convention supported by [GitHub Actions](https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs), [GitLab CI/CD](https://docs.gitlab.com/ee/ci/pipelines/#skip-a-pipeline), [CircleCI](https://circleci.com/docs/skip-build/#skip-jobs), [Travis CI](https://docs.travis-ci.com/user/customizing-the-build/#skipping-a-build), [Netlify](https://docs.netlify.com/site-deploys/manage-deploys/#skip-a-deploy), [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/branch-build-controls/#skip-builds) and others. Here are the steps to use it:

1. Add the new `automatic_deployments` property to your `backend` configuration with a value of `false`:
   ```yaml
   backend:
     name: github
     repo: owner/repo
     branch: main
     automatic_deployments: false
   ```
1. Commit and deploy the change to the config file and reload the CMS.
1. Now, whenever you save an entry or asset, `[skip ci]` is automatically added to each commit message. However, deletions are always committed without the prefix to avoid unexpected data retention on your site.
1. If you want to deploy a new or updated entry, as well as any other unpublished entries and assets, click an arrow next to the Save button in the Content Editor, then select **Save and Publish**. This will trigger CI/CD by omitting `[skip ci]`.

If you set `automatic_deployments` to `true`, the behaviour is reversed. CI/CD will be triggered by default, while you have an option to **Save without Publishing** that adds `[skip ci]` only to the associated commit.

Gotcha: Unpublished entries and assets are not drafts. Once committed to your repository, those changes can be deployed any time another commit is pushed without `[skip ci]`, or when a manual deployment is triggered.

If the `automatic_deployments` property is defined, you can manually trigger a deployment by clicking the **Publish Changes** button on the application header. To use this feature:

- GitHub Actions:
  1. Without any configuration, Publish Changes will [trigger a `repository_dispatch` event](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event) with the `sveltia-cms-publish` event type. Update your build workflow to receive this event:
     ```yaml
     on:
       push:
         branches: [$default-branch]
       repository_dispatch:
         types: [sveltia-cms-publish]
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

(UNPKG is used not only to download the CMS script bundle, but also to check for the latest version and retrieve additional dependencies such as [PDF.js](https://github.com/mozilla/pdf.js) and [Prism](https://prismjs.com/) language definitions)

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
- Gitea: (If you’re running a self-hosted instance, use the origin instead.)
  - `img-src`
    ```
    https://gitea.com
    ```
  - `connect-src`
    ```
    https://gitea.com
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

### Showing the CMS version

1. Click on your avatar in the top right corner of the application to open the Account menu.
1. Click Settings.
1. Click the Advanced tab.
1. Enable Developer Mode.
1. Close the Settings dialog.

A Release Notes link will now appear under the Account menu with the current application version.

## Support & feedback

While we don’t have dedicated developer/user support resources, you can post [quick questions](https://github.com/sveltia/sveltia-cms/discussions/new?category=q-a) on the [Discussions](https://github.com/sveltia/sveltia-cms/discussions) page of our GitHub repository. [Feedback](https://github.com/sveltia/sveltia-cms/discussions/new?category=ideas) is also welcome, but please check the [Compatibility](#compatibility) and [Roadmap](#roadmap) sections of this README before starting a new discussion — your idea may already be covered.

Join us on [Discord](https://discord.gg/5hwCGqup5b) or ping us on [Bluesky](https://bsky.app/profile/sveltiacms.app) for a casual chat.

As described throughout this README, Sveltia CMS is being built as a replacement for Netlify/Decap CMS. At this point, we assume that most developers and users are moving from the other product. We are happy to help you migrate, but **we cannot help you set up Sveltia CMS from scratch** through our free support channels.

Planning to build a website with Sveltia CMS? Looking for professional support? Maintainer [@kyoshino](https://github.com/kyoshino) is available for hire depending on your needs. Feel free to reach out!

## Contributions

See [Contributing to Sveltia CMS](https://github.com/sveltia/sveltia-cms/blob/main/CONTRIBUTING.md). Bug reports are highly encouraged!

## Roadmap

### v1.0

Due Q4 2025

- Enhanced [compatibility with Netlify/Decap CMS](#current-limitations)
- Tackling some more Netlify/Decap CMS issues
- Accessibility audit
- [Localization](https://github.com/sveltia/sveltia-cms/blob/main/src/lib/locales/README.md)
- Developer documentation (implementation guide)
- Marketing site
- Live demo site

### v2.0

- Implementing [some deferred Netlify/Decap CMS features](#current-limitations)
- Tackling even more Netlify/Decap CMS issues
- End-user documentation
- Contributor documentation

### Future

- Tackling many of the remaining Netlify/Decap CMS issues, including MDX support,[^122] manual entry sorting,[^125] config editor[^10] and other [top-voted features](https://github.com/decaporg/decap-cms/issues?q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc)
- Exploring features that require server-side implementation, including user management (Netlify Identity alternative), roles,[^23] commits without a Git service account (Git Gateway alternative), post locking (like [WordPress](https://codex.wordpress.org/Post_Locking))[^166] and scheduled posts[^167]
- More integration options: stock photos, stock videos, cloud storage providers, translation services, maps, analytics tools, etc.
- AI integrations for image generation, content writing, translation, etc.
- Search enhancements
- Advanced digital asset management (DAM) features, including image editing and tagging[^114]
- Marketplace for custom widgets, etc.
- VS Code extension for `config.yml` schema validation
- Official starter templates for the most popular frameworks, including SvelteKit and Next.js
- and so much more!

## Trivia

- The [original version of Netlify CMS](https://github.com/netlify/netlify-cms-legacy) was built with Ember before being rewritten in React. And now we are completely rewriting it in Svelte. So this is effectively the second time the application has gone through a framework migration.
- Our [local repository workflow](#working-with-a-local-git-repository) shares implementation with the Test backend, as both utilize the [File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API), allowing us to reduce maintenance costs. The seamless local workflow is critical not only for improved DX, but also for our rapid application development.

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

[^2]: Netlify/Decap CMS [#2039](https://github.com/decaporg/decap-cms/issues/2039), [#3267](https://github.com/decaporg/decap-cms/issues/3267)

[^3]: Netlify/Decap CMS [#1040](https://github.com/decaporg/decap-cms/issues/1040)

[^4]: Netlify/Decap CMS [#3671](https://github.com/decaporg/decap-cms/issues/3671)

[^5]: Netlify/Decap CMS [#1032](https://github.com/decaporg/decap-cms/issues/1032)

[^6]: Netlify/Decap CMS [#3240](https://github.com/decaporg/decap-cms/issues/3240)

[^7]: Netlify/Decap CMS [#4386](https://github.com/decaporg/decap-cms/issues/4386), [#4888](https://github.com/decaporg/decap-cms/issues/4888)

[^8]: Netlify/Decap CMS [#2579](https://github.com/decaporg/decap-cms/issues/2579)

[^9]: Netlify/Decap CMS [#3505](https://github.com/decaporg/decap-cms/issues/3505), [#4211](https://github.com/decaporg/decap-cms/issues/4211), [#5439](https://github.com/decaporg/decap-cms/issues/5439)

[^10]: Netlify/Decap CMS [#341](https://github.com/decaporg/decap-cms/issues/341), [#1167](https://github.com/decaporg/decap-cms/issues/1167)

[^11]: Netlify/Decap CMS [#1382](https://github.com/decaporg/decap-cms/issues/1382), [#6994](https://github.com/decaporg/decap-cms/issues/6994)

[^12]: Netlify/Decap CMS [#1975](https://github.com/decaporg/decap-cms/issues/1975), [#3712](https://github.com/decaporg/decap-cms/issues/3712)

[^13]: Netlify/Decap CMS [#5112](https://github.com/decaporg/decap-cms/issues/5112), [#5653](https://github.com/decaporg/decap-cms/issues/5653)

[^14]: Netlify/Decap CMS [#4635](https://github.com/decaporg/decap-cms/issues/4635), [#5920](https://github.com/decaporg/decap-cms/issues/5920), [#6410](https://github.com/decaporg/decap-cms/issues/6410), [#6827](https://github.com/decaporg/decap-cms/issues/6827), [#6924](https://github.com/decaporg/decap-cms/issues/6924)

[^15]: Netlify/Decap CMS [#6932](https://github.com/decaporg/decap-cms/issues/6932)

[^16]: Netlify/Decap CMS [#2103](https://github.com/decaporg/decap-cms/issues/2103), [#2790](https://github.com/decaporg/decap-cms/issues/2790), [#7302](https://github.com/decaporg/decap-cms/discussions/7302)

[^17]: Netlify/Decap CMS [#1333](https://github.com/decaporg/decap-cms/issues/1333), [#4216](https://github.com/decaporg/decap-cms/issues/4216)

[^18]: Netlify/Decap CMS [#441](https://github.com/decaporg/decap-cms/issues/441), [#1277](https://github.com/decaporg/decap-cms/issues/1277), [#1339](https://github.com/decaporg/decap-cms/issues/1339), [#2500](https://github.com/decaporg/decap-cms/issues/2500), [#2833](https://github.com/decaporg/decap-cms/issues/2833), [#2984](https://github.com/decaporg/decap-cms/issues/2984), [#3852](https://github.com/decaporg/decap-cms/issues/3852)

[^19]: Netlify/Decap CMS [#5910](https://github.com/decaporg/decap-cms/issues/5910)

[^20]: Netlify/Decap CMS [#4563](https://github.com/decaporg/decap-cms/issues/4563)

[^21]: Netlify/Decap CMS [#4781](https://github.com/decaporg/decap-cms/issues/4781)

[^22]: Netlify/Decap CMS [#3615](https://github.com/decaporg/decap-cms/issues/3615), [#4069](https://github.com/decaporg/decap-cms/issues/4069), [#5097](https://github.com/decaporg/decap-cms/issues/5097), [#6642](https://github.com/decaporg/decap-cms/issues/6642)

[^23]: Netlify/Decap CMS [#2](https://github.com/decaporg/decap-cms/issues/2)

[^24]: Netlify/Decap CMS [#6831](https://github.com/decaporg/decap-cms/issues/6831)

[^25]: Netlify/Decap CMS [#526](https://github.com/decaporg/decap-cms/issues/526), [#6987](https://github.com/decaporg/decap-cms/issues/6987)

[^26]: Netlify/Decap CMS [#3285](https://github.com/decaporg/decap-cms/issues/3285), [#7030](https://github.com/decaporg/decap-cms/issues/7030), [#7067](https://github.com/decaporg/decap-cms/issues/7067), [#7217](https://github.com/decaporg/decap-cms/issues/7217)

[^27]: Netlify/Decap CMS [#4564](https://github.com/decaporg/decap-cms/issues/4564), [#5617](https://github.com/decaporg/decap-cms/issues/5617), [#5815](https://github.com/decaporg/decap-cms/issues/5815)

[^28]: Netlify/Decap CMS [#2677](https://github.com/decaporg/decap-cms/issues/2677), [#6836](https://github.com/decaporg/decap-cms/pull/6836)

[^29]: Netlify/Decap CMS [#4783](https://github.com/decaporg/decap-cms/issues/4783)

[^30]: Netlify/Decap CMS [#565](https://github.com/decaporg/decap-cms/issues/565), [#6733](https://github.com/decaporg/decap-cms/discussions/6733)

[^31]: Netlify/Decap CMS [#1045](https://github.com/decaporg/decap-cms/issues/1045)

[^32]: Netlify/Decap CMS [#302](https://github.com/decaporg/decap-cms/issues/302), [#5549](https://github.com/decaporg/decap-cms/issues/5549)

[^33]: Netlify/Decap CMS [#542](https://github.com/decaporg/decap-cms/issues/542), [#4532](https://github.com/decaporg/decap-cms/issues/4532), [#6513](https://github.com/decaporg/decap-cms/issues/6513), [#7295](https://github.com/decaporg/decap-cms/issues/7295)

[^34]: Netlify/Decap CMS [#2138](https://github.com/decaporg/decap-cms/issues/2138), [#2343](https://github.com/decaporg/decap-cms/issues/2343), [#4367](https://github.com/decaporg/decap-cms/issues/4367), [#5932](https://github.com/decaporg/decap-cms/discussions/5932)

[^35]: Netlify/Decap CMS [#7086](https://github.com/decaporg/decap-cms/issues/7086)

[^36]: Netlify/Decap CMS [#6325](https://github.com/decaporg/decap-cms/issues/6325)

[^37]: Netlify/Decap CMS [#1481](https://github.com/decaporg/decap-cms/issues/1481), [#7398](https://github.com/decaporg/decap-cms/issues/7398)

[^38]: Netlify/Decap CMS [#1984](https://github.com/decaporg/decap-cms/issues/1984)

[^39]: Netlify/Decap CMS [#946](https://github.com/decaporg/decap-cms/issues/946), [#1970](https://github.com/decaporg/decap-cms/issues/1970)

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

[^54]: Netlify/Decap CMS [#1347](https://github.com/decaporg/decap-cms/issues/1347), [#1559](https://github.com/decaporg/decap-cms/issues/1559), [#4629](https://github.com/decaporg/decap-cms/issues/4629), [#4837](https://github.com/decaporg/decap-cms/issues/4837), [#6287](https://github.com/decaporg/decap-cms/issues/6287), [#6826](https://github.com/decaporg/decap-cms/issues/6826) — Decap CMS 3.0 updated the Slate editor in an attempt to fix the problems, but the IME issues remain unresolved when using a mobile/tablet browser.

[^55]: Netlify/Decap CMS [#4480](https://github.com/decaporg/decap-cms/issues/4480), [#5122](https://github.com/decaporg/decap-cms/issues/5122), [#6353](https://github.com/decaporg/decap-cms/issues/6353)

[^56]: Netlify/Decap CMS [#6515](https://github.com/decaporg/decap-cms/issues/6515)

[^57]: Netlify/Decap CMS [#328](https://github.com/decaporg/decap-cms/issues/328), [#1290](https://github.com/decaporg/decap-cms/issues/1290)

[^58]: Netlify/Decap CMS [#5125](https://github.com/decaporg/decap-cms/issues/5125)

[^59]: Netlify/Decap CMS [#1654](https://github.com/decaporg/decap-cms/issues/1654)

[^60]: Netlify/Decap CMS [#283](https://github.com/decaporg/decap-cms/issues/283), [#386](https://github.com/decaporg/decap-cms/issues/386)

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

[^71]: Netlify/Decap CMS [#6999](https://github.com/decaporg/decap-cms/issues/6999), [#7000](https://github.com/decaporg/decap-cms/issues/7000), [#7001](https://github.com/decaporg/decap-cms/issues/7001), [#7152](https://github.com/decaporg/decap-cms/issues/7152), [#7220](https://github.com/decaporg/decap-cms/issues/7220), [#7283](https://github.com/decaporg/decap-cms/issues/7283), [#7316](https://github.com/decaporg/decap-cms/issues/7316), [#7429](https://github.com/decaporg/decap-cms/issues/7429), [#7465](https://github.com/decaporg/decap-cms/issues/7465)

[^72]: Netlify/Decap CMS [#7047](https://github.com/decaporg/decap-cms/issues/7047)

[^73]: Netlify/Decap CMS [#6993](https://github.com/decaporg/decap-cms/issues/6993), [#7123](https://github.com/decaporg/decap-cms/issues/7123), [#7127](https://github.com/decaporg/decap-cms/issues/7127), [#7128](https://github.com/decaporg/decap-cms/issues/7128), [#7237](https://github.com/decaporg/decap-cms/issues/7237), [#7251](https://github.com/decaporg/decap-cms/issues/7251), [#7361](https://github.com/decaporg/decap-cms/issues/7361), [#7391](https://github.com/decaporg/decap-cms/issues/7391), [#7393](https://github.com/decaporg/decap-cms/issues/7393), [#7470](https://github.com/decaporg/decap-cms/issues/7470), [#7475](https://github.com/decaporg/decap-cms/issues/7475), [#7480](https://github.com/decaporg/decap-cms/issues/7480)

[^74]: Netlify/Decap CMS [#4209](https://github.com/decaporg/decap-cms/issues/4209)

[^75]: Netlify/Decap CMS [#5472](https://github.com/decaporg/decap-cms/issues/5472)

[^76]: Netlify/Decap CMS [#4738](https://github.com/decaporg/decap-cms/issues/4738)

[^77]: Netlify/Decap CMS [#2009](https://github.com/decaporg/decap-cms/issues/2009), [#2293](https://github.com/decaporg/decap-cms/issues/2293), [#3415](https://github.com/decaporg/decap-cms/issues/3415), [#3952](https://github.com/decaporg/decap-cms/issues/3952), [#6563](https://github.com/decaporg/decap-cms/issues/6563)

[^78]: Netlify/Decap CMS [#2294](https://github.com/decaporg/decap-cms/issues/2294), [#3046](https://github.com/decaporg/decap-cms/issues/3046), [#4363](https://github.com/decaporg/decap-cms/issues/4363), [#4520](https://github.com/decaporg/decap-cms/issues/4520), [#5806](https://github.com/decaporg/decap-cms/issues/5806)

[^79]: Netlify/Decap CMS [#5726](https://github.com/decaporg/decap-cms/issues/5726)

[^80]: Netlify/Decap CMS [#5493](https://github.com/decaporg/decap-cms/issues/5493), [#6600](https://github.com/decaporg/decap-cms/issues/6600)

[^81]: Netlify/Decap CMS [#4645](https://github.com/decaporg/decap-cms/issues/4645)

[^82]: Netlify/Decap CMS [#6500](https://github.com/decaporg/decap-cms/issues/6500)

[^83]: Netlify/Decap CMS [#6508](https://github.com/decaporg/decap-cms/issues/6508)

[^84]: Netlify/Decap CMS [#7142](https://github.com/decaporg/decap-cms/issues/7142), [#7276](https://github.com/decaporg/decap-cms/issues/7276)

[^85]: Netlify/Decap CMS [#5055](https://github.com/decaporg/decap-cms/issues/5055), [#5470](https://github.com/decaporg/decap-cms/issues/5470), [#6989](https://github.com/decaporg/decap-cms/issues/6989)

[^86]: Netlify/Decap CMS [#1609](https://github.com/decaporg/decap-cms/issues/1609), [#3557](https://github.com/decaporg/decap-cms/issues/3557), [#5253](https://github.com/decaporg/decap-cms/issues/5253), [#6759](https://github.com/decaporg/decap-cms/issues/6759), [#6901](https://github.com/decaporg/decap-cms/issues/6901)

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

[^104]: Netlify/Decap CMS [#450](https://github.com/decaporg/decap-cms/issues/450), [#2122](https://github.com/decaporg/decap-cms/issues/2122), [#6819](https://github.com/decaporg/decap-cms/issues/6819)

[^105]: Netlify/Decap CMS [#5701](https://github.com/decaporg/decap-cms/issues/5701)

[^106]: Netlify/Decap CMS [#2822](https://github.com/decaporg/decap-cms/issues/2822)

[^107]: Netlify/Decap CMS [#332](https://github.com/decaporg/decap-cms/issues/332), [#683](https://github.com/decaporg/decap-cms/issues/683), [#999](https://github.com/decaporg/decap-cms/issues/999), [#1456](https://github.com/decaporg/decap-cms/issues/1456), [#4175](https://github.com/decaporg/decap-cms/issues/4175), [#4818](https://github.com/decaporg/decap-cms/issues/4818), [#5688](https://github.com/decaporg/decap-cms/issues/5688), [#6828](https://github.com/decaporg/decap-cms/issues/6828), [#6829](https://github.com/decaporg/decap-cms/issues/6829), [#6862](https://github.com/decaporg/decap-cms/issues/6862), [#7023](https://github.com/decaporg/decap-cms/issues/7023)

[^108]: Netlify/Decap CMS [#6879](https://github.com/decaporg/decap-cms/discussions/6879)

[^109]: Netlify/Decap CMS [#7197](https://github.com/decaporg/decap-cms/issues/7197)

[^110]: Netlify/Decap CMS [#4637](https://github.com/decaporg/decap-cms/issues/4637), [#5198](https://github.com/decaporg/decap-cms/issues/5198)

[^111]: Netlify/Decap CMS [#7190](https://github.com/decaporg/decap-cms/issues/7190), [#7218](https://github.com/decaporg/decap-cms/issues/7218), [#7392](https://github.com/decaporg/decap-cms/issues/7392)

[^112]: Netlify/Decap CMS [#5815](https://github.com/decaporg/decap-cms/issues/5815), [#6522](https://github.com/decaporg/decap-cms/issues/6522), [#6532](https://github.com/decaporg/decap-cms/issues/6532), [#6588](https://github.com/decaporg/decap-cms/issues/6588), [#6617](https://github.com/decaporg/decap-cms/issues/6617), [#6640](https://github.com/decaporg/decap-cms/issues/6640), [#6663](https://github.com/decaporg/decap-cms/issues/6663), [#6695](https://github.com/decaporg/decap-cms/issues/6695), [#6697](https://github.com/decaporg/decap-cms/issues/6697), [#6764](https://github.com/decaporg/decap-cms/issues/6764), [#6765](https://github.com/decaporg/decap-cms/issues/6765), [#6835](https://github.com/decaporg/decap-cms/issues/6835), [#6983](https://github.com/decaporg/decap-cms/issues/6983), [#7205](https://github.com/decaporg/decap-cms/issues/7205), [#7450](https://github.com/decaporg/decap-cms/issues/7450), [#7453](https://github.com/decaporg/decap-cms/issues/7453)

[^113]: Netlify/Decap CMS [#5656](https://github.com/decaporg/decap-cms/issues/5656), [#5837](https://github.com/decaporg/decap-cms/issues/5837), [#5972](https://github.com/decaporg/decap-cms/issues/5972), [#6476](https://github.com/decaporg/decap-cms/issues/6476), [#6516](https://github.com/decaporg/decap-cms/issues/6516), [#6930](https://github.com/decaporg/decap-cms/issues/6930), [#6965](https://github.com/decaporg/decap-cms/issues/6965), [#7080](https://github.com/decaporg/decap-cms/issues/7080), [#7105](https://github.com/decaporg/decap-cms/issues/7105), [#7106](https://github.com/decaporg/decap-cms/issues/7106), [#7119](https://github.com/decaporg/decap-cms/issues/7119), [#7176](https://github.com/decaporg/decap-cms/issues/7176), [#7194](https://github.com/decaporg/decap-cms/issues/7194), [#7244](https://github.com/decaporg/decap-cms/issues/7244), [#7278](https://github.com/decaporg/decap-cms/issues/7278), [#7301](https://github.com/decaporg/decap-cms/issues/7301), [#7342](https://github.com/decaporg/decap-cms/issues/7342), [#7348](https://github.com/decaporg/decap-cms/issues/7348), [#7354](https://github.com/decaporg/decap-cms/issues/7354), [#7376](https://github.com/decaporg/decap-cms/issues/7376), [#7408](https://github.com/decaporg/decap-cms/issues/7408), [#7412](https://github.com/decaporg/decap-cms/issues/7412), [#7413](https://github.com/decaporg/decap-cms/issues/7413), [#7422](https://github.com/decaporg/decap-cms/issues/7422), [#7427](https://github.com/decaporg/decap-cms/issues/7427), [#7434](https://github.com/decaporg/decap-cms/issues/7434), [#7438](https://github.com/decaporg/decap-cms/issues/7438), [#7454](https://github.com/decaporg/decap-cms/issues/7454), [#7464](https://github.com/decaporg/decap-cms/issues/7464), [#7471](https://github.com/decaporg/decap-cms/issues/7471), [#7485](https://github.com/decaporg/decap-cms/issues/7485) — These `removeChild` crashes are common in React apps, likely caused by a [browser extension](https://github.com/facebook/react/issues/17256) or [Google Translate](https://github.com/facebook/react/issues/11538).

[^114]: Netlify/Decap CMS [#5029](https://github.com/decaporg/decap-cms/issues/5029), [#5048](https://github.com/decaporg/decap-cms/issues/5048)

[^115]: Netlify/Decap CMS [#7172](https://github.com/decaporg/decap-cms/issues/7172)

[^116]: Netlify/Decap CMS [#3431](https://github.com/decaporg/decap-cms/issues/3431)

[^117]: Netlify/Decap CMS [#3562](https://github.com/decaporg/decap-cms/issues/3562), [#6215](https://github.com/decaporg/decap-cms/issues/6215), [#7479](https://github.com/decaporg/decap-cms/issues/7479)

[^118]: Netlify/Decap CMS [#7267](https://github.com/decaporg/decap-cms/issues/7267)

[^119]: Netlify/Decap CMS [#5640](https://github.com/decaporg/decap-cms/issues/5640), [#6444](https://github.com/decaporg/decap-cms/issues/6444)

[^120]: Netlify/Decap CMS [#2727](https://github.com/decaporg/decap-cms/issues/2727), [#4884](https://github.com/decaporg/decap-cms/issues/4884)

[^121]: Netlify/Decap CMS [#7262](https://github.com/decaporg/decap-cms/issues/7262)

[^122]: Netlify/Decap CMS [#1776](https://github.com/decaporg/decap-cms/issues/1776), [#2064](https://github.com/decaporg/decap-cms/issues/2064), [#7158](https://github.com/decaporg/decap-cms/issues/7158), [#7259](https://github.com/decaporg/decap-cms/issues/7259)

[^123]: Netlify/Decap CMS [#961](https://github.com/decaporg/decap-cms/issues/961), [#5489](https://github.com/decaporg/decap-cms/issues/5489)

[^124]: Netlify/Decap CMS [#991](https://github.com/decaporg/decap-cms/issues/991), [#4488](https://github.com/decaporg/decap-cms/issues/4488), [#7233](https://github.com/decaporg/decap-cms/issues/7233)

[^125]: Netlify/Decap CMS [#475](https://github.com/decaporg/decap-cms/issues/475), [#5469](https://github.com/decaporg/decap-cms/issues/5469)

[^126]: Netlify/Decap CMS [#7279](https://github.com/decaporg/decap-cms/discussions/7279)

[^127]: Netlify/Decap CMS [#2289](https://github.com/decaporg/decap-cms/issues/2289), [#4518](https://github.com/decaporg/decap-cms/issues/4518)

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

[^148]: Netlify/Decap CMS [#531](https://github.com/decaporg/decap-cms/issues/531), [#621](https://github.com/decaporg/decap-cms/issues/621), [#1282](https://github.com/decaporg/decap-cms/issues/1282), [#1877](https://github.com/decaporg/decap-cms/issues/1877), [#2514](https://github.com/decaporg/decap-cms/issues/2514), [#2737](https://github.com/decaporg/decap-cms/issues/2737)

[^149]: Netlify/Decap CMS [#13](https://github.com/decaporg/decap-cms/issues/13) — The issue appears to have been closed without a fix being available.

[^150]: Netlify/Decap CMS [#7319](https://github.com/decaporg/decap-cms/issues/7319)

[^151]: Netlify/Decap CMS [#7328](https://github.com/decaporg/decap-cms/issues/7328)

[^152]: Netlify/Decap CMS [#2491](https://github.com/decaporg/decap-cms/issues/2491)

[^153]: Netlify/Decap CMS [#7347](https://github.com/decaporg/decap-cms/issues/7347)

[^154]: Netlify/Decap CMS [#1449](https://github.com/decaporg/decap-cms/issues/1449), [#1988](https://github.com/decaporg/decap-cms/issues/1988)

[^155]: Netlify/Decap CMS [#5870](https://github.com/decaporg/decap-cms/issues/5870)

[^156]: Netlify/Decap CMS [#995](https://github.com/decaporg/decap-cms/issues/995), [#2017](https://github.com/decaporg/decap-cms/issues/2017), [#7120](https://github.com/decaporg/decap-cms/issues/7120), [#7186](https://github.com/decaporg/decap-cms/issues/7186)

[^157]: Netlify/Decap CMS [#2007](https://github.com/decaporg/decap-cms/issues/2007), [#2848](https://github.com/decaporg/decap-cms/issues/2848)

[^158]: Netlify/Decap CMS [#6107](https://github.com/decaporg/decap-cms/issues/6107)

[^159]: Netlify/Decap CMS [#3796](https://github.com/decaporg/decap-cms/issues/3796)

[^160]: Netlify/Decap CMS [#3291](https://github.com/decaporg/decap-cms/issues/3291)

[^161]: Netlify/Decap CMS [#1274](https://github.com/decaporg/decap-cms/issues/1274)

[^162]: Netlify/Decap CMS [#2380](https://github.com/decaporg/decap-cms/issues/2380)

[^163]: Netlify/Decap CMS [#7322](https://github.com/decaporg/decap-cms/issues/7322)

[^164]: Netlify/Decap CMS [#756](https://github.com/decaporg/decap-cms/issues/756) — The Expand All and Collapse All buttons cannot be found in the current version of Decap CMS.

[^165]: Netlify/Decap CMS [#7143](https://github.com/decaporg/decap-cms/issues/7143)

[^166]: Netlify/Decap CMS [#277](https://github.com/decaporg/decap-cms/issues/277)

[^167]: Netlify/Decap CMS [#263](https://github.com/decaporg/decap-cms/issues/263)

[^168]: Netlify/Decap CMS [#1948](https://github.com/decaporg/decap-cms/issues/1948)

[^169]: Netlify/Decap CMS [#7364](https://github.com/decaporg/decap-cms/issues/7364)

[^170]: Netlify/Decap CMS [#7371](https://github.com/decaporg/decap-cms/issues/7371)

[^171]: Netlify/Decap CMS [#4754](https://github.com/decaporg/decap-cms/issues/4754)

[^172]: Netlify/Decap CMS [#3715](https://github.com/decaporg/decap-cms/issues/3715)

[^173]: Netlify/Decap CMS [#5317](https://github.com/decaporg/decap-cms/issues/5317)

[^174]: Netlify/Decap CMS [#6616](https://github.com/decaporg/decap-cms/issues/6616)

[^175]: Netlify/Decap CMS [#5376](https://github.com/decaporg/decap-cms/issues/5376), [#7203](https://github.com/decaporg/decap-cms/issues/7203), [#7380](https://github.com/decaporg/decap-cms/issues/7380)

[^176]: Netlify/Decap CMS [#6427](https://github.com/decaporg/decap-cms/issues/6427)

[^177]: Netlify/Decap CMS [#2673](https://github.com/decaporg/decap-cms/issues/2673), [#5315](https://github.com/decaporg/decap-cms/issues/5315), [#6499](https://github.com/decaporg/decap-cms/issues/6499), [#6544](https://github.com/decaporg/decap-cms/issues/6544), [#6551](https://github.com/decaporg/decap-cms/issues/6551), [#6679](https://github.com/decaporg/decap-cms/issues/6679), [#6773](https://github.com/decaporg/decap-cms/issues/6773), [#6883](https://github.com/decaporg/decap-cms/issues/6883), [#7363](https://github.com/decaporg/decap-cms/discussions/7363), [#7365](https://github.com/decaporg/decap-cms/issues/7365) — This problem occurs every time a new major version of React is released.

[^178]: Netlify/Decap CMS [#2536](https://github.com/decaporg/decap-cms/issues/2536)

[^179]: Netlify/Decap CMS [#1891](https://github.com/decaporg/decap-cms/issues/1891)

[^180]: Netlify/Decap CMS [#7399](https://github.com/decaporg/decap-cms/issues/7399)

[^181]: Netlify/Decap CMS [#6254](https://github.com/decaporg/decap-cms/issues/6254)

[^182]: Netlify/Decap CMS [#4416](https://github.com/decaporg/decap-cms/issues/4416), [#7400](https://github.com/decaporg/decap-cms/pull/7400)

[^183]: Netlify/Decap CMS [#1275](https://github.com/decaporg/decap-cms/issues/1275)

[^184]: Netlify/Decap CMS [#377](https://github.com/decaporg/decap-cms/issues/377)

[^185]: Netlify/Decap CMS [#6203](https://github.com/decaporg/decap-cms/issues/6203), [#7417](https://github.com/decaporg/decap-cms/issues/7417)

[^186]: Netlify/Decap CMS [#2368](https://github.com/decaporg/decap-cms/issues/2368), [#3454](https://github.com/decaporg/decap-cms/issues/3454), [#3585](https://github.com/decaporg/decap-cms/issues/3585), [#3651](https://github.com/decaporg/decap-cms/issues/3651), [#3885](https://github.com/decaporg/decap-cms/issues/3885), [#3962](https://github.com/decaporg/decap-cms/issues/3962), [#4037](https://github.com/decaporg/decap-cms/issues/4037), [#4143](https://github.com/decaporg/decap-cms/issues/4143), [#6585](https://github.com/decaporg/decap-cms/issues/6585), [#6664](https://github.com/decaporg/decap-cms/issues/6664), [#6665](https://github.com/decaporg/decap-cms/issues/6665), [#6739](https://github.com/decaporg/decap-cms/issues/6739), [#7243](https://github.com/decaporg/decap-cms/issues/7243), [#7379](https://github.com/decaporg/decap-cms/issues/7379), [#7469](https://github.com/decaporg/decap-cms/issues/7469)

[^187]: Netlify/Decap CMS [#1244](https://github.com/decaporg/decap-cms/issues/1244)

[^188]: Netlify/Decap CMS [#7415](https://github.com/decaporg/decap-cms/issues/7415), [#7421](https://github.com/decaporg/decap-cms/issues/7421)

[^189]: Netlify/Decap CMS [#7431](https://github.com/decaporg/decap-cms/issues/7431)

[^190]: Netlify/Decap CMS [#4987](https://github.com/decaporg/decap-cms/issues/4987)

[^191]: Netlify/Decap CMS [#5970](https://github.com/decaporg/decap-cms/issues/5970)

[^192]: Netlify/Decap CMS [#6527](https://github.com/decaporg/decap-cms/issues/6527)

[^193]: Netlify/Decap CMS [#6800](https://github.com/decaporg/decap-cms/issues/6800)

[^194]: Netlify/Decap CMS [#7157](https://github.com/decaporg/decap-cms/issues/7157)

[^195]: Netlify/Decap CMS [#5901](https://github.com/decaporg/decap-cms/issues/5901)

[^196]: Netlify/Decap CMS [#3057](https://github.com/decaporg/decap-cms/issues/3057), [#3260](https://github.com/decaporg/decap-cms/issues/3260) — We use Svelte though.

[^197]: Netlify/Decap CMS [#3457](https://github.com/decaporg/decap-cms/issues/3457), [#3624](https://github.com/decaporg/decap-cms/issues/3624)

[^198]: Netlify/Decap CMS [#7442](https://github.com/decaporg/decap-cms/issues/7442)

[^199]: Netlify/Decap CMS [#5419](https://github.com/decaporg/decap-cms/issues/5419), [#7107](https://github.com/decaporg/decap-cms/issues/7107)

[^200]: Netlify/Decap CMS [#1322](https://github.com/decaporg/decap-cms/issues/1322), [#6442](https://github.com/decaporg/decap-cms/issues/6442)

[^201]: Netlify/Decap CMS [#7381](https://github.com/decaporg/decap-cms/issues/7381)

[^202]: Netlify/Decap CMS [#7458](https://github.com/decaporg/decap-cms/issues/7458)

[^203]: Netlify/Decap CMS [#7360](https://github.com/decaporg/decap-cms/issues/7360), [#7462](https://github.com/decaporg/decap-cms/issues/7462)

[^204]: Netlify/Decap CMS [#7240](https://github.com/decaporg/decap-cms/issues/7240), [#7428](https://github.com/decaporg/decap-cms/issues/7428)

[^205]: Netlify/Decap CMS [#3257](https://github.com/decaporg/decap-cms/issues/3257)

[^206]: Netlify/Decap CMS [#3258](https://github.com/decaporg/decap-cms/issues/3258)

[^207]: Netlify/Decap CMS [#3259](https://github.com/decaporg/decap-cms/issues/3259)

[^208]: Netlify/Decap CMS [#3261](https://github.com/decaporg/decap-cms/issues/3261)

[^209]: Netlify/Decap CMS [#3262](https://github.com/decaporg/decap-cms/issues/3262)

[^210]: Netlify/Decap CMS [#3296](https://github.com/decaporg/decap-cms/issues/3296)

[^211]: Netlify/Decap CMS [#3263](https://github.com/decaporg/decap-cms/issues/3263)

[^212]: Netlify/Decap CMS [#3264](https://github.com/decaporg/decap-cms/issues/3264)

[^213]: Netlify/Decap CMS [#3265](https://github.com/decaporg/decap-cms/issues/3265)

[^214]: Netlify/Decap CMS [#3266](https://github.com/decaporg/decap-cms/issues/3266)

[^215]: Netlify/Decap CMS [#7241](https://github.com/decaporg/decap-cms/issues/7241)

[^216]: Netlify/Decap CMS [#1345](https://github.com/decaporg/decap-cms/issues/1345)

[^217]: Netlify/Decap CMS [#5467](https://github.com/decaporg/decap-cms/issues/5467)

[^218]: Netlify/Decap CMS [#978](https://github.com/decaporg/decap-cms/issues/978)

[^219]: Netlify/Decap CMS [#3018](https://github.com/decaporg/decap-cms/issues/3018)

[^220]: Netlify/Decap CMS [#2153](https://github.com/decaporg/decap-cms/issues/2153)

[^221]: Netlify/Decap CMS [#3421](https://github.com/decaporg/decap-cms/issues/3421)

[^222]: Netlify/Decap CMS [#7281](https://github.com/decaporg/decap-cms/issues/7281) — The issue was closed, but the attached PR is not yet merged.

[^223]: Netlify/Decap CMS [#7483](https://github.com/decaporg/decap-cms/issues/7483)

[^224]: Netlify/Decap CMS [#7352](https://github.com/decaporg/decap-cms/issues/7352)

[^225]: Netlify/Decap CMS [#7401](https://github.com/decaporg/decap-cms/issues/7401)

[^226]: Netlify/Decap CMS [#7031](https://github.com/decaporg/decap-cms/pull/7031)
