# Sveltia CMS: Netlify/Decap CMS successor

Sveltia CMS is a Git-based lightweight headless CMS under active development as a modern, powerful, direct replacement for Netlify CMS (now Decap CMS). We have picked up where they left off and have already solved over 280 issues reported in the predecessor’s repository, ranging from critical bugs to top feature requests.

Built from the ground up, Sveltia CMS offers excellent UX, DX, performance, security and internationalization (i18n) support. Although some features are still missing, our numerous enhancements across the board ensure smooth daily workflows for content editors and developers alike.

This free, open source successor to Netlify/Decap CMS is currently in public beta, with version 1.0 expected in early 2026. Despite the beta status, it’s already used by hundreds of individuals and organizations worldwide in production. Check out the [Showcase](https://sveltiacms.app/en/showcase) page for some examples.

![Sveltia CMS: Fast, Git-based, Headless, Modern UX, Mobile Support, I18n Support, Open Source](https://repository-images.githubusercontent.com/610335145/6c246dd0-f7e9-4201-a1ee-ffcd58191403)

<!-- prettier-ignore-start -->
> [!NOTE]
> We are in the process of migrating the README content to the [new documentation site](https://sveltiacms.app/en/), which is still a work in progress. Please note that some of the information may be inaccurate or incomplete. Thank you for your patience during this transition.
<!-- prettier-ignore-end -->

## Motivation

See the [Successor to Netlify CMS](https://sveltiacms.app/en/docs/successor-to-netlify-cms) page for the full story behind Sveltia CMS.

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

## Getting Started

See the [Getting Started](https://sveltiacms.app/en/docs/start) page for step-by-step instructions on how to set up Sveltia CMS with your project.

Migrating from Netlify CMS or Decap CMS? Check out the [Netlify/Decap CMS Migration](https://sveltiacms.app/en/docs/migration/netlify-decap-cms) page for detailed guidance.

Migrating from Static CMS? See the [Static CMS Migration](https://sveltiacms.app/en/docs/migration/static-cms) page for the compatibility details.

## Resources

- [Support](https://sveltiacms.app/en/support)
- [Feedback](https://sveltiacms.app/en/feedback)
- [Roadmap](https://sveltiacms.app/en/roadmap)
- [Contribute](https://github.com/sveltia/sveltia-cms/blob/main/CONTRIBUTING.md)

## Tips & Tricks

#### Enabling local development in Brave

See the [Local Workflow](https://sveltiacms.app/en/docs/workflows/local#requirements) page.

#### Using a custom icon for a collection

See the [Collections](https://sveltiacms.app/en/docs/collections#icons) page.

#### Using a custom media folder for a collection

See the [Internal Media Storage](https://sveltiacms.app/en/docs/media/internal#collection-level-configuration) page.

#### Specifying default sort field and direction

See the [Entry Collections](https://sveltiacms.app/en/docs/collections/entries#sorting) page.

#### Including Hugo’s special index file in a folder collection

See the [Entry Collections](https://sveltiacms.app/en/docs/collections/entries#managing-hugo-s-special-index-file) page.

#### Using singletons

See the [Singletons](https://sveltiacms.app/en/docs/collections/singletons) page.

#### Localizing entry slugs

See the [Internationalization](https://sveltiacms.app/en/docs/i18n#localizing-entry-slugs) page.

#### Disabling non-default locale content

See the [Internationalization](https://sveltiacms.app/en/docs/i18n#disabling-non-default-locale-content) page.

#### Using a random ID for an entry slug

See the [Entry Collections](https://sveltiacms.app/en/docs/collections/entries#slug-template-tags) page.

#### Configuring multiple media libraries

See the [Media Storage](https://sveltiacms.app/en/docs/media#configuration) page.

#### Optimizing images for upload

See the [Internal Media Storage](https://sveltiacms.app/en/docs/media/internal#image-optimization) page.

#### Editing site deployment configuration files

See the [How-Tos](https://sveltiacms.app/en/docs/how-tos#editing-site-deployment-configuration-files) page.

#### Editing data files with a top-level list

See the [List Field](https://sveltiacms.app/en/docs/fields/list#top-level-list) page.

#### Controlling data output

See the [Data Output](https://sveltiacms.app/en/docs/data-output#controlling-data-output) page.

#### Disabling automatic deployments

See the [Deployments](https://sveltiacms.app/en/docs/deployments#disabling-automatic-deployments) page.
