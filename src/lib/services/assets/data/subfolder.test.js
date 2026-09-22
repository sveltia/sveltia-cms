import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSubfolder,
  deleteSubfolder,
  getSubfolderAssets,
  GITKEEP_FILE_NAME,
  renameSubfolder,
} from './subfolder.js';

vi.mock('$lib/services/assets/subfolders', () => ({
  focusedSubfolder: { current: undefined },
}));

vi.mock('$lib/services/assets', () => ({
  publishedAssets: { current: [] },
}));

vi.mock('$lib/services/assets/data', () => ({
  assetUpdatesToast: { current: undefined },
}));

vi.mock('$lib/services/assets/data/delete', () => ({
  deleteAssets: vi.fn(),
}));

vi.mock('$lib/services/assets/data/move', () => ({
  moveAssets: vi.fn(),
}));

vi.mock('$lib/services/backends/git/shared/config', () => ({
  gitConfigFiles: { current: [] },
}));

vi.mock('$lib/services/backends/save', () => ({
  saveChanges: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/data', () => ({
  UPDATE_TOAST_DEFAULT_STATE: {
    saved: false,
    published: false,
    deleted: false,
    count: 1,
  },
}));

/** @type {any[]} */
const assets = [
  { path: 'static/images/hero.png', name: 'hero.png', sha: 'h' },
  { path: 'static/images/2024/spring.png', name: 'spring.png', sha: 's' },
  { path: 'static/images/2024/summer/beach.png', name: 'beach.png', sha: 'b' },
  { path: 'static/images/2024-old/x.png', name: 'x.png', sha: 'x' },
];

/** @type {any[]} */
const configFiles = [
  { type: 'config', path: '.gitattributes', name: '.gitattributes', sha: 'a', size: 10 },
  {
    type: 'config',
    path: 'static/images/2024/empty/.gitkeep',
    name: '.gitkeep',
    sha: 'k',
    size: 0,
  },
  {
    type: 'config',
    path: 'static/images/2024/.gitignore',
    name: '.gitignore',
    sha: 'i',
    size: 5,
    text: '*.tmp',
  },
  { type: 'config', path: 'static/images/2024-old/.gitkeep', name: '.gitkeep', sha: 'o', size: 0 },
];

