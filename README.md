# Sveltia CMS

Sveltia CMS is a Git-based lightweight headless CMS under development as a drop-in replacement for [Netlify/Decap CMS](https://decapcms.org/). You can use it with any static site generator like SvelteKit, Eleventy, Next.js and Hugo to manage content as static files in a Git repository. The open source alternative to Netlify/Decap CMS is now in public beta — with more features to come.

![Screenshot: Git-based Headless CMS with Dark Mode](docs/screenshot-1.webp)<br>

![Screenshot: Instant Entry Listing, Searching and Saving](docs/screenshot-2.webp)<br>

![Screenshot: All-New Media Library](docs/screenshot-3.webp)<br>

![Screenshot: Stock Photo Integrations; Quick Translation](docs/screenshot-4.webp)<br>

![Screenshot: Single-Line Migration from Netlify/Decap CMS](docs/screenshot-5.webp)<br>

## Motivation

Sveltia CMS was born in November 2022, when the development of Netlify CMS had stalled for over six months. [@kyoshino](https://github.com/kyoshino)’s clients were looking to replace their Netlify CMS instances, mainly to get better internationalization (i18n) and multilingual support. Built from the ground up, Sveltia CMS incorporates i18n into every corner of the product, while striving to radically improve UX, performance and productivity.

Our goal is to expand the market for Git-based headless CMS to empower small businesses and individuals who don’t need or can’t afford a (No)SQL database to manage their content. The project also showcases the power of [Svelte](https://svelte.dev/), a modern UI library for creating web applications with less code.

## Features

Sveltia CMS is a Git-based lightweight headless CMS, which means:

- Git-based: The content is stored as static JSON, YAML or TOML files on your Git repository. No 3rd party database or API is involved. Your data is yours.
- Lightweight: The app is compiled as a single small JavaScript file served over a CDN. There’s no need to sign up for a service or install additional software.
- Headless: The CMS only takes care of raw data. You can read it and render the final content with your favourite framework.

Here are some highlights mainly compared to Netlify/Decap CMS:

### Compatible with Netlify/Decap CMS

- Ready to replace Netlify/Decap CMS _in some casual use case scenarios_ by updating one single line of code.
- Existing [configuration files](https://decapcms.org/docs/configuration-options/) can be reused as is.
- Various features are still missing though; [see the compatibility chart below](#compatibility) for details.

### Better UX

- Created by an [experienced UX engineer](https://github.com/kyoshino) who loves code and design.
- Offering a modern, intuitive UI, with some inspiration from the Netlify CMS v3 prototype[^1].
- Immersive dark mode[^2].
- The screenshots above are worth a thousand words!

### Better performance

- Built completely from scratch with Svelte rather than forking React-based Netlify/Decap CMS. The app starts fast and stays fast. The compiled code is vanilla JavaScript; you can use it with any framework.
- Using the GraphQL API for GitHub by default to quickly fetch contents at once, so that entries and media can be listed and searched instantly. This avoids the slowness and potential API rate limit violations caused by hundreds of requests with relation widgets[^14].
- Saving entries and media is also much faster thanks to the [GraphQL mutation](https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/).
- Caching Git files locally to further speed up startup and reduce bandwidth.
- Small footprint: less than 300 KB when minified and gzipped, compared to 1.5 MB of Netlify/Decap CMS. And [no virtual DOM overhead](https://svelte.dev/blog/virtual-dom-is-pure-overhead).

### Better productivity

- You can [work on a local Git repository](#work-with-a-local-git-repository) without having to run a proxy server.
- You can delete multiple entries and assets at once.
- Providing some keyboard shortcuts for faster editing. More to come!
  - Create a new entry: `Ctrl+E` (Windows/Linux) / `Command+E` (macOS)
  - Save an entry: `Ctrl+S` (Windows/Linux) / `Command+S` (macOS)
  - Search for entries and assets: `Ctrl+F` (Windows/Linux) / `Command+F` (macOS)
- Solving various outstanding Netlify/Decap CMS bugs[^11].

### Better i18n support

- Making it easier to switch between locales while editing with just a click on a button.
- Fields in non-default locales will be validated as expected[^13].
- [Integrating DeepL](#use-deepl-to-translate-entry-fields) to allow translating text fields from another locale with one click.
- You can [use a random UUID for an entry slug](#use-a-random-id-for-an-entry-slug), which is a good option for locales writing in non-Latin characters[^12].
- Solving limitations in Netlify/Decap CMS’s [list and object widgets](https://decapcms.org/docs/beta-features/#i18n-support) so that changes made with these widgets will be duplicated between locales as expected when using the `i18n: duplicate` field configuration[^7].

### Collection enhancements

- You can choose a [custom icon for each collection](#use-a-custom-icon-for-a-collection)[^3].
- A [per-collection media folder](#use-a-custom-media-folder-for-a-collection) will appear aside of entries.
- String values in YAML files can be quoted with the new `yaml_quote: true` option for a collection, mainly for framework compatibility[^9].

### Field enhancements

- Required fields, not optional fields, are clearly marked for efficient data entry.
- Integration with Pexels, Pixabay and Unsplash makes it easy to insert free stock photos into image fields[^8].
- You can revert changes to all fields or a specific field.

### Media library enhancements

- An all-new media library makes it easy to manage all your assets.
- You can sort or filter assets by name or file type and view asset details, including size, dimensions, and a list of entries that use the selected asset.
- You can upload multiple assets at once, including files in nested folders, by browsing or dragging & dropping them into the media library[^5].
- You can navigate between the global media folder and a per-collection media folder[^6].

## Compatibility

While it’s not our goal to recreate all the features found in Netlify/Decap CMS, we plan to maximize compatibility before the 1.0 release so that more users can migrate to our modern alternative.

| Feature | Status in Sveltia CMS |
| --- | --- |
| Installation | Installing with npm is not supported yet. |
| UI locales | Only English and Japanese are available at this time. No registration is needed. While the UI locale is automatically selected depending on the browser’s language settings, it can be changed in Settings. (Click on the Account button at the top right corner of the CMS.) |
| Account | Only the [GitHub backend](https://decapcms.org/docs/github-backend/) is available at this time. You can keep using Netlify or a [3rd party OAuth client](https://decapcms.org/docs/external-oauth-clients/) (or [our own](https://github.com/sveltia/sveltia-cms-auth)) to sign in with GitHub, just like Netlify/Decap CMS. The GitLab backend is coming soon. We plan to add the Test backend as well for our demo site, but Azure and Bitbucket are unlikely to be supported, mainly due to the lack of an API method to fetch content in bulk. Later we may implement a performant Git Gateway alternative using GraphQL. |
| Configuration | Supported. |
| Media | External media storage services are not supported yet. |
| Editorial Workflow | Not supported yet. |
| Collections | Supported. |
| Widgets | [See below](#widget-limitations) for the current limitations. |
| Custom widgets | Not supported yet. |
| Custom previews | Not supported yet. |

### Widget limitations

| Widget | Status in Sveltia CMS |
| --- | --- |
| Code | Not supported yet. |
| Color | It’s a native `<input>` element at this time. The `enableAlpha` option is not supported yet. |
| Date/DateTime | These are also native `<input>` elements. The `date_format` and `time_format` options with Moment.js tokens are not supported yet. We may deprecate the Moment.js format support anyway. |
| File/Image | Field-specific media folders and media library options are not supported yet other than `media_library.config.max_file_size` for the default media library. |
| Map | Not supported yet. |
| Markdown | It’s a plain text editor at this time. A rich text editor is coming soon. |
| Relation | The `search_fields` options is not supported yet. |

### Beta features in Netlify/Decap CMS

| Feature | Status in Sveltia CMS |
| --- | --- |
| Working with a Local Git Repository | Supported. [See below](#work-with-a-local-git-repository) for details. |
| GitLab and BitBucket Editorial Workflow Support | The GitLab backend is not supported yet. No plan to support BitBucket. |
| i18n Support | Supported. In fact, i18n is at the core of Sveltia CMS! |
| GitHub GraphQL API | Supported. Sveltia CMS uses GraphQL by default for a better performance. It cannot be disabled. |
| GitLab GraphQL API | The GitLab backend is not supported yet. |
| Open Authoring | Not supported yet. |
| Folder Collections Path | Supported. |
| Folder Collections Media and Public Folder | Supported. We recommend using [absolute path per-collection folders](#use-a-custom-media-folder-for-a-collection) for easier asset management rather than relative path per-entry folders. |
| List Widget: Variable Types | Supported. |
| Custom Mount Element | Supported. |
| Manual Initialization | Not supported yet. |
| Raw CSS in registerPreviewStyle | Not supported yet. |
| Squash merge GitHub pull requests | Editorial workflow is not supported yet. |
| Commit Message Templates | Supported. |
| Image widget file size limit | Supported. |
| Summary string template transformations | Supported. |
| Registering to CMS Events | Not supported yet. |
| Dynamic Default Values | Supported. |
| Nested Collections | Not supported yet. |
| Remark plugins | Not supported yet. |
| Custom formatters | Not supported yet. |

### Other features

- Comprehensive config validation is not implemented yet.
- Auto-saving a draft entry is not implemented yet.
- Downloading an asset in the media library is not implemented yet.
- [Backend health check](https://www.githubstatus.com/api) is not implemented yet.

## Known issues

- Accessibility support is limited.

## Roadmap

- Further Netlify/Decap CMS compatibility, including Editorial Workflow
- Further performance optimization, including data caching and [Svelte 5](https://svelte.dev/blog/runes) migration
- Further UX enhancements
- Config editor[^10]
- Documentation
- Demo site
- Starter templates

### Non goals (for now)

- Mobile support
- WYSIWYG editing

## Getting started

### New users

Currently, Sveltia CMS is aimed at existing Netlify/Decap CMS users. If you don’t have it yet, follow [their documentation](https://decapcms.org/docs/add-to-your-site/) to add it to your site first. Then migrate to Sveltia CMS as described below.

As the product evolves, we’ll implement the configuration editor and provide comprehensive documentation to make it easier for everyone to get started with Sveltia CMS.

Here are some starter templates for popular frameworks created by our contributors. More to follow!

- [Eleventy](https://github.com/danurbanowicz/eleventy-sveltia-cms-starter) by [@danurbanowicz](https://github.com/danurbanowicz)

### Migration

If you’re already using Netlify/Decap CMS with the GitHub backend and don’t have any custom widget, custom preview or plugin, migrating to Sveltia CMS is super easy. Edit `/admin/index.html` to replace the CMS `script` tag, and push the change to your repository:

```diff
-<script src="https://unpkg.com/netlify-cms@^2.0.0/dist/netlify-cms.js"></script>
+<script src="https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js" type="module"></script>
```

That’s it! You can open `https://[hostname]/admin/` as before to start editing. There is even no authentication process if you’ve already been signed in with GitHub on Netlify/Decap CMS because Sveltia CMS uses your auth token stored in the browser. Simple enough!

That said, we strongly recommend testing your new Sveltia CMS instance first on your local machine. [See below](#work-with-a-local-git-repository) for how.

## Tips & tricks

### Move your site from Netlify to another hosting service

You can host your Sveltia CMS-managed site anywhere, such as [Cloudflare Pages](https://pages.cloudflare.com/) or [GitHub Pages](https://pages.github.com/). But moving away from Netlify means you can no longer sign in with GitHub via Netlify. Instead, you can use [our own OAuth client](https://github.com/sveltia/sveltia-cms-auth), which can be easily deployed to Cloudflare Workers, or [any other 3rd party client](https://decapcms.org/docs/external-oauth-clients/) made for Netlify/Decap CMS.

### Work with a local Git repository

You can use Sveltia CMS with a local Git repository, just like the [beta feature](https://decapcms.org/docs/beta-features/#working-with-a-local-git-repository) in Netlify/Decap CMS, but Sveltia CMS has simplified the workflow by removing the need for additional configuration (the `local_backend` property) and proxy server, thanks to the [File System Access API](https://developer.chrome.com/articles/file-system-access/) available in [some modern browsers](https://developer.mozilla.org/en-US/docs/web/api/window/showopenfilepicker#browser_compatibility).

1. Launch the local development server for your frontend framework, typically with `npm run dev`.
1. Visit `http://localhost:[port]/admin/index.html` with Chrome or Edge. The port number depends on your framework.
1. Click “Work with Local Repository” and select the project’s root directory once prompted.
1. Make some changes on Sveltia CMS.
1. See if the produced changes look good using `git diff` or a GUI like [GitHub Desktop](https://desktop.github.com/).
1. Commit and push the changes if satisfied, or discard them if you’re just testing.

### Use a custom icon for a collection

As shown in the screenshot above, you can use different icons for collections in Sveltia CMS.

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

### Use a custom media folder for a collection

This is actually not new in Sveltia CMS but rather an _undocumented_ feature in Netlify/Decap CMS[^4]. You can specify media and public folders for each collection that override the [global media folder](https://decapcms.org/docs/configuration-options/#media-and-public-folders). Well, it’s [documented](https://decapcms.org/docs/beta-features/#folder-collections-media-and-public-folder) as a beta feature, but that’s probably not what you want.

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

### Use DeepL to translate entry fields

Sveltia CMS comes with a handy DeepL integration so that you can translate any text field from another locale without leaving the content editor. To enable the high-quality, quick translation feature:

1. Sign up for [DeepL API](https://www.deepl.com/pro-api/) and copy your Authentication Key from DeepL’s Account page.
1. Go back to Sveltia CMS, click on the Account button at the top right corner, then click Settings.
1. Paste your key to the DeepL API Authentication Key field, and close the Settings dialog.
1. Open any entry, and you can now translate all fields or individual fields by selecting the Translate menu item.
1. If you have upgraded to DeepL API Pro, provide your new Authentication Key in the same way.

### Use a random ID for an entry slug

By default, the [slug for a new entry file](https://decapcms.org/docs/configuration-options/#slug) will be generated based on the entry’s `title` field. Or, you can specify the collection’s `slug` option to use the file creation date or other fields. While the behaviour is generally acceptable and SEO-friendly, it’s not useful if the title might change later or if it contains non-Latin characters like Chinese. In Sveltia CMS, you can easily generate a random [UUID](https://developer.mozilla.org/en-US/docs/Glossary/UUID) for a slug without a custom widget!

It’s simple — just specify `{{uuid}}` (full UUID v4), `{{uuid_short}}` (last 12 characters only) or `{{uuid_shorter}}` (first 8 characters only) in the `slug` option. The results would look like `4fc0917c-8aea-4ad5-a476-392bdcf3b642`, `392bdcf3b642` and `4fc0917c`, respectively.

```diff
   - name: members
     label: Members
     create: true
     folder: data/members/
+    slug: '{{uuid_short}}'
```

### Set up Content Security Policy

If your site adopts Content Security Policy (CSP), use the following policy for Sveltia CMS, or some features may not work.

```csp
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' blob: data:;
script-src 'self' https://unpkg.com;
connect-src 'self' blob: data:;
```

And combine the following policies depending on your Git backend and enabled integrations.

- GitHub:
  ```csp
  img-src https://avatars.githubusercontent.com https://raw.githubusercontent.com;
  connect-src https://api.github.com https://www.githubstatus.com;
  ```
- Pexels:
  ```csp
  img-src https://images.pexels.com;
  connect-src https://images.pexels.com https://api.pexels.com;
  ```
- Pixabay:
  ```csp
  img-src https://pixabay.com;
  connect-src https://pixabay.com;
  ```
- Unsplash:
  ```csp
  img-src https://images.unsplash.com;
  connect-src https://images.unsplash.com https://api.unsplash.com;
  ```
- DeepL API Free:
  ```csp
  connect-src https://api-free.deepl.com;
  ```
- DeepL API Pro:
  ```csp
  connect-src https://api.deepl.com;
  ```

If you have image field(s) and expect that images will be inserted as URLs, you may want to allow any source using a wildcard instead of specifying individual origins:

```csp
img-src 'self' blob: data: https://*;
```

### Self-host the CMS

Sveltia CMS is open source for sure! You can host it on your server rather than loading it from UNPKG, though it’s not recommended due to missing bug fixes. Simply copy the latest [`sveltia-cms.js`](https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js) file from the CDN, or build it yourself:

1. Clone this Git repository.
1. Run `pnpm install && pnpm build` at the project root.
1. `sveltia-cms.js` will be generated under the `dist` directory.

Importing the CMS as an npm package is not supported yet.

## Support & feedback

Visit the [Discussions](https://github.com/sveltia/sveltia-cms/discussions) page on this GitHub repository and start a new discussion. Tell us about your use cases!

Want to build a website with Sveltia CMS? [@kyoshino](https://github.com/kyoshino) is available for hire depending on your requirements.

## Contributions

Sveltia CMS is still in early beta, so we do expect various problems. Please [report any bugs to us](https://github.com/sveltia/sveltia-cms/issues/new). Feel free to submit feature requests as well. Meanwhile, pull requests may not be accepted for the time being due to limited review resources.

## Related Links

- Introducing Sveltia CMS: a short technical presentation by [@kyoshino](https://github.com/kyoshino) during the _This Week in Svelte_ online meetup on March 31, 2023 — [recording](https://youtu.be/-YjLubiieYs?t=1660) & [slides](https://docs.google.com/presentation/d/1Wi4ty-1AwOp2-zy7LctmzCV4rrdYPfke9NGhO0DdRdM)

## Disclaimer

This software is provided “as is” without any express or implied warranty. This product is not affiliated with or endorsed by Netlify, Decap CMS or any other integrated services. All product names, logos, and brands are the property of their respective owners.

[^1]: [Netlify/Decap CMS #2557](https://github.com/decaporg/decap-cms/issues/2557)
[^2]: [Netlify/Decap CMS #3267](https://github.com/decaporg/decap-cms/issues/3267)
[^3]: [Netlify/Decap CMS #1040](https://github.com/decaporg/decap-cms/issues/1040)
[^4]: [Netlify/Decap CMS #3671](https://github.com/decaporg/decap-cms/issues/3671)
[^5]: [Netlify/Decap CMS #1032](https://github.com/decaporg/decap-cms/issues/1032)
[^6]: [Netlify/Decap CMS #3240](https://github.com/decaporg/decap-cms/issues/3240)
[^7]: [Netlify/Decap CMS #4386](https://github.com/decaporg/decap-cms/issues/4386)
[^8]: [Netlify/Decap CMS #2579](https://github.com/decaporg/decap-cms/issues/2579)
[^9]: [Netlify/Decap CMS #3505](https://github.com/decaporg/decap-cms/issues/3505)
[^10]: [Netlify/Decap CMS #341](https://github.com/decaporg/decap-cms/issues/341)
[^11]: [Netlify/Decap CMS #1382](https://github.com/decaporg/decap-cms/issues/1382) and many more. We’ll be updating this list after reviewing their issue list.
[^12]: [Netlify/Decap CMS #1975](https://github.com/decaporg/decap-cms/issues/1975)
[^13]: [Netlify/Decap CMS #5112](https://github.com/decaporg/decap-cms/issues/5112)
[^14]: [Netlify/Decap CMS #4635](https://github.com/decaporg/decap-cms/issues/4635), [Netlify/Decap CMS #5920](https://github.com/decaporg/decap-cms/issues/5920), [Netlify/Decap CMS #6410](https://github.com/decaporg/decap-cms/issues/6410)
