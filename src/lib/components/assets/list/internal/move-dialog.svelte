<!--
  @component
  Move dialog of the Asset Library, opened for the files set as `assetMoveRequest`: repository
  assets, or files on a cloud storage service. They are moved to the folder picked in the tree, or
  the one they have been dropped on, which can be in the repository or on a cloud storage service,
  and the entries using them are updated.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog, Tree } from '@sveltia/ui';

  import MoveDestinationTreeItem from '$lib/components/assets/list/internal/move-destination-tree-item.svelte';
  import { runAssetCommit } from '$lib/services/assets/data/commit';
  import { getMoveBlockedMessage } from '$lib/services/assets/data/move';
  import {
    findAssetMoveDestination,
    getAssetMoveDestinations,
    getMoveDestinationKey,
  } from '$lib/services/assets/data/move-destinations';
  import {
    followMovedAssets,
    getMoveRequestUsedEntries,
    getMoveSummary,
    moveToDestination,
  } from '$lib/services/assets/data/transfer';
  import { getExternalMoveDestinations } from '$lib/services/assets/external/destinations';
  import { assetMoveRequest } from '$lib/services/assets/state';
  import { createUsedEntriesState } from '$lib/services/assets/used-entries.svelte';
  import { watchAsync } from '$lib/services/utils/state.svelte';

  /**
   * @import { AssetMoveDestination } from '$lib/types/private';
   */

  let open = $state(false);
  /**
   * Cloud storage services, each with its folders, which are listed once the dialog has opened.
   * @type {AssetMoveDestination[]}
   */
  let externalDestinations = $state.raw([]);
  /** @type {AssetMoveDestination | undefined} */
  let destination = $state.raw();

  const request = $derived(assetMoveRequest.current);
  /* v8 ignore start -- these are only read while the dialog is open, which takes a request */
  const count = $derived((request?.assets ?? request?.externalAssets ?? []).length);
  const firstName = $derived(
    request?.assets?.[0]?.name ?? request?.externalAssets?.[0]?.fileName ?? '',
  );
  const title = $derived(_('move_assets_title', { values: { count, name: firstName } }));
  const destinations = $derived(
    request ? [...getAssetMoveDestinations(), ...externalDestinations] : [],
  );
  /* v8 ignore stop */
  /**
   * Select the folder picked up front, by dropping the files on it, once it’s in the tree.
   */
  const selectRequestedDestination = () => {
    if (request?.dirPath !== undefined && !destination) {
      destination = findAssetMoveDestination(destinations, request.dirPath, request.serviceId);
    }
  };

  /**
   * Entries using the files, found before the dialog opens, so it can tell how many will be
   * updated. Another request can come in before they are found, which the state takes care of.
   */
  const usedEntries = createUsedEntriesState(
    () => (request ? getMoveRequestUsedEntries(request) : undefined),
    () => {
      destination = undefined;
      // A folder at the repository root has an empty path
      selectRequestedDestination();
      open = true;
    },
  );

  const summary = $derived(
    request && destination
      ? getMoveSummary(request, destination)
      : { movableCount: 0, conflicts: /** @type {string[]} */ ([]) },
  );
  // A read-only entry using the files can’t be updated along with the move, so the move is refused
  // up front rather than when it’s about to be committed
  const blockedMessage = $derived(getMoveBlockedMessage(usedEntries.entries ?? []));
  const error = $derived(
    summary.conflicts.length
      ? _('asset_move_conflict', { values: { names: summary.conflicts.join(', ') } })
      : undefined,
  );

  /**
   * Move the files to the selected folder, then update the details view if it shows one of them.
   */
  const move = async () => {
    /* v8 ignore next 3 -- the OK button is disabled until a folder is selected */
    if (!request || !destination) {
      return;
    }

    // Kept, as closing the dialog lets go of the request. Not a snapshot, which would clone the
    // service, whose methods can’t be cloned
    const _request = request;
    const _destination = destination;

    const { ok } = await runAssetCommit(() => moveToDestination(_request, _destination), {
      progress: 'moving_assets',
      failure: 'moving_assets_failed',
    });

    if (ok) {
      await followMovedAssets(_request, _destination);
    }
  };

  // List the cloud storage services alongside, which takes a request to each one that isn’t
  // being browsed
  watchAsync(
    () => {
      // Let go of the folders listed for an earlier request, which may have changed since
      externalDestinations = [];

      return request ? getExternalMoveDestinations() : undefined;
    },
    (result) => {
      externalDestinations = result;
      selectRequestedDestination();
    },
  );
</script>

<Dialog
  {title}
  bind:open
  okLabel={_('move')}
  okDisabled={!!blockedMessage || !summary.movableCount || !!error}
  onOk={() => {
    // Don’t wait for the commit; the toast reports how it goes
    move();
  }}
  onClose={() => {
    assetMoveRequest.current = undefined;
  }}
>
  {#if blockedMessage}
    <p role="alert">{blockedMessage}</p>
  {:else}
    <p>
      {_('select_asset_move_destination', { values: { count: usedEntries.entries?.length ?? 0 } })}
    </p>
    <Tree ariaLabel={_('asset_move_destination')} class="destination-tree">
      {#each destinations as item (getMoveDestinationKey(item))}
        <MoveDestinationTreeItem
          destination={item}
          selectedDestination={destination}
          onSelectDestination={(selected) => {
            destination = selected;
          }}
        />
      {/each}
    </Tree>
    <div role="alert" class={['message', { error: !!error }]}>
      {#if error}
        {error}
      {:else if destination && !summary.movableCount}
        {_('assets_already_in_folder', { values: { count } })}
      {/if}
    </div>
  {/if}
</Dialog>

<style>
  p {
    margin: 0 0 8px;
  }

  .message {
    margin: 8px 0 0;
    min-height: 1lh;
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);

    &.error {
      color: var(--sui-error-foreground-color);
    }
  }

  :global(.destination-tree) {
    border: 1px solid var(--sui-control-border-color);
    border-radius: var(--sui-control-medium-border-radius);
    max-height: 50vh;
    overflow: auto;
  }
</style>
