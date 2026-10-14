import AccessibilityPanel from '$lib/components/settings/panels/accessibility-panel.svelte';
import AppearancePanel from '$lib/components/settings/panels/appearance-panel.svelte';
import ContentsPanel from '$lib/components/settings/panels/contents-panel.svelte';
import DataPanel from '$lib/components/settings/panels/data-panel.svelte';
import DeveloperPanel from '$lib/components/settings/panels/developer-panel.svelte';
import I18nPanel from '$lib/components/settings/panels/i18n-panel.svelte';
import LanguagePanel from '$lib/components/settings/panels/language-panel.svelte';
import MediaPanel from '$lib/components/settings/panels/media-panel.svelte';
import { cmsConfig } from '$lib/services/config';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * @import { Component } from 'svelte';
 */

/**
 * Settings panels. A panel with `enabled: false` is hidden.
 * @type {{ readonly current: { key: string, icon: string, component: Component,
 * enabled?: boolean }[] }}
 */
export const panels = createDerivedState(() => [
  { key: 'appearance', icon: 'palette', component: AppearancePanel },
  { key: 'language', icon: 'language', component: LanguagePanel },
  { key: 'contents', icon: 'library_books', component: ContentsPanel },
  {
    key: 'i18n',
    icon: 'translate',
    component: I18nPanel,
    enabled: (cmsConfig.current?.i18n?.locales?.length ?? 0) > 1,
  },
  { key: 'media', icon: 'photo_library', component: MediaPanel },
  { key: 'accessibility', icon: 'accessibility_new', component: AccessibilityPanel },
  { key: 'developer', icon: 'code_xml', component: DeveloperPanel },
  { key: 'data', icon: 'database', component: DataPanel },
]);
