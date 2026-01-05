# Sveltia CMS: Netlify/Decap CMS successor

Sveltia CMS is a Git-based lightweight headless CMS under active development as a modern, powerful, direct replacement for Netlify CMS (now Decap CMS). We have picked up where they left off and have already solved over 280 issues reported in the predecessor’s repository, ranging from critical bugs to top feature requests.

Built from the ground up, Sveltia CMS offers excellent UX, DX, performance, security and internationalization (i18n) support. Although some features are still missing, our numerous enhancements across the board ensure smooth daily workflows for content editors and developers alike.

This free, open source successor to Netlify/Decap CMS is currently in public beta, with version 1.0 expected in early 2026. Despite the beta status, it’s already used by hundreds of individuals and organizations worldwide in production. Check out the [Showcase](https://sveltiacms.app/en/showcase) page for some examples.

![Git-based headless CMS made right](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-1.webp?20250405)<br>

![Fast and lightweight; modern UX/UI with dark mode](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-2.webp?20250405)<br>

![Stock photo integration: Pexels, Pixabay, Unsplash](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-3.webp?20250405)<br>

![Full-fledged Asset Library; first-class internationalization support; Google Cloud Translation, Anthropic and OpenAI integration](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-4.webp?20250831)<br>

![Built-in image optimizer for WebP and SVG; mobile & tablet support](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-5.webp?20250409)<br>

![Streamlined local and remote workflow; GitHub, GitLab, Gitea & Forgejo support; single-line migration from Netlify/Decap CMS (depending on your current setup); Sveltia CMS](https://raw.githubusercontent.com/sveltia/sveltia-cms/main/docs/screenshot-6.webp?20250712)<br>

## Table of contents

- [Motivation](#motivation)
  - [Our advantage](#our-advantage)
  - [Our goals](#our-goals)
- [Project Status](#project-status)
- [Differentiators](#differentiators)
- [Compatibility](#compatibility)
  - [Deprecations](#deprecations)
  - [Compatibility with Static CMS](#compatibility-with-static-cms)
- [Getting Started](#getting-started)
  - [Installation \& setup](#installation--setup)
  - [Migration](#migration)
- [Tips \& Tricks](#tips--tricks)
- [Support \& Feedback](#support--feedback)
- [Contributions](#contributions)
- [Roadmap](#roadmap)
- [Related Links](#related-links)
  - [As seen on](#as-seen-on)
- [Privacy](#privacy)
- [Disclaimer](#disclaimer)
- [Acknowledgements](#acknowledgements)

## Motivation

Sveltia CMS was born in November 2022, when the progress of Netlify CMS was stalled for more than six months. [@kyoshino](https://github.com/kyoshino)’s clients wanted to replace their Netlify CMS instances without much effort, mainly to get better internationalization (i18n) support.

To achieve radical improvements in UX, performance, i18n and other areas, it was ultimately decided to build an alternative from the ground up, while ensuring an easy migration path from the other. After proving the idea with a rapid [Svelte](https://svelte.dev/) prototype, development was accelerated to address their primary use cases. The new product has since been named Sveltia CMS and released as open source software to encourage wider adoption.

We loved the simple, unique setup of Netlify CMS that turned a Git repository into a database with a single page app served from a CDN plus a plain YAML config file. In support of the [Jamstack](https://jamstack.org/) concept, we wanted to revive it, modernize it, and take it to the next level.

### Our advantage

Due to its unfortunate abandonment in early 2022, Netlify CMS spawned 3 successors:

- [Static CMS](https://github.com/StaticJsCMS/static-cms): a community fork
  - Initial commit made in September 2022
  - ❌ Discontinued in September 2024 after making meaningful improvements
- **Sveltia CMS**: not a fork but a **complete rewrite**
  - Started in November 2022, first appeared on GitHub in March 2023
  - ✅ Actively developed with frequent releases and numerous improvements
  - ✅ Relevant issues are being resolved regardless of their age or status
  - ✅ Most of new bug reports are addressed promptly, usually within a day
  - ✅ An [extensive roadmap](https://sveltiacms.app/en/roadmap) is available to keep users informed
  - ✅ No known unpatched security vulnerabilities, with dependencies kept up-to-date
- [Decap CMS](https://github.com/decaporg/decap-cms): a rebranded version
  - [Announced in February 2023](https://www.netlify.com/blog/netlify-cms-to-become-decap-cms/) as an official continuation with a Netlify agency partner taking ownership
  - ⚠️ Mostly low activity with only occasional releases and a few minor improvements
  - ⚠️ Seemingly random issues were closed as stale following the takeover
  - ⚠️ Bug reports continue to pile up, often without any response
  - ⚠️ No public roadmap is available, leaving users in the dark
  - ❌ A moderate severity [XSS vulnerability](https://github.com/advisories/GHSA-xp8g-32qh-mv28), high severity dependency vulnerabilities and fatal crashes remain unaddressed

Sveltia CMS is the only project that doesn’t inherit the complexity, technical debt, and numerous bugs of Netlify CMS, which was launched in 2015. Our product is **better by design**:

- We rebuilt the app from scratch using a [modern framework](https://svelte.dev/)
- We don’t reuse any part of the predecessor’s codebase
- We incorporate i18n support into the core instead of adding it as an afterthought
- We closely monitor and analyze the predecessor’s issue tracker
- We rearchitect the entire user experience (UX) and developer experience (DX)

This “total reboot” has enabled us to implement hundreds of improvements without getting stuck in a legacy system. Furthermore:

- We dedicate significant time and effort to modernizing the platform
- We continue to address [issues](https://github.com/decaporg/decap-cms/issues) reported in the predecessor’s repository
- We materialize the enhancements that Netlify CMS users have long desired

For that reason, Sveltia CMS is the **true successor to Netlify CMS** — not just a spiritual successor or a mere alternative — and the best choice for users looking to migrate from the predecessor, other successors, or even other CMS solutions.

### Our goals

- Making Sveltia CMS a viable, definitive successor to Netlify CMS
- Empowering SMBs and individuals who need a free, yet powerful, high-quality CMS solution
- Emerging as the leading open source offering in the Git-based CMS market
- Extending its capabilities as digital asset management (DAM) software
- Showcasing the power of Svelte and UX engineering

## Project Status

Sveltia CMS is currently in **beta**, with version 1.0 (GA) scheduled for release in early 2026. Check our [release notes](https://github.com/sveltia/sveltia-cms/releases) and follow us on [Bluesky](https://bsky.app/profile/sveltiacms.app) for updates. See also our [roadmap](https://sveltiacms.app/en/roadmap).

While we fix reported bugs as quickly as possible, usually within 24 hours, our overall progress may be slower than you think. The thing is, it’s not just a personal project of [@kyoshino](https://github.com/kyoshino), but also a complicated system involving various kinds of activities that require considerable effort:

- Ensuring high [compatibility with Netlify/Decap CMS](https://sveltiacms.app/en/docs/migration/netlify-decap-cms#compatibility)
  - The vast majority of existing configurations work out of the box
  - It works as a drop-in replacement for most use cases
  - Some missing features will be implemented before or shortly after GA
- Tackling as many [Netlify/Decap CMS issues](https://github.com/decaporg/decap-cms/issues) as possible
  - So far, **280+ issues, or 600+ if including duplicates, have been effectively solved** in Sveltia CMS (Yes, you read it right)
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

See the [Migrating from Static CMS](https://sveltiacms.app/en/docs/migration/static-cms) page.

## Getting Started

### Installation & setup

See the [Getting Started](https://sveltiacms.app/en/docs/start) page.

### Migration

See the [Migrating from Netlify CMS or Decap CMS](https://sveltiacms.app/en/docs/migration/netlify-decap-cms) page.

## Tips & Tricks

### Moving your site from Netlify to another hosting service

You can host your Sveltia CMS-managed site anywhere, such as [Cloudflare Pages](https://pages.cloudflare.com/) or [GitHub Pages](https://pages.github.com/). But moving away from Netlify means you can no longer sign in with GitHub or GitLab via Netlify. Instead, you can use [our own OAuth client](https://github.com/sveltia/sveltia-cms-auth), which can be easily deployed to Cloudflare Workers, or [any other 3rd party client](https://decapcms.org/docs/external-oauth-clients/) made for Netlify/Decap CMS.

You can also generate a personal access token (PAT) on GitHub or GitLab, and use it to sign in. No OAuth client is needed. While this method is convenient for developers, it’s better to set up an OAuth client if your CMS instance is used by non-technical users because it’s more user-friendly and secure.

### Enabling autocomplete and validation for the configuration file

Sveltia CMS provides a full [JSON schema](https://json-schema.org/) for the configuration file, so you can get autocomplete and validation in your favourite code editor while editing the CMS configuration. The schema is generated from the source and always up to date with the latest CMS version.

If you use VS Code, you can enable it for the YAML configuration file by installing the [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) and adding the following comment to the top of `config.yml`:

```yaml
# yaml-language-server: $schema=https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json
```

For TOML files, install the [Even Better TOML extension](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml) and add the following comment to the top of `config.toml`:

```toml
#:schema https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json
```

If your configuration is in JSON format (see the [next section](#providing-a-json-configuration-file)), no extension is needed. Just add the following line to the top of `config.json`, within the curly braces:

```json
"$schema": "https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json",
```

Alternatively, you can add the following to your project’s [VS Code settings file](https://code.visualstudio.com/docs/configure/settings#_settings-json-file) at `.vscode/settings.json`, within the outer curly braces:

```jsonc
// For YAML config file
"yaml.schemas": {
  "https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json": ["/static/admin/config.yml"]
}
```

```jsonc
// For JSON config file
"json.schemas": [
  {
    "fileMatch": ["/static/admin/config.json"],
    "url": "https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json"
  }
]
```

The configuration file location varies by framework and project structure, so adjust the path accordingly. For example, if you use Astro, the file is typically located in the `/public/admin/` directory.

If you use another code editor, check its documentation for how to enable JSON schema support for YAML or JSON files.

### Providing a JSON configuration file

Sveltia CMS supports a configuration file written in the JSON format in addition to the standard YAML format. This allows developers to programmatically generate the CMS configuration to enable bulk or complex collections. To do this, simply add a `<link>` tag to your HTML, just like a [custom YAML config link](https://decapcms.org/docs/configuration-options/#configuration-file), but with the type `application/json`:

```html
<link href="path/to/config.json" type="application/json" rel="cms-config-url" />
```

Alternatively, you can [manually initialize](https://decapcms.org/docs/manual-initialization/) the CMS with a JavaScript configuration object.

### Providing a TOML configuration file

Sveltia CMS supports TOML configuration files in addition to YAML and JSON. To use a TOML config file, add a `<link>` tag to your HTML with the type `application/toml`:

```html
<link href="path/to/config.toml" type="application/toml" rel="cms-config-url" />
```

### Providing multiple configuration files

With Sveltia CMS, developers can modularize the CMS configuration. Just provide multiple config links and the CMS will automatically merge them in the order of `<link>` tag appearance. It’s possible to use YAML, [JSON](#providing-a-json-configuration-file) or both.

```html
<link href="/admin/config.yml" type="application/yaml" rel="cms-config-url" />
<link href="/admin/collections/authors.yml" type="application/yaml" rel="cms-config-url" />
<link href="/admin/collections/pages.yml" type="application/yaml" rel="cms-config-url" />
<link href="/admin/collections/posts.yml" type="application/yaml" rel="cms-config-url" />
```

Both standard `application/yaml` and non-standard `text/yaml` are acceptable for the YAML config link `type`.

Limitation: YAML anchors, aliases and merge keys only work if they are in the same file. This is because the files are parsed as separate JavaScript objects and then merged using the [`deepmerge`](https://www.npmjs.com/package/deepmerge) library.

### Working around an authentication error

If you get an “Authentication Aborted” error when trying to sign in to GitHub, GitLab or Gitea/Forgejo using the authorization code flow, you may need to check your site’s [`Cross-Origin-Opener-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy). The COOP header is not widely used, but it’s known to break the OAuth flow with a popup window. If that’s your case, changing `same-origin` to `same-origin-allow-popups` solves the problem. ([Discussion](https://github.com/sveltia/sveltia-cms/issues/131))

### Working with a local Git repository

Sveltia CMS has simplified the local repository workflow by removing the need for additional configuration (the `local_backend` option) and a proxy server (`netlify-cms-proxy-server` or `decap-server`), thanks to the [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) available in [some modern browsers](https://developer.mozilla.org/en-US/docs/web/api/window/showopenfilepicker#browser_compatibility).

Here are the workflow steps and tips:

1. Make sure you have configured the [GitHub](https://decapcms.org/docs/github-backend/), [GitLab](https://decapcms.org/docs/gitlab-backend/) or [Gitea/Forgejo](https://decapcms.org/docs/gitea-backend/) backend.
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
1. Edit your content normally using the CMS. All changes are made to local files.
1. Use `git diff` or a GUI like [GitHub Desktop](https://desktop.github.com/) to see if the produced changes look good.
   - GitHub Desktop can be used for any repository, not just GitHub-hosted ones.
1. Open the dev site at `http://localhost:[port]/` to check the rendered pages.
   - Depending on your framework, you may need to manually rebuild your site to reflect the changes you have made.
   - You can skip this step if your changes don’t involve any pages.
1. Commit and push the changes if satisfied, or discard them if you’re just testing.

If you have migrated from Netlify/Decap CMS and are happy with the local repository workflow of Sveltia CMS, you can remove the `local_backend` option from your configuration and uninstall the proxy server. If you have configured a custom port number with the `.env` file, you can remove it as well.

Note that, as with Netlify/Decap CMS, the local repository support in Sveltia CMS doesn’t perform any Git operations. You have to manually fetch, pull, commit and push all changes using a Git client. Additionally, you’ll need to reload the CMS after modifying the configuration file or retrieving remote updates.

In the future, it will probably be possible to commit changes locally. The Netlify/Decap CMS proxy server actually has an experimental, undocumented Git mode that allows it.[^131] ([Discussion](https://github.com/sveltia/sveltia-cms/discussions/31)) We also plan to use the newly available [File System Observer API](https://developer.chrome.com/blog/file-system-observer) to detect changes and eliminate the need for manual reloads.

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
collections:
  - name: tags
    label: Tags
    icon: sell # or any icon name
    create: true
    folder: content/tags
```

### Adding dividers to the collection list

With Sveltia CMS, developers can add dividers to the collection list to distinguish between different types of collections. To do so, insert a new item with the `divider` option set to `true`. In VS Code, you may receive a validation error if `config.yml` is treated as a Netlify CMS configuration file. You can resolve this issue by [using our JSON schema](#enabling-autocomplete-and-validation-for-the-configuration-file).

```yaml
collections:
  - name: products
    ...
  - divider: true
  - name: pages
    ...
```

The [singleton collection](#using-singletons) also supports dividers.

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
      - { name: title, label: Title }
      - { name: date, label: Published Date, widget: datetime }
      - { name: description, label: Description }
      - { name: body, label: Body, widget: markdown }
    index_file:
      fields: # Fields for the index file
        - { name: title, label: Title }
        - { name: body, label: Body, widget: markdown }
```

Here is an example of full customization. All options are optional.

```yaml
index_file:
  name: _index # File name without a locale or extension. Default: _index
  label: Index File # Human-readable file label. Default: Index File
  icon: home # Material Symbols icon name. Default: home
  fields: # Fields for the index file. If omitted, regular entry fields are used
    ...
  editor:
    preview: false # Hide the preview pane if needed. Default: true
```

If your regular entry fields and index file fields are identical and you don’t need any options, simply write:

```yaml
index_file: true
```

Note that the special index file is placed right under the `folder`, regardless of the collection’s [`path` option](https://decapcms.org/docs/collection-folder/#folder-collections-path). For example, if the `path` is `{{year}}/{{slug}}`, a regular entry would be saved as `content/posts/2025/title.md`, but the index file remains at `content/posts/_index.md`.

### Using singletons

The singleton collection is an unnamed, non-nested variant of a [file collection](https://decapcms.org/docs/collection-file/) that can be used to manage a set of pre-defined data files. Singleton files appear in the content library’s sidebar under the Files group, and users can open the Content Editor directly without navigating to a file list. (If there are no other collections, the singleton collection appears as a regular file collection on desktop.)

To create this special file collection, add the new `singletons` option, along with an array of file definitions, to the root level of your CMS configuration.

This is a conventional file collection:

```yaml
collections:
  - name: data
    label: Data
    files:
      - name: home
        label: Home Page
        file: content/home.yaml
        icon: home
        fields: ...
      - name: settings
        label: Site Settings
        file: content/settings.yaml
        icon: settings
        fields: ...
```

It can be converted to the singleton collection like this:

```yaml
singletons:
  - name: home
    label: Home Page
    file: content/home.yaml
    icon: home
    fields: ...
  - divider: true # You can add dividers
  - name: settings
    label: Site Settings
    file: content/settings.yaml
    icon: settings
    fields: ...
```

If you want to reference a singleton file with a Relation field, use `_singletons` (note an underscore prefix) as the `collection` name.

### Using keyboard shortcuts

- View the Content Library: `Alt+1`
- View the Asset Library: `Alt+2`
- Search for entries and assets: `Ctrl+F` (Windows/Linux) or `Command+F` (macOS)
- Create a new entry: `Ctrl+E` (Windows/Linux) or `Command+E` (macOS)
- Save an entry: `Ctrl+S` (Windows/Linux) or `Command+S` (macOS)
- Cancel entry editing: `Escape`

Standard keyboard shortcuts are also available in the Markdown editor, including `Ctrl+B`/`Command+B` for bold text, `Ctrl+I`/`Command+I` for italics, and `Tab` to indent a list item.

### Controlling entry file paths

A [folder collection](https://decapcms.org/docs/collection-folder/)’s file path is determined by multiple factors: the `i18n`, `folder`, `path`, `slug` and `extension` options. The configuration can be complex, especially with i18n support, so let’s break it down.

- The [`i18n`](https://decapcms.org/docs/i18n/) global or collection option (optional)
  - It can be configured to add internationalization (i18n) support to your site.
  - The `structure` and `omit_default_locale_from_filename` options affect the entry file path.
- The `folder` collection option (required)
  - It specifies the folder where the collection entries are stored, relative to the repository’s root directory.
  - It can contain slashes to create a nested folder structure.
- The [`path`](https://decapcms.org/docs/collection-folder/#folder-collections-path) collection option (optional)
  - It defaults to `{{slug}}`, which is the `slug` collection option value.
  - It can contain template tags.
  - It can also contain slashes to create a nested folder structure.
- The [`slug`](https://decapcms.org/docs/configuration-options/#slug) collection option (optional)
  - It defaults to `{{title}}`, which is the entry’s `title` field value’s slugified version.
  - It can contain template tags but _cannot_ contain slashes.
- The [`extension`](https://decapcms.org/docs/configuration-options/#extension-and-format) collection option (optional)
  - It defaults to `md`.

Looking at the above options, the entry file path can be constructed as follows:

- With i18n disabled:
  ```yaml
  /<folder>/<path>.<extension>
  ```
- With the `single_file` i18n structure
  ```yaml
  /<folder>/<path>.<extension>
  ```
- With the `multiple_files` i18n structure:
  ```yaml
  /<folder>/<path>.<locale>.<extension>
  ```
  When the `omit_default_locale_from_filename` i18n option is set to `true`, the path depends on the locale:
  ```yaml
  /<folder>/<path>.<extension> # default locale
  /<folder>/<path>.<locale>.<extension> # other locales
  ```
- With the `multiple_folders` i18n structure:
  ```yaml
  /<folder>/<locale>/<path>.<extension>
  ```
- With the `multiple_folders_i18n_root` i18n structure:
  ```yaml
  /<locale>/<folder>/<path>.<extension>
  ```

The configuration for a [file collection](https://decapcms.org/docs/collection-file/) and [singleton collection](#using-singletons) is much simpler, as it only requires the `file` option to specify the complete file path, including the folder, filename and extension. It can also include the `{{locale}}` template tag for i18n support.

### Translating entry fields with one click

Sveltia CMS comes with a handy translation API integration so that you can translate any text field from another locale without leaving the Content Editor. Currently, the following services are supported:

- Neural Machine Translation (NMT)
  - Google: [Cloud Translation](https://cloud.google.com/translate)
- Large Language Models (LLMs)
  - Anthropic: [Claude Haiku 4.5](https://www.anthropic.com/claude/haiku)
  - Google: [Gemini 2.5 Flash-Lite](https://deepmind.google/models/gemini/flash-lite/)
  - OpenAI: [GPT-4o mini](https://platform.openai.com/docs/models/gpt-4o-mini)

A few notes to help you choose a service:

- NMT is specialized for translations, while LLMs are more general-purpose.
- NMT is fast, while LLMs may produce more natural, context-aware translations.
- Google offers free tiers, while Anthropic and OpenAI require a paid plan.
- With [Gemini’s free tier](https://ai.google.dev/gemini-api/docs/pricing), API input and output may be used to improve their products. As their terms state, do not send sensitive or confidential information while using the free tier. Consider using the paid plan or other services if this is a concern.

To enable the quick translation feature:

1. Update your configuration file to enable the [i18n support](https://decapcms.org/docs/i18n/) with multiple locales.
1. Create a new API key for the translation service of your choice:
   - Google Cloud Translation
     1. Sign in or sign up for [Google Cloud](https://cloud.google.com/) and create a new project.
     1. Enable the [Cloud Translation API](https://console.cloud.google.com/apis/library/translate.googleapis.com). It’s free up to 500,000 characters per month.
     1. Create a [new API key](https://console.cloud.google.com/apis/api/translate.googleapis.com/credentials) and copy it.
   - Google Gemini
     1. Sign in or sign up for [Google AI Studio](https://aistudio.google.com/).
     1. A new [API key](https://aistudio.google.com/api-keys) is created automatically for your account. Or create a new one if needed, and copy it.
   - Anthropic
     1. Sign in or sign up for [Claude Developer Platform](https://docs.claude.com/en/api/overview).
     1. Add a credit balance (minimum $5) to your account.
     1. Create a [new API key](https://platform.claude.com/settings/keys) and copy it.
   - OpenAI
     1. Sign in or sign up for [OpenAI Platform](https://platform.openai.com/docs/overview) and create a new project.
     1. Add a credit balance (minimum $5) to your account.
     1. Create a [new API key](https://platform.openai.com/api-keys) and copy it.
1. Open an entry in Sveltia CMS.
1. Click on the Translation button on the pane header or each field, right next to the 3-dot menu.
1. Select a translation service from the dropdown menu and paste your API key when prompted.
1. The field(s) will be automatically translated.

Note that the Translation button on the pane header only translates empty fields, while in-field Translation buttons override any filled text.

You can also provide your API keys in the Settings dialog or change the default translation service. API keys are stored in the browser’s local storage, so you don’t need to enter them every time.

If you don’t want some text to be translated, use the HTML [`translate`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/translate) attribute or [`notranslate`](https://developers.google.com/search/blog/2008/10/helping-you-break-language-barrier) class:

```html
<div translate="no">...</div>
<span class="notranslate">...</span>
```

For LLMs, you can also use the `notranslate` comment to exclude specific parts of Markdown content from translation:

```html
<!-- notranslate -->...<!-- /notranslate -->
{/* notranslate */}...{/* /notranslate */}
```

Earlier versions of Sveltia CMS included DeepL integration, but we had to disable it [due to an API limitation](https://github.com/sveltia/sveltia-cms/issues/437). More translation services will be added in the future.

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

Developers can specify locales to be enabled by default when users create a new entry draft, using the `initial_locales` i18n option, which accepts a locale list, `default` (default locale only) or `all` (all locales).

The default locale is always enabled, even if it’s excluded from `initial_locales`, while other locales can be enabled or disabled by users in the Content Editor through the three-dot menu in the top right corner, if this i18n option is defined.

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
      max_file_size: 1024000 # default: Infinity
      slugify_filename: true # default: false
      transformations: # See the next section
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

Similar to the conventional `media_library` option, the unified `media_libraries` option can also be defined for each File/Image field. This allows you to use different media library configurations for different fields. For example, you can optimize images for upload in one field while using the default settings in another:

```yaml
fields:
  - name: cover
    label: Cover Image
    widget: image
    media_libraries:
      default:
        config:
          transformations: # See the next section
```

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
- This feature is not intended for creating image variants in different formats and sizes. It should be done with a framework during the build process. Popular frameworks like [Astro](https://docs.astro.build/en/guides/images/), [Eleventy](https://www.11ty.dev/docs/plugins/image/), [Hugo](https://gohugo.io/content-management/image-processing/), [Next.js](https://nextjs.org/docs/pages/api-reference/components/image) and [SvelteKit](https://svelte.dev/docs/kit/images) have built-in image processing capabilities.
- Exif metadata is stripped from raster images to reduce file size. If you want to keep it, upload the original files without optimization and use the framework to process them later.
- We may add more transformation options in the future.

### Disabling stock assets

The Select File/Image dialog includes some stock photo providers for convenience, but sometimes these may be irrelevant. Developers can hide them with the following configuration:

```yaml
media_libraries:
  stock_assets:
    providers: []
```

### Using entry tags for categorization

If you write blog posts, for example, you may want to categorize them with taxonomies, often called tags, categories, labels or keywords. With Sveltia CMS, there are several ways to implement this feature, depending on your needs.

If you don’t have a predefined list of tags, you can use a simple [List](https://decapcms.org/docs/widgets/#List) field. This configuration will produce a newline-separated text field where users can enter tags freely:

```yaml
collections:
  - name: posts
    label: Blog Posts
    label_singular: Blog Post
    folder: content/posts
    create: true
    fields:
      - name: title
        label: Title
      - name: tags
        label: Tags
        widget: list
      - name: body
        label: Body
        widget: markdown
```

If you have a small number of predefined tags, you can use a [Select](https://decapcms.org/docs/widgets/#Select) field. This configuration will produce a dropdown list where users can select one or more tags:

```yaml
fields:
  - name: tags
    label: Tags
    widget: select
    multiple: true
    options:
      - { label: Travel, value: travel }
      - { label: Food, value: food }
      - { label: Technology, value: technology }
      - { label: Lifestyle, value: lifestyle }
```

If you want more flexibility, you can create a separate collection for tags and reference it using a [Relation](https://decapcms.org/docs/widgets/#Relation) field from your blog post collection. This approach allows you to:

- Add many tags without bloating the configuration file
- Manage tags in one place within the CMS
- Reuse tags across multiple collections
- Add a description, image and other details to each tag (if you have tag index pages)
- Localize tags with [i18n support](https://decapcms.org/docs/i18n/) enabled

This configuration will also produce a dropdown list where users can select one or more tags:

```yaml
fields:
  - name: tags
    label: Tags
    widget: relation
    multiple: true
    collection: tags
    search_fields: [title]
    display_fields: [title]
    value_field: '{{slug}}'
```

And here is an example of the corresponding tag collection:

```yaml
collections:
  - name: tags
    label: Tags
    label_singular: Tag
    folder: content/tags
    create: true
    fields:
      - name: title
        label: Title
      - name: description
        label: Description
        widget: text
        required: false
      - name: image
        label: Image
        widget: image
        required: false
```

Note that it’s not currently possible to add new tags on the fly while editing a blog post. You have to create them in the tag collection first. This issue will be resolved in the future. ([#493](https://github.com/sveltia/sveltia-cms/issues/493))

### Editing site deployment configuration files

Sveltia CMS allows users to edit files without extensions. Examples include `_headers` and `_redirects`, which are used by some static site hosting providers, such as [Netlify](https://docs.netlify.com/routing/redirects/), [GitLab Pages](https://docs.gitlab.com/user/project/pages/redirects/) and [Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/redirects/). Since the `body` field is [saved without the field name](#understanding-exceptions-in-data-output) when using the default `yaml-frontmatter` format, you can use the following configuration to edit these files in the Content Editor:

```yaml
collections:
  - name: config
    label: Site Configuration
    editor:
      preview: false
    files:
      - name: headers
        label: Headers
        file: static/_headers # The path varies by framework
        fields:
          - name: body
            label: Headers
            widget: code # Can also be `text`
            output_code_only: true
            allow_language_selection: false
      - name: redirects
        label: Redirects
        file: static/_redirects # The path varies by framework
        fields:
          - name: body
            label: Redirects
            widget: code # Can also be `text`
            output_code_only: true
            allow_language_selection: false
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
        icon: group
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

It also works with a [singleton](#using-singletons):

```yaml
singletons:
  - name: members
    label: Member List
    file: _data/members.yml
    icon: group
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

Note: The `root` option is ignored in the following cases:

- The file or singleton contains multiple fields. You can still have subfields under the List field.
- The file format is TOML, because TOML doesn’t support top-level arrays.

### Changing the input type of a DateTime field

It may be worth mentioning this topic here because the current [Decap CMS doc about the DateTime widget](https://decapcms.org/docs/widgets/#Datetime) is unclear. By default, a DateTime field lets users pick both [date and time](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/datetime-local), but developers can change the input type if needed.

Set `time_format` to `false` to hide the time picker and make the input [date only](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date):

```yaml
- label: Start Date
  name: startDate
  widget: datetime
  time_format: false
```

Set `date_format` to `false` to hide the date picker and make the input [time only](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/time):

```yaml
- label: Start Time
  name: startTime
  widget: datetime
  date_format: false
```

We understand that this configuration may be a bit confusing, but it’s necessary to maintain backward compatibility with Netlify CMS. We plan to add the `type` option to the DateTime widget and introduce new input types: year, [month](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/month) and [week](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/week).

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

Sveltia CMS supports some [data output](https://sveltiacms.app/en/docs/successor-to-netlify-cms#better-data-output) options, including JSON/YAML formatting preferences, at the root level of the configuration file. The default options are listed below:

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
    indent_sequences: true # false for compact style
```

### Understanding exceptions in data output

Content is generally saved as key-value pairs in a file, where the key is the field name and the value is the field value. However, there are some exceptions you should be aware of.

If the format is front matter, the `body` field is saved outside of the front matter block, as briefly explained in the [Decap CMS document](https://decapcms.org/docs/configuration-options/#extension-and-format):

```yaml
---
title: My Post
date: 2025-01-01
---
This is the body of my post.
```

instead of

```yaml
---
title: My Post
date: 2025-01-01
body: This is the body of my post.
---
```

If there is only the `body` field, the front matter block is omitted altogether:

```yaml
This is the body of my post.
```

However, this doesn’t apply when i18n is enabled with the `single_file` structure. In this case, the `body` field is saved part of key-value pairs under each locale in the front matter block:

```yaml
---
en:
  title: My Post
  date: 2025-01-01
  body: This is the body of my post.
fr:
  title: Mon article
  date: 2025-01-01
  body: C’est le corps de mon article.
---
```

There are two exceptional cases for the List widget:

1. When the `field` (singular) option is used, the `name` property is omitted from the output. It will be saved as a simple list of values:
   ```yaml
   images:
     - https://example.com/image1.jpg
     - https://example.com/image2.jpg
   ```
   instead of an array of objects:
   ```yaml
   images:
     - image: https://example.com/image1.jpg
     - image: https://example.com/image2.jpg
   ```
   This is not mentioned in the [Decap CMS document](https://decapcms.org/docs/widgets/#List), but it’s a known behaviour. If you expect the latter, you can use the `fields` (plural) option to define a single field:
   ```yaml
   - name: images
     label: Images
     widget: list
     fields:
       - { name: image, label: Image, widget: image }
   ```
1. When the [`root` option](#editing-data-files-with-a-top-level-list) is set to `true`, the List field is saved as a top-level list without a field name:
   ```yaml
   - name: John Doe
     id: 12345
   - name: Jane Smith
     id: 67890
   ```
   instead of
   ```yaml
   members:
     - name: John Doe
       id: 12345
     - name: Jane Smith
       id: 67890
   ```

### Disabling automatic deployments

You may already have a CI/CD tool set up on your Git repository to automatically deploy changes to production. Occasionally, you make a lot of changes to your content to quickly reach the CI/CD provider’s (free) build limits, or you just don’t want to see builds triggered for every single small change.

With Sveltia CMS, you can disable automatic deployments by default and manually trigger deployments at your convenience. This is done by adding the `[skip ci]` prefix to commit messages, the convention supported by [GitHub Actions](https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs), [GitLab CI/CD](https://docs.gitlab.com/ee/ci/pipelines/#skip-a-pipeline), [CircleCI](https://circleci.com/docs/skip-build/#skip-jobs), [Travis CI](https://docs.travis-ci.com/user/customizing-the-build/#skipping-a-build), [Netlify](https://docs.netlify.com/site-deploys/manage-deploys/#skip-a-deploy), [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/branch-build-controls/#skip-builds) and others. Here are the steps to use it:

1. Add the `skip_ci` property to your `backend` configuration with a value of `true`:
   ```yaml
   backend:
     name: github
     repo: owner/repo
     branch: main
     skip_ci: true
   ```
1. Commit and deploy the change to the config file and reload the CMS.
1. Now, whenever you save an entry or asset, `[skip ci]` is automatically added to each commit message. However, deletions are always committed without the prefix to avoid unexpected data retention on your site.
1. If you want to deploy a new or updated entry, as well as any other unpublished entries and assets, click an arrow next to the Save button in the Content Editor, then select **Save and Publish**. This will trigger CI/CD by omitting `[skip ci]`.

If you set `skip_ci` to `false`, the behaviour is reversed. CI/CD will be triggered by default, while you have an option to **Save without Publishing** that adds `[skip ci]` only to the associated commit.

Gotcha: Unpublished entries and assets are not drafts. Once committed to your repository, those changes can be deployed any time another commit is pushed without `[skip ci]`, or when a manual deployment is triggered.

If the `skip_ci` property is defined, you can manually trigger a deployment by clicking the **Publish Changes** button on the application header. To use this feature:

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
- Gitea/Forgejo: (If you’re running a self-hosted instance, use the origin instead.)
  - `img-src`
    ```
    https://gitea.com
    ```
  - `connect-src`
    ```
    https://gitea.com
    ```
- OpenStreetMap: (used in the built-in Map widget)
  - `img-src`
    ```
    https://*.openstreetmap.org
    ```
  - `connect-src`
    ```
    https://*.openstreetmap.org
    ```
- Cloudinary:
  - `img-src`
    ```
    https://res.cloudinary.com
    ```
    or a custom domain if configured
  - `frame-src`
    ```
    https://console.cloudinary.com
    ```
- Uploadcare:
  - `img-src`
    ```
    https://*.ucarecd.net https://ucarecdn.com
    ```
    or a custom domain if configured
  - `connect-src`
    ```
    https://upload.uploadcare.com https://api.uploadcare.com
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
- Google Cloud Translation:
  - `connect-src`
    ```
    https://translation.googleapis.com
    ```
- Google Gemini:
  - `connect-src`
    ```
    https://generativelanguage.googleapis.com
    ```
- Anthropic:
  - `connect-src`
    ```
    https://api.anthropic.com
    ```
- OpenAI:
  - `connect-src`
    ```
    https://api.openai.com
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

Sveltia CMS is not a service but a client-side application that runs in your web browser. You don’t need an account to use the app, but you do need to authenticate with your Git hosting provider to read and write remote data. All content is stored in your Git repository. No data is sent to any server operated by us.

Depending on your CMS configuration, you will need to use an OAuth application hosted by yourself or a third party, such as Netlify or Cloudflare, to retrieve an access token from GitHub. Alternatively, you can provide an access token directly on the CMS’s sign-in page. In any case, your token is stored in your browser’s local storage, and subsequent API requests are made directly between your browser and the Git hosting provider.

The CMS also integrates with various third-party services, including stock photo providers and translation services. These are “bring your own key” (BYOK) features that are entirely optional. You provide your own API keys for these services, which are stored in your browser’s local storage, and API requests are then made directly between your browser and the relevant service providers.

As we don’t collect any analytics data either, we don’t have a privacy policy. For third-party services, please refer to their respective privacy policies.

## Disclaimer

This software is provided “as is” without any express or implied warranty. We are not obligated to provide any support for the application. This product is not affiliated with or endorsed by Netlify, Decap CMS or any other integrated services. All product names, logos, and brands are the property of their respective owners.

## Acknowledgements

This project would not have been possible without the open source Netlify CMS project. We are grateful to the maintainers for their hard work over the years. We would also like to thank the Sveltia CMS user community for their valuable feedback and ongoing support, which has helped us to identify issues and improve the product.

[^4]: Netlify/Decap CMS [#3671](https://github.com/decaporg/decap-cms/issues/3671)

[^131]: Netlify/Decap CMS [#4429](https://github.com/decaporg/decap-cms/issues/4429)