describe('assets/data/subfolder', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { gitConfigFiles } = await import('$lib/services/backends/git/shared/config');
    const { publishedAssets } = await import('$lib/services/assets');

    gitConfigFiles.current = [
      { type: 'config', path: '.gitattributes', name: '.gitattributes', sha: 'a', size: 10 },
    ];
    /** @type {any} */ (publishedAssets).current = assets;
  });

  describe('getSubfolderAssets', () => {
    it('should list the assets below the folder at any depth, and no other', () => {
      expect(getSubfolderAssets('static/images/2024')).toEqual([assets[1], assets[2]]);
      expect(getSubfolderAssets('static/images/2024/summer')).toEqual([assets[2]]);
      expect(getSubfolderAssets('static/images/2025')).toEqual([]);
    });
  });

  describe('renameSubfolder', () => {
    it('should move the assets and the Git config files below the folder in one commit', async () => {
      const { moveAssets } = await import('$lib/services/assets/data/move');
      const { gitConfigFiles } = await import('$lib/services/backends/git/shared/config');
      const { assetUpdatesToast } = await import('$lib/services/assets/data');

      gitConfigFiles.current = configFiles;
      vi.mocked(moveAssets).mockResolvedValue(undefined);

      await renameSubfolder({ dirPath: 'static/images/2024', newDirPath: 'static/images/2025' });

      expect(moveAssets).toHaveBeenCalledOnce();

      const [action, movingAssets, options] = vi.mocked(moveAssets).mock.calls[0];

      expect(action).toBe('move');
      expect(movingAssets).toEqual([
        { asset: assets[1], path: 'static/images/2025/spring.png' },
        { asset: assets[2], path: 'static/images/2025/summer/beach.png' },
      ]);
      // The move is reported as a folder rename, not as so many assets moved
      expect(options?.notify).toBe(false);
      expect(options?.extraChanges).toHaveLength(2);
      expect(options?.extraChanges?.[0]).toEqual({
        action: 'move',
        path: 'static/images/2025/empty/.gitkeep',
        previousPath: 'static/images/2024/empty/.gitkeep',
        previousSha: 'k',
        data: expect.any(File),
      });
      // A config file with content keeps it
      await expect(
        /** @type {File} */ (/** @type {any} */ (options).extraChanges[1].data).text(),
      ).resolves.toBe('*.tmp');

      // The config files are listed at their new paths, the others left alone
      expect(gitConfigFiles.current.map(({ path }) => path)).toEqual([
        '.gitattributes',
        'static/images/2025/empty/.gitkeep',
        'static/images/2025/.gitignore',
        'static/images/2024-old/.gitkeep',
      ]);
      expect(assetUpdatesToast.current).toMatchObject({ folderRenamed: true });
    });

    it('should keep the sidebar on the folder under its new name', async () => {
      const { moveAssets } = await import('$lib/services/assets/data/move');
      const { focusedSubfolder } = await import('$lib/services/assets/subfolders');

      vi.mocked(moveAssets).mockResolvedValue(undefined);

      // Another folder is left alone
      focusedSubfolder.current = { name: '2024-old', path: 'static/images/2024-old' };
      await renameSubfolder({ dirPath: 'static/images/2024', newDirPath: 'static/images/2025' });
      expect(focusedSubfolder.current).toEqual({
        name: '2024-old',
        path: 'static/images/2024-old',
      });

      focusedSubfolder.current = { name: '2024', path: 'static/images/2024' };
      await renameSubfolder({ dirPath: 'static/images/2024', newDirPath: 'static/images/2025' });
      expect(focusedSubfolder.current).toEqual({ name: '2025', path: 'static/images/2025' });
    });

    it('should leave the file list alone when the commit fails', async () => {
      const { moveAssets } = await import('$lib/services/assets/data/move');
      const { gitConfigFiles } = await import('$lib/services/backends/git/shared/config');

      gitConfigFiles.current = configFiles;
      vi.mocked(moveAssets).mockRejectedValue(new Error('offline'));

      await expect(
        renameSubfolder({ dirPath: 'static/images/2024', newDirPath: 'static/images/2025' }),
      ).rejects.toThrow('offline');
      expect(gitConfigFiles.current).toBe(configFiles);
    });
  });

  describe('deleteSubfolder', () => {
    it('should delete the assets and the Git config files below the folder in one commit', async () => {
      const { deleteAssets } = await import('$lib/services/assets/data/delete');
      const { gitConfigFiles } = await import('$lib/services/backends/git/shared/config');
      const { assetUpdatesToast } = await import('$lib/services/assets/data');

      gitConfigFiles.current = configFiles;
      vi.mocked(deleteAssets).mockResolvedValue(undefined);

      await deleteSubfolder('static/images/2024');

      expect(deleteAssets).toHaveBeenCalledWith([assets[1], assets[2]], {
        extraChanges: [
          { action: 'delete', path: 'static/images/2024/empty/.gitkeep', previousSha: 'k' },
          { action: 'delete', path: 'static/images/2024/.gitignore', previousSha: 'i' },
        ],
        notify: false,
      });
      expect(gitConfigFiles.current.map(({ path }) => path)).toEqual([
        '.gitattributes',
        'static/images/2024-old/.gitkeep',
      ]);
      expect(assetUpdatesToast.current).toMatchObject({ folderDeleted: true });
    });

    it('should delete an empty folder', async () => {
      const { deleteAssets } = await import('$lib/services/assets/data/delete');
      const { gitConfigFiles } = await import('$lib/services/backends/git/shared/config');

      gitConfigFiles.current = configFiles;
      vi.mocked(deleteAssets).mockResolvedValue(undefined);

      await deleteSubfolder('static/images/2024/empty');

      expect(deleteAssets).toHaveBeenCalledWith([], {
        extraChanges: [
          { action: 'delete', path: 'static/images/2024/empty/.gitkeep', previousSha: 'k' },
        ],
        notify: false,
      });
      expect(gitConfigFiles.current).toHaveLength(3);
    });

    it('should take the sidebar off the folder once it’s gone', async () => {
      const { deleteAssets } = await import('$lib/services/assets/data/delete');
      const { focusedSubfolder } = await import('$lib/services/assets/subfolders');

      vi.mocked(deleteAssets).mockResolvedValue(undefined);

      // Another folder is left alone
      focusedSubfolder.current = { name: '2024-old', path: 'static/images/2024-old' };
      await deleteSubfolder('static/images/2024');
      expect(focusedSubfolder.current).toEqual({
        name: '2024-old',
        path: 'static/images/2024-old',
      });

      focusedSubfolder.current = { name: '2024', path: 'static/images/2024' };
      await deleteSubfolder('static/images/2024');
      expect(focusedSubfolder.current).toBeUndefined();
    });

    it('should leave the file list alone when the commit fails', async () => {
      const { deleteAssets } = await import('$lib/services/assets/data/delete');
      const { gitConfigFiles } = await import('$lib/services/backends/git/shared/config');

      gitConfigFiles.current = configFiles;
      vi.mocked(deleteAssets).mockRejectedValue(new Error('offline'));

      await expect(deleteSubfolder('static/images/2024')).rejects.toThrow('offline');
      expect(gitConfigFiles.current).toBe(configFiles);
    });
  });

  it('should commit a .gitkeep file to the new folder', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');

    vi.mocked(saveChanges).mockResolvedValue({
      commit: { sha: 'commit-sha', files: { 'static/images/2024/.gitkeep': { sha: 'blob-sha' } } },
      savedEntries: [],
      savedAssets: [],
    });

    await createSubfolder('static/images/2024');

    expect(saveChanges).toHaveBeenCalledWith({
      changes: [
        {
          action: 'create',
          path: 'static/images/2024/.gitkeep',
          data: expect.any(File),
        },
      ],
      options: { commitType: 'uploadMedia' },
    });

    const { data } = vi.mocked(saveChanges).mock.calls[0][0].changes[0];

    expect(/** @type {File} */ (data).name).toBe(GITKEEP_FILE_NAME);
    expect(/** @type {File} */ (data).size).toBe(0);
  });

  it('should add the file to the Git config file list and report the result', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');
    const { gitConfigFiles } = await import('$lib/services/backends/git/shared/config');
    const { assetUpdatesToast } = await import('$lib/services/assets/data');

    vi.mocked(saveChanges).mockResolvedValue({
      commit: { sha: 'commit-sha', files: { 'static/images/2024/.gitkeep': { sha: 'blob-sha' } } },
      savedEntries: [],
      savedAssets: [],
    });

    await createSubfolder('static/images/2024');

    expect(gitConfigFiles.current).toEqual([
      { type: 'config', path: '.gitattributes', name: '.gitattributes', sha: 'a', size: 10 },
      {
        type: 'config',
        path: 'static/images/2024/.gitkeep',
        name: '.gitkeep',
        sha: 'blob-sha',
        size: 0,
        text: '',
      },
    ]);
    expect(assetUpdatesToast.current).toEqual({
      saved: false,
      published: false,
      deleted: false,
      count: 1,
      folderCreated: true,
    });
  });

  it('should cope with a commit result that lacks the file', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');
    const { gitConfigFiles } = await import('$lib/services/backends/git/shared/config');

    vi.mocked(saveChanges).mockResolvedValue({
      commit: { sha: 'commit-sha', files: {} },
      savedEntries: [],
      savedAssets: [],
    });

    await createSubfolder('uploads');

    expect(gitConfigFiles.current[1]).toMatchObject({ path: 'uploads/.gitkeep', sha: '' });
  });

  it('should leave the file list alone when the commit fails', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');
    const { gitConfigFiles } = await import('$lib/services/backends/git/shared/config');

    vi.mocked(saveChanges).mockRejectedValue(new Error('offline'));

    await expect(createSubfolder('static/images/2024')).rejects.toThrow('offline');
    expect(gitConfigFiles.current).toHaveLength(1);
  });
});
