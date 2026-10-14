<script>
  import { _ } from '@sveltia/i18n';
  import { Button, ConfirmationDialog } from '@sveltia/ui';

  import { clearFileCache, eraseAllData } from '$lib/services/app/cache';

  let showClearCacheDialog = $state(false);
  let showEraseDataDialog = $state(false);

  /* v8 ignore start -- reloading the page would tear the test down */
  /**
   * Clear the file cache, then reload the page to start over.
   */
  const clearCache = async () => {
    await clearFileCache();
    window.location.reload();
  };

  /**
   * Erase all the data stored in the browser, then reload the page to start over.
   */
  const eraseData = async () => {
    await eraseAllData();
    window.location.reload();
  };
  /* v8 ignore stop */
</script>

<section>
  <h3>
    {_('prefs.data.clear_data.title')}
  </h3>
  <p>
    {_('prefs.data.clear_data.file_cache.description')}
  </p>
  <div role="none">
    <Button
      variant="tertiary"
      label={_('prefs.data.clear_data.file_cache.button_label')}
      onclick={() => {
        showClearCacheDialog = true;
      }}
    />
  </div>
  <p>
    {_('prefs.data.clear_data.all_data.description')}
  </p>
  <div role="none">
    <Button
      variant="tertiary"
      label={_('prefs.data.clear_data.all_data.button_label')}
      onclick={() => {
        showEraseDataDialog = true;
      }}
    />
  </div>
</section>

<ConfirmationDialog
  bind:open={showClearCacheDialog}
  title={_('prefs.data.clear_data.file_cache.button_label')}
  okLabel={_('prefs.data.clear_data.file_cache.button_label')}
  onOk={clearCache}
>
  {_('prefs.data.clear_data.file_cache.confirmation')}
</ConfirmationDialog>

<ConfirmationDialog
  bind:open={showEraseDataDialog}
  title={_('prefs.data.clear_data.all_data.button_label')}
  okLabel={_('prefs.data.clear_data.all_data.button_label')}
  onOk={eraseData}
>
  {_('prefs.data.clear_data.all_data.confirmation')}
</ConfirmationDialog>
