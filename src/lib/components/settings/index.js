import AccessibilityPanel from '$lib/components/settings/panels/accessibility-panel.svelte';
import AdvancedPanel from '$lib/components/settings/panels/advanced-panel.svelte';
import AppearancePanel from '$lib/components/settings/panels/appearance-panel.svelte';
import ContentsPanel from '$lib/components/settings/panels/contents-panel.svelte';
import LanguagePanel from '$lib/components/settings/panels/language-panel.svelte';
import MediaPanel from '$lib/components/settings/panels/media-panel.svelte';

/** @type {{ key: string, icon: string, component: import('svelte').Component }[]} */
export const panels = [
  { key: 'appearance', icon: 'palette', component: AppearancePanel },
  { key: 'language', icon: 'language', component: LanguagePanel },
  { key: 'contents', icon: 'library_books', component: ContentsPanel },
  { key: 'media', icon: 'photo_library', component: MediaPanel },
  { key: 'accessibility', icon: 'accessibility_new', component: AccessibilityPanel },
  { key: 'advanced', icon: 'build', component: AdvancedPanel },
];
