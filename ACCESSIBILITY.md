# Accessibility

Sveltia CMS is meant to be usable by everyone who edits content, however they work: with a keyboard, a screen reader, voice control, a touchscreen or a mouse. This document describes what we aim for, what you can expect today, and how to tell us when something gets in your way.

## Goals

We work toward [Web Content Accessibility Guidelines (WCAG) 2.2](https://w3c.github.io/wcag/guidelines/22/) Level AA. This is our target, not a claim of conformance: we have run an automated self-audit, and our end-to-end tests scan the main screens with [axe](https://github.com/dequelabs/axe-core). Neither can find every barrier, and we continue to test and improve the application.

Our priorities are the tasks people come to the CMS for: signing in; finding, creating and editing entries; managing assets; and saving or publishing changes. We treat a barrier in any of these as a bug, not as a feature request.

## What’s Available Today

More details are available in the [accessibility section](https://sveltiacms.app/en/docs/ui#accessibility) of the documentation.

- **Keyboard:** The UI can be navigated with the Tab, Space, Enter and arrow keys, and common actions have [keyboard shortcuts](https://sveltiacms.app/en/docs/ui#keyboard-shortcuts). Features that use drag-and-drop, such as reordering list items, have a keyboard alternative. Our [UI component library](https://github.com/sveltia/sveltia-ui) is built with keyboard use in mind.
- **Screen readers:** The UI uses [WAI-ARIA](https://w3c.github.io/aria/) roles and labels, and page changes are announced when you navigate.
- **Rich text editor:** The editor is built with [Lexical](https://lexical.dev/), which follows accessibility best practices and includes support for Dragon NaturallySpeaking.
- **Visual design:** We aim for sufficient contrast between text and background colours. Links are underlined by default; you can turn this off in the Accessibility panel of the Settings dialog.
- **System preferences:** The CMS honours the reduced motion, reduced transparency and increased contrast settings of your operating system.
- **Screen sizes:** The UI is responsive and works on smartphones and tablets as well as on desktop.

## Supported Environments

- **Browsers:** The CMS supports the modern browsers listed under [Supported Browsers](https://sveltiacms.app/en/docs/ui#supported-browsers) in the documentation. We recommend the latest version.
- **Assistive technology:** We have NVDA and VoiceOver in mind when building the UI. If you use something else and run into a problem, please report it all the same.
- **Versions:** We only maintain the latest version of Sveltia CMS, so accessibility fixes aren’t backported. See our [security policy](SECURITY.md#supported-versions) for details.

## Known Limitations

- Our audit so far has been automated and self-run. The CMS hasn’t been independently audited, so there are likely barriers we don’t know about.
- On macOS, holding the Option key in a text field types a special character, so `Alt` shortcuts like `Alt+1` don’t work while a text field has focus. Move the focus out of the text field first.
- Browser pinch-zoom is turned off on many touch devices because we plan to add pinch-zoom to the app itself. Until then, use your browser’s zoom setting or the text size setting of your device.
- We have no styles of our own for forced colours mode, such as Windows Contrast Themes, so the browser’s defaults apply.
- We can only speak for the CMS itself. The accessibility of custom preview templates, custom fields and other extensions added to a site is up to the site’s developers.

Accessibility issues are tracked with the [`a11y` label](https://github.com/sveltia/sveltia-cms/issues?q=label%3Aa11y).

## Reporting a Barrier

If something in Sveltia CMS is difficult or impossible for you to use, please [create an issue](https://github.com/sveltia/sveltia-cms/issues/new?type=bug) on GitHub. If you’d rather not use GitHub, you can email us at [hello@sveltia.dev](mailto:hello@sveltia.dev).

It helps to know the following, but share only what you’re comfortable with:

- What you were trying to do and what happened instead
- Your operating system and browser
- Any assistive technology you use, and its version

You never need to tell us about a disability or a diagnosis, and you don’t need to include screenshots or recordings.

## How We Respond

Sveltia CMS has a very small team, so we can’t promise fixed deadlines, but here is what you can expect:

- We read every report and label accessibility issues with `a11y`.
- We fix issues that stop people from completing a task before anything else, and we suggest a workaround if we know one.
- We handle accessibility issues like other bugs, which we [usually fix within hours](CONTRIBUTING.md#bug-reports). A complex issue can take longer, in which case we keep the issue updated.

## Contributing

We [don’t accept pull requests](CONTRIBUTING.md#pull-requests) for the time being, except for localization and trivial changes, so the most useful contribution is a report. The following applies to those changes and to our own work, whether written by people or by coding agents:

- Use the components of [Sveltia UI](https://github.com/sveltia/sveltia-ui) rather than custom controls, and give every control an accessible name.
- Make sure a change can be used with the keyboard alone, and that the focus stays where it’s expected.
- Don’t convey information by colour or motion alone.
- In component tests, find elements by their role and accessible name, as a person using assistive technology would.
- In localization files, translate accessible names as carefully as visible text, because they’re what screen readers read out.

## Ownership and Feedback

The maintainers of Sveltia CMS are responsible for this document and review it when accessibility-related behaviour changes. If anything here is wrong or out of date, or you have a suggestion, please [start a discussion](https://github.com/sveltia/sveltia-cms/discussions) or [create an issue](https://github.com/sveltia/sveltia-cms/issues/new?type=bug).
