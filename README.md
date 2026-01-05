# Sveltia CMS: Netlify/Decap CMS successor

Sveltia CMS is a Git-based lightweight headless CMS under active development as a modern, powerful, direct replacement for Netlify CMS (now Decap CMS). We have picked up where they left off and have already solved over 280 issues reported in the predecessor’s repository, ranging from critical bugs to top feature requests.

Built from the ground up, Sveltia CMS offers excellent UX, DX, performance, security and internationalization (i18n) support. Although some features are still missing, our numerous enhancements across the board ensure smooth daily workflows for content editors and developers alike.

This free, open source successor to Netlify/Decap CMS is currently in public beta, with version 1.0 expected in early 2026. Despite the beta status, it’s already used by hundreds of individuals and organizations worldwide in production. Check out the [Showcase](https://sveltiacms.app/en/showcase) page for some examples.

<!-- prettier-ignore-start -->
> [!NOTE]
> We are in the process of migrating the README content to the [new documentation site](https://sveltiacms.app/en/), which is still a work in progress. Please note that some of the information may be inaccurate or incomplete. Thank you for your patience during this transition.
<!-- prettier-ignore-end -->

![Git-based headless CMS made right](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-1.webp?20250405)<br>

![Fast and lightweight; modern UX/UI with dark mode](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-2.webp?20250405)<br>

![Stock photo integration: Pexels, Pixabay, Unsplash](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-3.webp?20250405)<br>

![Full-fledged Asset Library; first-class internationalization support; Google Cloud Translation, Anthropic and OpenAI integration](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-4.webp?20250831)<br>

![Built-in image optimizer for WebP and SVG; mobile & tablet support](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-5.webp?20250409)<br>

![Streamlined local and remote workflow; GitHub, GitLab, Gitea & Forgejo support; single-line migration from Netlify/Decap CMS (depending on your current setup); Sveltia CMS](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-6.webp?20250712)<br>

## Table of contents

- [Motivation](#motivation)
- [Project Status](#project-status)
- [Differentiators](#differentiators)
- [Compatibility](#compatibility)
- [Getting Started](#getting-started)
- [Tips \& Tricks](#tips--tricks)
- [Support \& Feedback](#support--feedback)
- [Contributions](#contributions)
- [Roadmap](#roadmap)
- [Related Links](#related-links)
- [Privacy](#privacy)
- [Disclaimer](#disclaimer)
- [Acknowledgements](#acknowledgements)

## Motivation

See the [Successor to Netlify CMS](https://sveltiacms.app/en/docs/successor-to-netlify-cms#motivation) page.

## Project Status

Sveltia CMS is currently in **beta**, with version 1.0 (GA) scheduled for release in early 2026. Check our [release notes](https://github.com/sveltia/sveltia-cms/releases) and follow us on [Bluesky](https://bsky.app/profile/sveltiacms.app) for updates. See also our [roadmap](https://sveltiacms.app/en/roadmap).

While we fix reported bugs as quickly as possible, usually within 24 hours, our overall progress may be slower than you think. The thing is, it’s not just a personal project of [@kyoshino](https://github.com/kyoshino), but also a complicated system involving various kinds of activities that require considerable effort:

- Ensuring high [compatibility with Netlify/Decap CMS](https://sveltiacms.app/en/docs/migration/netlify-decap-cms#compatibility)
  - The vast majority of existing configurations work out of the box
  - It works as a drop-in replacement for most use cases
  - Some missing features will be implemented before or shortly after GA
- Tackling as many [Netlify/Decap CMS issues](https://github.com/decaporg/decap-cms/issues) as possible
  - So far, **280+ issues, or 610+ if including duplicates, have been effectively solved** in Sveltia CMS (Yes, you read it right)
  - Target:
    - 300 issues, or 600 if including duplicates, by GA — Almost there! 🚀
    - 450 issues, or 900 if including duplicates, in the future 💪
    - or every single issue that’s relevant, fixable, and worth dealing with 🔥
  - Issues include everything:
    - Outstanding issues from feature requests to bug reports
    - [Issues closed as stale](https://github.com/decaporg/decap-cms/issues?q=is%3Aissue+%22Closing+as+stale%22) or without an optimal solution
    - [Discussions](https://github.com/decaporg/decap-cms/discussions)
    - Stalled [pull requests](https://github.com/decaporg/decap-cms/pulls)
  - Many of the bugs, including the annoying crashes, have already been solved
    - The remaining bugs are mostly related to [unimplemented features](https://sveltiacms.app/en/docs/migration/netlify-decap-cms#current-limitations)
  - Many of their [top-voted features](https://github.com/decaporg/decap-cms/issues?q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc) are [on our table](https://sveltiacms.app/en/roadmap) or already implemented in Sveltia CMS
- Solving [our own issues](https://github.com/sveltia/sveltia-cms/issues)
- Preparing top-notch [documentation](https://github.com/sveltia/sveltia-cms/issues/485)
- Implementing our own enhancement ideas for every part of the product

![280 Netlify/Decap CMS issues solved in Sveltia CMS](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/headline-1.webp?20251228)<br>

## Differentiators

See the [Successor to Netlify CMS](https://sveltiacms.app/en/docs/successor-to-netlify-cms#improvements-over-netlify-decap-cms) page.

## Compatibility

See the [Migrating from Netlify CMS or Decap CMS](https://sveltiacms.app/en/docs/migration/netlify-decap-cms#compatibility) page.

### Deprecations

See the [Migrating from Earlier Versions of Sveltia CMS](https://sveltiacms.app/en/docs/migration/earlier-versions#deprecations) page.

### Compatibility with Static CMS

See the [Migrating from Static CMS](https://sveltiacms.app/en/docs/migration/static-cms#compatibility) page.

## Getting Started

### Installation & setup

See the [Getting Started](https://sveltiacms.app/en/docs/start) page.

### Migration

See the [Migrating from Netlify CMS or Decap CMS](https://sveltiacms.app/en/docs/migration/netlify-decap-cms) page.

## Tips & Tricks

<!--
### Moving your site from Netlify to another hosting service

You can host your Sveltia CMS-managed site anywhere, such as [Cloudflare Pages](https://pages.cloudflare.com/) or [GitHub Pages](https://pages.github.com/). But moving away from Netlify means you can no longer sign in with GitHub or GitLab via Netlify. Instead, you can use [our own OAuth client](https://github.com/sveltia/sveltia-cms-auth), which can be easily deployed to Cloudflare Workers, or [any other 3rd party client](https://decapcms.org/docs/external-oauth-clients/) made for Netlify/Decap CMS.

You can also generate a personal access token (PAT) on GitHub or GitLab, and use it to sign in. No OAuth client is needed. While this method is convenient for developers, it’s better to set up an OAuth client if your CMS instance is used by non-technical users because it’s more user-friendly and secure.
-->

### Enabling autocomplete and validation for the configuration file

See the [Configuration Basics](https://sveltiacms.app/en/docs/config-basics#json-schema) page.

### Providing a JSON configuration file

See the [Configuration Basics](https://sveltiacms.app/en/docs/config-basics#toml-or-json-configuration-file) page.

### Providing a TOML configuration file

See the [Configuration Basics](https://sveltiacms.app/en/docs/config-basics#toml-or-json-configuration-file) page.

### Providing multiple configuration files

See the [Configuration Basics](https://sveltiacms.app/en/docs/config-basics#multiple-configuration-files) page.

### Working around an authentication error

See the [Troubleshooting](https://sveltiacms.app/en/docs/troubleshooting#working-around-an-authentication-error) page.

### Working with a local Git repository

See the [Local Workflow](https://sveltiacms.app/en/docs/workflows/local) page.

### Enabling local development in Brave

See the [Local Workflow](https://sveltiacms.app/en/docs/workflows/local#requirements) page.

### Using a custom icon for a collection

See the [Collections](https://sveltiacms.app/en/docs/collections#icons) page.

### Adding dividers to the collection list

See the [Collections](https://sveltiacms.app/en/docs/collections#dividers) page.

### Using a custom media folder for a collection

See the [Internal Media Storage](https://sveltiacms.app/en/docs/media/internal#collection-level-configuration) page.

### Specifying default sort field and direction

See the [Entry Collections](https://sveltiacms.app/en/docs/collections/entries#sorting) page.

### Including Hugo’s special index file in a folder collection

See the [Entry Collections](https://sveltiacms.app/en/docs/collections/entries#managing-hugo-s-special-index-file) page.

### Using singletons

See the [Singletons](https://sveltiacms.app/en/docs/collections/singletons) page.

### Using keyboard shortcuts

See the [User Interface Overview](https://sveltiacms.app/en/docs/ui#keyboard-shortcuts) and [Content Editor](https://sveltiacms.app/en/docs/ui/content-editor#keyboard-shortcuts) pages.

### Controlling entry file paths

See the [Entry Collections](https://sveltiacms.app/en/docs/collections/entries#constructing-entry-file-paths) page.

### Translating entry fields with one click

See the [Translation Services](https://sveltiacms.app/en/docs/integrations/translations) page.

### Localizing entry slugs

See the [Internationalization](https://sveltiacms.app/en/docs/i18n#localizing-entry-slugs) page.

### Disabling non-default locale content

See the [Internationalization](https://sveltiacms.app/en/docs/i18n#disabling-non-default-locale-content) page.

### Using a random ID for an entry slug

See the [Entry Collections](https://sveltiacms.app/en/docs/collections/entries#slug-template-tags) page.

### Configuring multiple media libraries

See the [Media Storage](https://sveltiacms.app/en/docs/media#configuration) page.

### Optimizing images for upload

See the [Internal Media Storage](https://sveltiacms.app/en/docs/media/internal#image-optimization) page.

### Disabling stock assets

See the [Stock Photos](https://sveltiacms.app/en/docs/integrations/stock-photos#configuration) page.

### Using entry tags for categorization

See the [How-Tos](https://sveltiacms.app/en/docs/how-tos#using-entry-tags-for-categorization) page.

### Editing site deployment configuration files

See the [How-Tos](https://sveltiacms.app/en/docs/how-tos#editing-site-deployment-configuration-files) page.

### Editing data files with a top-level list

See the [List Field](https://sveltiacms.app/en/docs/fields/list#top-level-lists) page.

### Changing the input type of a DateTime field

See the [DateTime Field](https://sveltiacms.app/en/docs/fields/datetime#examples) page.

### Rendering soft line breaks as hard line breaks in Markdown

See the [How-Tos](https://sveltiacms.app/en/docs/how-tos#rendering-soft-line-breaks-as-hard-line-breaks-in-markdown) page.

### Controlling data output

See the [Data Output](https://sveltiacms.app/en/docs/data-output#controlling-data-output) page.

### Understanding exceptions in data output

See the [Data Output](https://sveltiacms.app/en/docs/data-output#understanding-exceptions) page.

### Disabling automatic deployments

See the [Deployments](https://sveltiacms.app/en/docs/deployments#disabling-automatic-deployments) page.

### Setting up Content Security Policy

See the [Security](https://sveltiacms.app/en/docs/security#setting-up-content-security-policy) page.

### Showing the CMS version

See the [Updates](https://sveltiacms.app/en/docs/updates#checking-your-current-version) page.

## Support & Feedback

See the [Support](https://sveltiacms.app/en/support) and [Feedback](https://sveltiacms.app/en/feedback) pages.

## Contributions

See [Contributing to Sveltia CMS](https://github.com/sveltia/sveltia-cms/blob/main/CONTRIBUTING.md). Bug reports are highly encouraged.

## Roadmap

See the [Roadmap](https://sveltiacms.app/en/roadmap) page.

## Related Links

- Introducing Sveltia CMS: a short technical presentation by [@kyoshino](https://github.com/kyoshino) during the _This Week in Svelte_ online meetup on March 31, 2023 — [recording](https://youtu.be/-YjLubiieYs?t=1660) & [slides](https://docs.google.com/presentation/d/1Wi4ty-1AwOp2-zy7LctmzCV4rrdYPfke9NGhO0DdRdM)

### As seen on

- [LogRocket Blog – 9 best Git-based CMS platforms for your next project](https://blog.logrocket.com/9-best-git-based-cms-platforms/)
- [Jamstack – Headless CMS](https://jamstack.org/headless-cms/)
- [Hugo – Front-end interfaces](https://gohugo.io/tools/front-ends/)
- [Made with Svelte](https://madewithsvelte.com/sveltia-cms)

## Privacy

See the [Privacy](https://sveltiacms.app/en/docs/privacy) page.

## Disclaimer

This software is provided “as is” without any express or implied warranty. We are not obligated to provide any support for the application. This product is not affiliated with or endorsed by Netlify, Decap CMS or any other integrated services. All product names, logos, and brands are the property of their respective owners.

## Acknowledgements

This project would not have been possible without the open source Netlify CMS project. We are grateful to the maintainers for their hard work over the years. We would also like to thank the Sveltia CMS user community for their valuable feedback and ongoing support, which has helped us to identify issues and improve the product.
