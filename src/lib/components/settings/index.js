import { derived } from 'svelte/store';

import AccessibilityPanel from '$lib/components/settings/panels/accessibility-panel.svelte';
import AdvancedPanel from '$lib/components/settings/panels/advanced-panel.svelte';
import AppearancePanel from '$lib/components/settings/panels/appearance-panel.svelte';
import ContentsPanel from '$lib/components/settings/panels/contents-panel.svelte';
import I18nPanel from '$lib/components/settings/panels/i18n-panel.svelte';
import LanguagePanel from '$lib/components/settings/panels/language-panel.svelte';
import MediaPanel from '$lib/components/settings/panels/media-panel.svelte';
import { siteConfig } from '$lib/services/config';

/**
 * @import { Component } from 'svelte';
 */

/**
 * @type {import('svelte/store').Readable<{ key: string, icon: string, component: Component,
 * enabled?: boolean }[]>}
 */
export const panels = derived([siteConfig], ([_siteConfig]) => [
  { key: 'appearance', icon: 'palette', component: AppearancePanel },
  { key: 'language', icon: 'language', component: LanguagePanel },
  { key: 'contents', icon: 'library_books', component: ContentsPanel },
  {
    key: 'i18n',
    icon: 'translate',
    component: I18nPanel,
    enabled: (_siteConfig?.i18n?.locales?.length ?? 0) > 1,
  },
  { key: 'media', icon: 'photo_library', component: MediaPanel },
  { key: 'accessibility', icon: 'accessibility_new', component: AccessibilityPanel },
  { key: 'advanced', icon: 'build', component: AdvancedPanel },
]);
