# Sveltia CMS

Sveltia CMS is a Git-based lightweight headless CMS under active development as a modern, quick replacement for Netlify CMS and [Decap CMS](https://decapcms.org/). In some simple cases, migration is as easy as a single line of code change, although we’re still working on improving compatibility. The free, open source, UX-focused alternative to Netlify/Decap CMS is now in public beta — with more features to come.

![Screenshot: Git-based Headless CMS with Dark Mode](docs/screenshot-1-20231124.webp)<br>

![Screenshot: Instant Entry Listing, Searching, Saving](docs/screenshot-2-20231124.webp)<br>

![Screenshot: Stock Photo Integration with Pexels, Pixabay and Unsplash](docs/screenshot-3-20231124.webp)<br>

![Screenshot: All-New Asset Library; Full Internationalization Support with DeepL](docs/screenshot-4-20231124.webp)<br>

![Screenshot: Works with Remote (GitHub, GitLab) and Local Repositories; Single-Line Migration from Netlify/Decap CMS (depending on your current setup); Sveltia CMS](docs/screenshot-5-20240405.webp)<br>

## Motivation

Sveltia CMS was born in November 2022, when the progress of Netlify CMS was stalled for more than six months. [@kyoshino](https://github.com/kyoshino)’s clients wanted to replace their Netlify CMS instances without much effort, mainly to get better internationalization (i18n) support.

To achieve radical improvements in UX, performance, i18n and other areas, it was decided to build an alternative from the ground up, while ensuring an easy migration path from the other. After proving the concept with a rapid [Svelte](https://svelte.dev/) prototype, development was accelerated to address their primary use cases. The new offering has since been named Sveltia CMS and released as open source software to encourage wider adoption.

Our goal is to make it a viable successor to Netlify CMS, expand the Git-based headless CMS market, empower small businesses and individuals who need a simple yet powerful CMS solution, and showcase the huge potential of the Svelte framework.

## Features

We are working hard to create a **much better alternative to Netlify CMS** and Decap CMS by improving everything. Here’s what makes Sveltia CMS different. Look how serious we are!

### Compatible with Netlify/Decap CMS

- Ready to replace Netlify/Decap CMS _in some casual use case scenarios_ by updating a single line of code.
- Your existing [configuration file](https://decapcms.org/docs/configuration-options/) can be reused as is.
- Various features are still missing though — look at the [compatibility chart](#compatibility) below to see if you can migrate.

### Better UX

- Created and maintained by an [experienced UX engineer](https://github.com/kyoshino) who loves code, design and marketing. You can expect constant UX improvements across the platform.
- Offers a modern, intuitive user interface, including an immersive dark mode[^2], inspired in part by the Netlify CMS v3 prototype[^1].
- Comes with touch device support. While the UI is not yet optimized for small screens, large tablets like iPad Pro or Pixel Tablet should work well.
- Made with Svelte, not React, means we can spend more time on UX rather than tedious state management.
- The screenshots above are worth a thousand words!
- Read on to learn about many other enhancements, including performance, productivity, accessibility, service integrations, and an all-new Asset Library.

### Better performance

- Built completely from scratch with Svelte instead of forking React-based Netlify/Decap CMS. The app starts fast and stays fast. The compiled code is vanilla JavaScript — you can use it with almost any framework.
- Small footprint: The bundle size is less than 350 KB when minified and gzipped, compared to 1.5 MB of Netlify/Decap CMS. And [no virtual DOM overhead](https://svelte.dev/blog/virtual-dom-is-pure-overhead).
- Uses the GraphQL API for GitHub and GitLab to quickly fetch content at once, so that entries and assets can be listed and searched instantly[^32]. It also avoids the slowness and potential API rate limit violations caused by hundreds of requests with Relation widgets[^14].
- Saving entries and assets to GitHub is also much faster thanks to the [GraphQL mutation](https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/).
- A list of repository files is cached locally for faster startup and bandwidth savings.
- Thumbnails of assets, including PDF files, are generated and cached for faster rendering of the Asset Library and other parts of the CMS[^39].
- Using caching and lazy loading techniques to improve performance.

### Better productivity

- You can [work with a local Git repository](#work-with-a-local-git-repository) without any configuration or proxy server[^26].
  - In addition to a streamlined workflow, it also offers great performance because files are loaded natively through the browser rather than using an ad hoc API.
  - This also allows you to bypass the 30 MB file size limit[^51].
  - The `logo_url` defined in the configuration will be used[^49].
- Click once (the Save button) instead of twice (Publish > Publish now) to save an entry.
- The Entry Editor closes automatically when an entry is saved.
- You can upload multiple assets at once. (See below)
- You can delete multiple entries and assets at once.
- Some keyboard shortcuts are available for faster editing. More to come!
  - View the Content Library: `Alt+1`
  - View the Asset Library: `Alt+2`
  - Search for entries and assets: `Ctrl+F` (Windows/Linux) or `Command+F` (macOS)
  - Create a new entry: `Ctrl+E` (Windows/Linux) or `Command+E` (macOS)
  - Save an entry: `Ctrl+S` (Windows/Linux) or `Command+S` (macOS)
- Never miss out on the latest features and bug fixes by being notified when an update to the CMS is available[^31].

### Better accessibility

- Improved keyboard handling lets you efficiently navigate through UI elements using the Tab, Space, Enter and arrow keys[^17].
- Comprehensive [WAI-ARIA](https://w3c.github.io/aria/) support enables users who rely on screen readers such as NVDA and VoiceOver.
- Ensures sufficient contrast between the foreground text and background colours.
- Honours your operating system’s [reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) and [reduced transparency](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency) settings.
- We’ll continue to test and improve the application to meet [WCAG 2.2](https://w3c.github.io/wcag/guidelines/22/).

### Better security

- Avoids high/critical severity vulnerabilities through constant dependency updates and frequent releases[^34].
- We have documented how to [set up a Content Security Policy](#set-up-content-security-policy) for the CMS.
- The `unsafe-eval` or `unsafe-inline` keywords are not needed in the `script-src` CSP directive[^33].
- The `same-origin` referrer policy is automatically set with a `<meta>` tag.

### Better backend support

- Uses the GraphQL API where possible for better performance, as mentioned above. You don’t need to set the `use_graphql` option to enable it for GitHub and GitLab.
- The Git branch name is automatically set to the repository’s default branch (`main`, `master` or whatever) if not specified in the configuration file, preventing data loading errors due to a hardcoded fallback to `master`[^27].
- You can [disable automatic deployments](#disable-automatic-deployments) by default or on demand to save costs and resources associated with CI/CD and to publish multiple changes at once[^24].

### Better i18n support

- You can easily switch between locales while editing with just a click on a button instead of a dropdown list.
- Fields in non-default locales are validated as expected[^13].
- Boolean, DateTime, List and Number fields in the entry preview are displayed in a localized format.
- [Integrates DeepL](#use-deepl-to-translate-entry-fields) to allow translation of text fields from another locale with one click.
- You can [disable non-default locale content](#disable-non-default-locale-content)[^15].
- You can [use a random UUID for an entry slug](#use-a-random-id-for-an-entry-slug), which is a good option for locales that write in non-Latin characters.
- Resolves the [limitations in the List and Object widgets](https://decapcms.org/docs/i18n/#limitations) so that changes made with these widgets will be duplicated between locales as expected when using the `i18n: duplicate` field configuration[^7].
- [Entry-relative media folders](https://decapcms.org/docs/collection-folder/#media-and-public-folder) can be used in conjunction with the `multiple_folders` i18n structure[^21].
- Boolean fields are updated in real time between locales like other widgets to avoid confusion[^35].

### Better collections

- You can choose a [custom icon for each collection](#use-a-custom-icon-for-a-collection)[^3].
- Assets stored in a [per-collection media folder](#use-a-custom-media-folder-for-a-collection) can be displayed next to the entries.
- Entry slug template tags support [filter transformations](https://decapcms.org/docs/summary-strings/) just like summary string template tags[^29].
- You can set the maximum number of characters for an entry slug with the new `slug_length` collection option[^25].

### Better content editing

- Required fields, not optional fields, are clearly marked for efficient data entry.
- You can revert changes to all fields or a specific field.
- You can hide the preview of a specific field with `preview: false`.
- Fields with validation errors are automatically expanded if they are part of nested, collapsed objects[^40].
- When you click on a field in the Preview pane, the corresponding field in the Editor pane is highlighted. It will be automatically expanded if collapsed[^41].

### Better data output

- For data consistency, Boolean, List (see below) and other fields are always saved as a proper value, such as an empty string or an empty array, rather than nothing, even if it’s optional or empty.
- Leading and trailing spaces in text-type field values are automatically removed when you save an entry[^37].
- JSON/TOML/YAML data is saved with a new line at the end of the file to prevent unnecessary changes being made to the file[^11].
- String values in YAML files can be quoted with the new `yaml_quote: true` option for a collection, mainly for framework compatibility[^9].

### Better widgets

- Boolean
  - A required Boolean field with no default value is saved as `false` by default, without raising a confusing validation error[^45].
  - An optional Boolean field with no default value is also saved as `false` by default, rather than nothing[^46].
- List
  - A required List field with no subfield or value is marked as invalid[^43].
  - An optional List field with no subfield or value is saved as an empty array, rather than nothing[^44].
  - You can enter spaces in a simple text-based List field[^50].
  - You can preview variable types without having to register a preview template[^42].
- Object
  - Supports [variable types](https://decapcms.org/docs/variable-type-widgets/) just like the List widget. This allows you to have dependent fields in a collection[^30].
  - An optional Object field can be manually added or removed. If unadded or removed, the required subfields won’t trigger validation errors[^16].
- Relation
  - Field options are displayed with no additional API requests[^14]. The `options_length` property is therefore ignored.
- String
  - Supports the `type` property that accepts `url` or `email` as a value, which will validate the value as a URL or email.
  - Supports the `prefix` and `suffix` string properties, which automatically prepend and/or append the developer-defined value to the user-input value.
- Boolean, Number and String
  - Supports the `before_input` and `after_input` string properties, which allow developers to display custom labels before and/or after the input UI[^28]. Markdown is supported in the value.
- List and Object
  - The `summary` is displayed correctly when it refers to a Relation field[^36].
- File and Image
  - Provides a reimagined all-in-one asset selection dialog for File and Image fields.
    - [Collection-specific assets](#use-a-custom-media-folder-for-a-collection) are listed for easy selection, while all assets are displayed in a separate tab[^19].
    - A new asset can be uploaded by dragging & dropping it into the dialog[^20].
    - A URL can also be entered in the dialog.
    - Integration with Pexels, Pixabay and Unsplash makes it easy to select and insert a free stock photo[^8].
- String, Text and Markdown
  - A required field containing only spaces or line breaks will result in a validation error, as if no characters were entered.
- New widgets
  - In addition to [generating UUIDs for entry slugs](#use-a-random-id-for-an-entry-slug), Sveltia CMS also supports the proposed `uuid` widget with the following properties[^12]:
    - `prefix`: A string to be prepended to the value. Default: an empty string.
    - `use_b32_encoding`: Whether to encode the value with Base32. Default: `false`.
    - `read_only`: Whether to make the field read-only. Default: `true`.
  - The experimental `compute` widget allows to reference the value of other fields in the same collection, similar to the `summary` property for the List and Object widgets. Use the `value` property to define the value template, e.g. `posts-{{fields.slug}}` ([example](https://github.com/sveltia/sveltia-cms/issues/111)).

### Better asset management

- A completely new Asset Library, built separately from the image selection dialog, makes it easy to manage all of your files, including images, videos and documents.
  - Navigate between the global media folder and per-collection media folders[^6].
  - Preview image, audio, video, text and PDF files.
    - Check your site’s [CSP](#set-up-content-security-policy) if the preview doesn’t work.
  - Copy the public URL, file path, text data or image data of a selected asset to clipboard.
    - The file path starts with `/` as expected[^48].
  - Edit plaintext assets, including SVG images.
  - Replace existing assets.
  - Download one or more selected assets at once.
  - Delete one or more selected assets at once.
  - Upload multiple assets at once, including files in nested folders, by browsing or dragging and dropping them into the library[^5].
  - Sort or filter assets by name or file type.
  - View asset details, including size, dimensions, commit author/date and a list of entries that use the selected asset.
- PDF documents are displayed with a thumbnail image in both the Asset Library and the Select File dialog, making it easier to find the file you’re looking for[^38].
- Assets stored in an entry-relative media folder are automatically deleted when the associated entry is deleted because these assets are not available for other entries[^22].
- Hidden files (dot files) don’t appear in the Asset Library[^47].

## Compatibility

While it’s not our goal to recreate all the features found in Netlify/Decap CMS, we plan to maximize compatibility before the 1.0 release so that more users can migrate to our modern alternative. The table below is a summary of the current limitations of Sveltia CMS:

| Feature | Status in Sveltia CMS |
| --- | --- |
| Installation | Installing with `npm` is not supported yet. |
| Backends | Only the GitHub and GitLab backends are available. We’ll add the Test backend for our demo site, but Azure, Bitbucket and Gitea are unlikely to be supported due to performance limitations. Git Gateway will not be supported for the same reason; we may implement a performant alternative sometime later. |
| UI Locales | Only English and Japanese are available at this time. |
| Media Libraries | External media storage services are not supported yet. We will add support for Cloudinary and Uploadcare soon. We will not support deprecated Netlify Large Media. |
| Workflow | Editorial Workflow and Open Authoring are not supported yet. |
| Collections | Nested collections are not supported yet. |
| Widgets | Custom widgets are not supported yet. [See below](#widget-limitations) for other limitations. |
| Customizations | Custom previews, custom formatters, manual initialization and event subscriptions are not supported yet. |

### Widget limitations

| Widget | Status in Sveltia CMS |
| --- | --- |
| Code | Not supported yet. |
| Date | Sveltia CMS has dropped the support for the deprecated widget following Decap CMS 3.0. Use the DateTime widget instead. |
| DateTime | The `date_format` and `time_format` options with Moment.js tokens are not supported yet. Note: Decap CMS 3.1 has replaced Moment.js with [Day.js](https://day.js.org/); we’ll follow the change soon. |
| File/Image | Field-specific media folders and media library options are not supported yet other than `media_library.config.max_file_size` for the default media library. |
| Map | Not supported yet. |
| Markdown | It’s a plain text editor at this time. A rich text editor is coming soon. We will not support Remark plugins. |

### Other features

- Comprehensive config validation is not implemented yet.
- Auto-saving a draft entry is not implemented yet.
- [Backend health check](https://www.githubstatus.com/api) is not implemented yet.

## Roadmap

### Before the 1.0 release

- [Svelte 5](https://svelte.dev/blog/runes) migration
- Automation test coverage
- Further Netlify/Decap CMS compatibility, including Editorial Workflow
- Localization
- Documentation
- Marketing site
- Demo site
- Starter templates

### After the 1.0 release

- Roles[^23]
- Config editor[^10]
- Mobile support[^18]
- and more!

## Getting started

### New users

Currently, Sveltia CMS is primarily intended for existing Netlify/Decap CMS users. If you don’t have it yet, follow [their documentation](https://decapcms.org/docs/basic-steps/) to add it to your site and create a configuration file first. Then migrate to Sveltia CMS as described below.

As the product evolves, we’ll implement a built-in configuration editor and provide comprehensive documentation to make it easier for everyone to get started with Sveltia CMS.

Here are some starter kits for popular frameworks created by community members. More to follow!

- [Eleventy starter template](https://github.com/danurbanowicz/eleventy-sveltia-cms-starter) by [@danurbanowicz](https://github.com/danurbanowicz)
- [Hugo module](https://github.com/privatemaker/headless-cms) by [@privatemaker](https://github.com/privatemaker)
- Astro: [astro-sveltia-cms](https://github.com/majesticostudio/astro-sveltia-cms), [astro-starter](https://github.com/zankhq/astro-starter) and [astros](https://github.com/zankhq/astros) by [@zanhk](https://github.com/zanhk)

Alternatively, you can probably use one of the [Netlify/Decap CMS templates](https://decapcms.org/docs/start-with-a-template/) and make a quick migration to Sveltia CMS.

### Migration

Have a look at the [compatibility chart](#compatibility) above first. If you’re already using Netlify/Decap CMS with the GitHub or GitLab backend and don’t have any custom widget, custom preview or plugin, migrating to Sveltia CMS is super easy. Edit `/admin/index.html` to replace the CMS `script` tag, and push the change to your repository.

From Netlify CMS:

```diff
-<script src="https://unpkg.com/netlify-cms@^2.0.0/dist/netlify-cms.js"></script>
+<script src="https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js" type="module"></script>
```

From Decap CMS:

```diff
-<script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
+<script src="https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js" type="module"></script>
```

That’s it! You can open `https://[hostname]/admin/` as before to start editing. There is even no authentication process if you’ve already been signed in with GitHub or GitLab on Netlify/Decap CMS because Sveltia CMS uses your auth token stored in the browser. Simple enough!

That said, we strongly recommend testing your new Sveltia CMS instance first on your local machine. [See below](#work-with-a-local-git-repository) for how.

## Tips & tricks

### Move your site from Netlify to another hosting service

You can host your Sveltia CMS-managed site anywhere, such as [Cloudflare Pages](https://pages.cloudflare.com/) or [GitHub Pages](https://pages.github.com/). But moving away from Netlify means you can no longer sign in with GitHub or GitLab via Netlify. Instead, you can use [our own OAuth client](https://github.com/sveltia/sveltia-cms-auth), which can be easily deployed to Cloudflare Workers, or [any other 3rd party client](https://decapcms.org/docs/external-oauth-clients/) made for Netlify/Decap CMS.

### Work with a local Git repository

You can use Sveltia CMS with a local Git repository like [Netlify/Decap CMS](https://decapcms.org/docs/working-with-a-local-git-repository/), but Sveltia CMS has simplified the workflow by removing the need for additional configuration (the `local_backend` property) and proxy server, thanks to the [File System Access API](https://developer.chrome.com/articles/file-system-access/) available in [some modern browsers](https://developer.mozilla.org/en-US/docs/web/api/window/showopenfilepicker#browser_compatibility).

1. Launch the local development server for your frontend framework, typically with `npm run dev` or `pnpm dev`.
1. Visit `http://localhost:[port]/admin/index.html` with Chrome or Edge. The port number varies by framework.
   - Other Chromium-based browsers may also work. In Brave, you need to enable the File System Access API [with a flag](https://github.com/brave/brave-browser/issues/20563#issuecomment-1021567573).
1. Click “Work with Local Repository” and select the project’s root directory once prompted.
   - If you get an error saying “not a repository root directory”, make sure you’ve turned the folder into a repository with either a CUI ([`git init`](https://github.com/git-guides/git-init)) or GUI, and the hidden `.git` folder exists.
   - If you’re using Windows Subsystem for Linux (WSL), you may get an error saying “Can’t open this folder because it contains system files.” This is due to a limitation in the browser, and you can try some workarounds mentioned in [this issue](https://github.com/coder/code-server/issues/4646) and [this thread](https://github.com/sveltia/sveltia-cms/discussions/101).
1. Make some changes to your content on Sveltia CMS.
1. See if the produced changes look good using `git diff` or a GUI like [GitHub Desktop](https://desktop.github.com/).
1. Open the dev site at `http://localhost:[port]/` to check the rendered pages.
1. Commit and push the changes if satisfied, or discard them if you’re just testing.

Remember that the local repository support doesn’t do any Git operation. You have to fetch, pull, commit and push all changes manually with a Git client. Also, at this point, you have to reload the CMS to see the latest content after retrieving remote updates (this will be unnecessary once browsers support the proposed `FileSystemObserver` API).

### Use a custom icon for a collection

You can have an icon for each collection for easy identification in the collection list.

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

### Use DeepL to translate entry fields

Sveltia CMS comes with a handy DeepL integration so that you can translate any text field from another locale without leaving the content editor. To enable the high-quality, quick translation feature:

1. Update your configuration file to enable the [i18n support](https://decapcms.org/docs/i18n/) with multiple locales.
1. Sign up for [DeepL API](https://www.deepl.com/pro-api/) and copy your Authentication Key from DeepL’s Account page.
1. Go back to Sveltia CMS, click on the Account button in the top right corner, then click Settings.
1. Paste your key to the DeepL API Authentication Key field, and close the Settings dialog.
1. Open any entry, and you can now translate all fields or individual fields by selecting Translate from the three-dot menu.
1. If you have upgraded to DeepL API Pro, provide your new Authentication Key in the same way.

### Disable non-default locale content

You can now disable output of content in selected non-default locales by adding the `save_all_locales` property to the top-level or per-collection `i18n` configuration. Then you’ll find “Disable (locale name)” in the three-dot menu in the top right corner of the content editor. This is useful if the translation isn’t ready yet, but you want to publish the default locale content first.

With the following configuration, you can disable the French and/or German translation while writing in English.

```diff
 i18n:
   structure: multiple_files
   locales: [en, fr, de]
   default_locale: en
+  save_all_locales: false
```

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

### Disable automatic deployments

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

### Set up Content Security Policy

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

And combine the following policies depending on your Git backend and enabled integrations.

- GitHub: (If you’re running GitHub Enterprise Server, you’ll also need to add the origin to these directives.)
  ```csp
  img-src https://*.githubusercontent.com;
  connect-src https://api.github.com https://www.githubstatus.com;
  ```
- GitLab: (If you’re running a self-hosted instance, you’ll also need to add the origin to these directives.)
  ```csp
  img-src https://gitlab.com https://secure.gravatar.com;
  connect-src https://gitlab.com;
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

If you choose to [disable automatic deployments](#disable-automatic-deployments) and have configured a webhook URL, you may need to add the origin to the `connect-src` directive. For example,

- Netlify:
  ```csp
  connect-src https://api.netlify.com;
  ```
- Cloudflare Pages
  ```csp
  connect-src https://api.cloudflare.com;
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

Want to build a website with Sveltia CMS? Maintainer [@kyoshino](https://github.com/kyoshino) is available for hire depending on your requirements.

## Contributions

Since Sveltia CMS is still in beta, we expect various problems. Please [report any bugs to us](https://github.com/sveltia/sveltia-cms/issues/new) so we can make it better for everyone. Feel free to submit feature requests as well. Meanwhile, pull requests may not be accepted for the time being due to limited review resources and the upcoming Svelte 5 migration. As we get closer to the 1.0 release, we’ll be welcoming [localizers](https://github.com/sveltia/sveltia-cms/blob/main/src/lib/locales/README.md).

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
[^7]: Netlify/Decap CMS [#4386](https://github.com/decaporg/decap-cms/issues/4386), [#6978](https://github.com/decaporg/decap-cms/issues/6978)
[^8]: Netlify/Decap CMS [#2579](https://github.com/decaporg/decap-cms/issues/2579)
[^9]: Netlify/Decap CMS [#3505](https://github.com/decaporg/decap-cms/issues/3505)
[^10]: Netlify/Decap CMS [#341](https://github.com/decaporg/decap-cms/issues/341), [#1167](https://github.com/decaporg/decap-cms/issues/1167)
[^11]: Netlify/Decap CMS [#1382](https://github.com/decaporg/decap-cms/issues/1382), [#6994](https://github.com/decaporg/decap-cms/issues/6994)
[^12]: Netlify/Decap CMS [#1975](https://github.com/decaporg/decap-cms/issues/1975)
[^13]: Netlify/Decap CMS [#5112](https://github.com/decaporg/decap-cms/issues/5112), [#5653](https://github.com/decaporg/decap-cms/issues/5653)
[^14]: Netlify/Decap CMS [#4635](https://github.com/decaporg/decap-cms/issues/4635), [#4738](https://github.com/decaporg/decap-cms/issues/4738), [#5920](https://github.com/decaporg/decap-cms/issues/5920), [#6410](https://github.com/decaporg/decap-cms/issues/6410)
[^15]: Netlify/Decap CMS [#6932](https://github.com/decaporg/decap-cms/issues/6932)
[^16]: Netlify/Decap CMS [#2103](https://github.com/decaporg/decap-cms/issues/2103)
[^17]: Netlify/Decap CMS [#1333](https://github.com/decaporg/decap-cms/issues/1333), [#7077](https://github.com/decaporg/decap-cms/issues/7077)
[^18]: Netlify/Decap CMS [#441](https://github.com/decaporg/decap-cms/issues/441)
[^19]: Netlify/Decap CMS [#5910](https://github.com/decaporg/decap-cms/issues/5910)
[^20]: Netlify/Decap CMS [#4563](https://github.com/decaporg/decap-cms/issues/4563)
[^21]: Netlify/Decap CMS [#4781](https://github.com/decaporg/decap-cms/issues/4781)
[^22]: Netlify/Decap CMS [#6642](https://github.com/decaporg/decap-cms/issues/6642)
[^23]: Netlify/Decap CMS [#2](https://github.com/decaporg/decap-cms/issues/2)
[^24]: Netlify/Decap CMS [#6831](https://github.com/decaporg/decap-cms/issues/6831)
[^25]: Netlify/Decap CMS [#526](https://github.com/decaporg/decap-cms/issues/526), [#6987](https://github.com/decaporg/decap-cms/issues/6987)
[^26]: Netlify/Decap CMS [#3285](https://github.com/decaporg/decap-cms/issues/3285)
[^27]: Netlify/Decap CMS [#3285](https://github.com/decaporg/decap-cms/issues/5617)
[^28]: Netlify/Decap CMS [#6836](https://github.com/decaporg/decap-cms/pull/6836)
[^29]: Netlify/Decap CMS [#4783](https://github.com/decaporg/decap-cms/issues/4783)
[^30]: Netlify/Decap CMS [#565](https://github.com/decaporg/decap-cms/issues/565)
[^31]: Netlify/Decap CMS [#1045](https://github.com/decaporg/decap-cms/issues/1045), [#3353](https://github.com/decaporg/decap-cms/issues/3353)
[^32]: Netlify/Decap CMS [#302](https://github.com/decaporg/decap-cms/issues/302), [#5549](https://github.com/decaporg/decap-cms/issues/5549)
[^33]: Netlify/Decap CMS [#6513](https://github.com/decaporg/decap-cms/issues/6513)
[^34]: Netlify/Decap CMS [#2138](https://github.com/decaporg/decap-cms/issues/2138)
[^35]: Netlify/Decap CMS [#7086](https://github.com/decaporg/decap-cms/issues/7086)
[^36]: Netlify/Decap CMS [#6325](https://github.com/decaporg/decap-cms/issues/6325)
[^37]: Netlify/Decap CMS [#1481](https://github.com/decaporg/decap-cms/issues/1481)
[^38]: Netlify/Decap CMS [#1984](https://github.com/decaporg/decap-cms/issues/1984)
[^39]: Netlify/Decap CMS [#946](https://github.com/decaporg/decap-cms/issues/946)
[^40]: Netlify/Decap CMS [#5630](https://github.com/decaporg/decap-cms/issues/5630)
[^41]: Netlify/Decap CMS [#7011](https://github.com/decaporg/decap-cms/issues/7011)
[^42]: Netlify/Decap CMS [#2307](https://github.com/decaporg/decap-cms/issues/2307)
[^43]: Netlify/Decap CMS [#5381](https://github.com/decaporg/decap-cms/issues/5381)
[^44]: Netlify/Decap CMS [#2613](https://github.com/decaporg/decap-cms/issues/2613)
[^45]: Netlify/Decap CMS [#1424](https://github.com/decaporg/decap-cms/issues/1424)
[^46]: Netlify/Decap CMS [#4726](https://github.com/decaporg/decap-cms/issues/4726)
[^47]: Netlify/Decap CMS [#2370](https://github.com/decaporg/decap-cms/issues/2370), [#5596](https://github.com/decaporg/decap-cms/issues/5596)
[^48]: Netlify/Decap CMS [#5569](https://github.com/decaporg/decap-cms/issues/5569)
[^49]: Netlify/Decap CMS [#5752](https://github.com/decaporg/decap-cms/issues/5752)
[^50]: Netlify/Decap CMS [#4646](https://github.com/decaporg/decap-cms/issues/4646)
[^51]: Netlify/Decap CMS [#6731](https://github.com/decaporg/decap-cms/issues/6731)
