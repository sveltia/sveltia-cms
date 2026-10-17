import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lockedBranch, mergeLockedBranch, recordBranchAccess } from './branch-access';

describe('recordBranchAccess()', () => {
  beforeEach(() => {
    lockedBranch.current = 'stale';
    mergeLockedBranch.current = 'stale';
  });

  it('locks the branch the user can’t push to or merge into', async () => {
    const fetchAccess = vi.fn().mockResolvedValue({ canPush: false, canMerge: false });

    await recordBranchAccess('main', fetchAccess);

    expect(fetchAccess).toHaveBeenCalledWith('main');
    expect(lockedBranch.current).toBe('main');
    expect(mergeLockedBranch.current).toBe('main');
  });

  it('unlocks the branch the user can push to and merge into', async () => {
    await recordBranchAccess('main', vi.fn().mockResolvedValue({ canPush: true, canMerge: true }));

    expect(lockedBranch.current).toBeUndefined();
    expect(mergeLockedBranch.current).toBeUndefined();
  });

  it('assumes a permission the backend doesn’t tell', async () => {
    await recordBranchAccess('main', vi.fn().mockResolvedValue({ canPush: false }));

    expect(lockedBranch.current).toBe('main');
    expect(mergeLockedBranch.current).toBeUndefined();
  });

  it('leaves the branch unlocked if the request fails', async () => {
    await recordBranchAccess('main', vi.fn().mockRejectedValue(new Error('Network error')));

    expect(lockedBranch.current).toBeUndefined();
    expect(mergeLockedBranch.current).toBeUndefined();
  });

  it('doesn’t fetch anything without a branch', async () => {
    const fetchAccess = vi.fn();

    await recordBranchAccess(undefined, fetchAccess);

    expect(fetchAccess).not.toHaveBeenCalled();
    expect(lockedBranch.current).toBeUndefined();
    expect(mergeLockedBranch.current).toBeUndefined();
  });
});
