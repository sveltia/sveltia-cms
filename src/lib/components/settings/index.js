import AccessibilityPanel from '$lib/components/settings/panels/accessibility-panel.svelte';
import AiPanel from '$lib/components/settings/panels/ai-panel.svelte';
import AppearancePanel from '$lib/components/settings/panels/appearance-panel.svelte';
import ContentsPanel from '$lib/components/settings/panels/contents-panel.svelte';
import DataPanel from '$lib/components/settings/panels/data-panel.svelte';
import DeveloperPanel from '$lib/components/settings/panels/developer-panel.svelte';
import I18nPanel from '$lib/components/settings/panels/i18n-panel.svelte';
import LanguagePanel from '$lib/components/settings/panels/language-panel.svelte';
import MediaPanel from '$lib/components/settings/panels/media-panel.svelte';
import { getAdditions } from '$lib/services/app/additions';
import { backendName } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * @import { Component } from 'svelte';
 */

/**
 * Settings panels available with the current configuration. The settings dialog and page both list
 * these, so a panel left out, like Internationalization for a monolingual site, can’t be reached
 * through either of them, not even by URL. The Account panel comes with Sveltia CMS Additions,
 * whose chunk holds it, for a user signed in to it rather than working with a local repository.
 * @type {{ readonly current: { key: string, icon: string, component: Component }[] }}
 */
export const panels = createDerivedState(() => {
  const additions = getAdditions();

  return [
    ...(additions && backendName.current !== 'local'
      ? [{ key: 'account', icon: 'account_circle', component: additions.AccountPanel }]
      : []),
    { key: 'appearance', icon: 'palette', component: AppearancePanel },
    { key: 'language', icon: 'language', component: LanguagePanel },
    { key: 'contents', icon: 'library_books', component: ContentsPanel },
    ...((cmsConfig.current?.i18n?.locales?.length ?? 0) > 1
      ? [{ key: 'i18n', icon: 'translate', component: I18nPanel }]
      : []),
    { key: 'media', icon: 'photo_library', component: MediaPanel },
    { key: 'ai', icon: 'auto_awesome', component: AiPanel },
    { key: 'accessibility', icon: 'accessibility_new', component: AccessibilityPanel },
    { key: 'developer', icon: 'code_xml', component: DeveloperPanel },
    { key: 'data', icon: 'database', component: DataPanel },
  ];
});
