// Unmount every rendered component after each test
import 'vitest-browser-svelte';

import { addMessages, init } from '@sveltia/i18n';
import { AppShell } from '@sveltia/ui';
import componentStrings from '@sveltia/ui/locales/en-US.yaml';
import { mount } from 'svelte';

import appStrings from '$lib/locales/en-US.yaml';

// Load the app’s default locale strings the way `initAppLocale()` does, so a component test can
// find an element by the text a user sees rather than by a message key
addMessages('en-US', { ...appStrings, _sui: componentStrings });
init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });

// The Sveltia UI components take their colors and sizes from the custom properties the app shell
// defines on the document, and a widget without a size is invisible to the browser. Mounting the
// shell adds its global styles to the document, which is all a test needs; its own element, which
// would cover the page, is left out of the DOM
mount(AppShell, { target: document.createElement('div') });
