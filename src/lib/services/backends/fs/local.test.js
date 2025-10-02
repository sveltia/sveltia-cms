import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
const mockGet = vi.fn();
const mockIndexedDB = vi.fn();
const mockLoadFiles = vi.fn();
const mockSaveChanges = vi.fn();
const mockInit = vi.fn();

vi.mock('svelte/store', () => ({
  get: mockGet,
}));

vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: mockIndexedDB,
}));

vi.mock('$lib/services/backends/fs/shared/files', () => ({
  loadFiles: mockLoadFiles,
  saveChanges: mockSaveChanges,
}));

vi.mock('$lib/services/config', () => ({
  siteConfig: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/backends', () => ({
  allBackendServices: {
    github: { init: mockInit },
    gitlab: { init: mockInit },
  },
}));

describe('Local Backend Service', () => {
  /** @type {any} */
  let localBackend;
  /** @type {any} */
  let mockDB;
  /** @type {any} */
  let mockDirHandle;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock IndexedDB instance
    mockDB = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    mockIndexedDB.mockReturnValue(mockDB);

    // Mock directory handle
    mockDirHandle = {
      requestPermission: vi.fn(),
      entries: vi.fn(),
      getDirectoryHandle: vi.fn(),
    };

    // Reset module cache to get fresh import
    vi.resetModules();

    // Import the module
    localBackend = await import('./local.js');
  });

  describe('getRootDirHandle', () => {
    beforeEach(() => {
      // Mock window.showDirectoryPicker
      // @ts-ignore - Mock setup
      global.window = /** @type {any} */ ({
        showDirectoryPicker: /** @type {any} */ (vi.fn()),
      });

      // Initialize the backend to setup the DB
      mockIndexedDB.mockReturnValue(mockDB);
      mockGet.mockReturnValue({
        backend: { name: 'github' },
      });
      mockInit.mockReturnValue({
        service: 'github',
        databaseName: 'test-db',
      });
    });

    it('should throw error when File System Access API is not supported', async () => {
      // @ts-ignore - Testing undefined case
      delete (/** @type {any} */ (global.window).showDirectoryPicker);

      const { getRootDirHandle } = localBackend;

      await expect(getRootDirHandle()).rejects.toThrow('unsupported');
    });

    it('should return cached handle with valid permissions', async () => {
      mockDirHandle.requestPermission.mockResolvedValue('granted');
      mockDirHandle.entries.mockReturnValue({
        next: vi.fn().mockResolvedValue({ done: false }),
      });

      mockDB.get.mockResolvedValue(mockDirHandle);

      const { getRootDirHandle } = localBackend;
      const service = localBackend.default;

      service.init();

      const handle = await getRootDirHandle();

      expect(handle).toBe(mockDirHandle);
      expect(mockDirHandle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(global.window.showDirectoryPicker).not.toHaveBeenCalled();
    });

    it('should show picker when no cached handle exists', async () => {
      mockDirHandle.requestPermission.mockResolvedValue('granted');
      mockDirHandle.entries.mockReturnValue({
        next: vi.fn().mockResolvedValue({ done: false }),
      });
      mockDirHandle.getDirectoryHandle.mockResolvedValue({});

      mockDB.get.mockResolvedValue(null);
      /** @type {any} */ (global.window).showDirectoryPicker.mockResolvedValue(mockDirHandle);

      const { getRootDirHandle } = localBackend;
      const service = localBackend.default;

      service.init();

      const handle = await getRootDirHandle();

      expect(handle).toBe(mockDirHandle);
      expect(global.window.showDirectoryPicker).toHaveBeenCalled();
      expect(mockDirHandle.getDirectoryHandle).toHaveBeenCalledWith('.git');
      expect(mockDB.set).toHaveBeenCalledWith('root_dir_handle', mockDirHandle);
    });

    it('should show picker when permission is denied', async () => {
      const deniedHandle = {
        requestPermission: vi.fn().mockResolvedValue('denied'),
      };

      const newHandle = {
        requestPermission: vi.fn().mockResolvedValue('granted'),
        entries: vi.fn().mockReturnValue({
          next: vi.fn().mockResolvedValue({ done: false }),
        }),
        getDirectoryHandle: vi.fn().mockResolvedValue({}),
      };

      mockDB.get.mockResolvedValue(deniedHandle);
      /** @type {any} */ (global.window).showDirectoryPicker.mockResolvedValue(newHandle);

      const { getRootDirHandle } = localBackend;
      const service = localBackend.default;

      service.init();

      const handle = await getRootDirHandle();

      expect(handle).toBe(newHandle);
      expect(deniedHandle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(global.window.showDirectoryPicker).toHaveBeenCalled();
    });

    it('should show picker when cached directory has been moved/deleted', async () => {
      mockDirHandle.requestPermission.mockResolvedValue('granted');
      mockDirHandle.entries.mockReturnValue({
        next: vi.fn().mockRejectedValue(new Error('Directory no longer exists')),
      });

      const newHandle = {
        requestPermission: vi.fn().mockResolvedValue('granted'),
        entries: vi.fn().mockReturnValue({
          next: vi.fn().mockResolvedValue({ done: false }),
        }),
        getDirectoryHandle: vi.fn().mockResolvedValue({}),
      };

      mockDB.get.mockResolvedValue(mockDirHandle);
      /** @type {any} */ (global.window).showDirectoryPicker.mockResolvedValue(newHandle);

      const { getRootDirHandle } = localBackend;
      const service = localBackend.default;

      service.init();

      const handle = await getRootDirHandle();

      expect(handle).toBe(newHandle);
      expect(global.window.showDirectoryPicker).toHaveBeenCalled();
    });

    it('should throw NotFoundError when selected directory is not a project root', async () => {
      const notFoundError = new Error('Directory not found');

      notFoundError.name = 'NotFoundError';

      mockDirHandle.requestPermission.mockResolvedValue('granted');
      mockDirHandle.entries.mockReturnValue({
        next: vi.fn().mockResolvedValue({ done: false }),
      });
      mockDirHandle.getDirectoryHandle.mockRejectedValue(notFoundError);

      mockDB.get.mockResolvedValue(null);
      /** @type {any} */ (global.window).showDirectoryPicker.mockResolvedValue(mockDirHandle);

      const { getRootDirHandle } = localBackend;
      const service = localBackend.default;

      service.init();

      await expect(getRootDirHandle()).rejects.toThrow('Directory not found');
    });

    it('should throw AbortError when directory picker is dismissed', async () => {
      const abortError = new Error('The user aborted a request.');

      abortError.name = 'AbortError';

      mockDB.get.mockResolvedValue(null);
      /** @type {any} */ (global.window).showDirectoryPicker.mockRejectedValue(abortError);

      const { getRootDirHandle } = localBackend;
      const service = localBackend.default;

      service.init();

      await expect(getRootDirHandle()).rejects.toThrow('The user aborted a request.');
    });

    it('should return null when showPicker is false and no cached handle exists', async () => {
      mockDB.get.mockResolvedValue(null);

      const { getRootDirHandle } = localBackend;
      const service = localBackend.default;

      service.init();

      const handle = await getRootDirHandle({ showPicker: false });

      expect(handle).toBeNull();
      expect(global.window.showDirectoryPicker).not.toHaveBeenCalled();
    });

    it('should return null when showPicker is false and permission denied', async () => {
      mockDirHandle.requestPermission.mockResolvedValue('denied');

      mockDB.get.mockResolvedValue(mockDirHandle);

      const { getRootDirHandle } = localBackend;
      const service = localBackend.default;

      service.init();

      const handle = await getRootDirHandle({ showPicker: false });

      expect(handle).toBeNull();
      expect(global.window.showDirectoryPicker).not.toHaveBeenCalled();
    });

    it('should force reload and skip cache when forceReload is true', async () => {
      mockDirHandle.requestPermission.mockResolvedValue('granted');
      mockDirHandle.entries.mockReturnValue({
        next: vi.fn().mockResolvedValue({ done: false }),
      });
      mockDirHandle.getDirectoryHandle.mockResolvedValue({});

      // Set up a cached handle
      mockDB.get.mockResolvedValue(mockDirHandle);
      /** @type {any} */ (global.window).showDirectoryPicker.mockResolvedValue(mockDirHandle);

      const { getRootDirHandle } = localBackend;
      const service = localBackend.default;

      service.init();

      const handle = await getRootDirHandle({ forceReload: true });

      expect(handle).toBe(mockDirHandle);
      expect(mockDB.get).not.toHaveBeenCalled();
      expect(global.window.showDirectoryPicker).toHaveBeenCalled();
    });

    it('should cache the new handle after successful selection', async () => {
      mockDirHandle.requestPermission.mockResolvedValue('granted');
      mockDirHandle.entries.mockReturnValue({
        next: vi.fn().mockResolvedValue({ done: false }),
      });
      mockDirHandle.getDirectoryHandle.mockResolvedValue({});

      mockDB.get.mockResolvedValue(null);
      /** @type {any} */ (global.window).showDirectoryPicker.mockResolvedValue(mockDirHandle);

      const { getRootDirHandle } = localBackend;
      const service = localBackend.default;

      service.init();

      await getRootDirHandle();

      expect(mockDB.set).toHaveBeenCalledWith('root_dir_handle', mockDirHandle);
    });
  });

  describe('Service Structure', () => {
    it('should export correct service properties', async () => {
      const service = localBackend.default;

      expect(service).toEqual({
        isGit: false,
        name: 'local',
        label: 'Local Repository',
        repository: expect.any(Object),
        init: expect.any(Function),
        signIn: expect.any(Function),
        signOut: expect.any(Function),
        fetchFiles: expect.any(Function),
        commitChanges: expect.any(Function),
      });
    });

    it('should have isGit set to false', async () => {
      const service = localBackend.default;

      expect(service.isGit).toBe(false);
    });
  });

  describe('init', () => {
    it('should initialize with GitHub remote repository', async () => {
      const mockRepoInfo = {
        service: 'github',
        label: 'GitHub',
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main',
        databaseName: 'test-db',
      };

      mockGet.mockReturnValue({
        backend: { name: 'github' },
      });

      mockInit.mockReturnValue(mockRepoInfo);

      const service = localBackend.default;
      const result = service.init();

      expect(mockInit).toHaveBeenCalled();
      expect(mockIndexedDB).toHaveBeenCalledWith('test-db', 'file-system-handles');
      expect(result).toBeDefined();
      expect(result.service).toBe('github');
    });

    it('should initialize without remote repository when backend has no databaseName', async () => {
      mockGet.mockReturnValue({
        backend: { name: 'github' },
      });

      mockInit.mockReturnValue({
        service: 'github',
        label: 'GitHub',
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main',
        // No databaseName
      });

      const service = localBackend.default;
      const result = service.init();

      expect(mockIndexedDB).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle initialization with GitLab backend', async () => {
      const mockRepoInfo = {
        service: 'gitlab',
        label: 'GitLab',
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main',
        databaseName: 'gitlab-db',
      };

      mockGet.mockReturnValue({
        backend: { name: 'gitlab' },
      });

      mockInit.mockReturnValue(mockRepoInfo);

      const service = localBackend.default;
      const result = service.init();

      expect(mockIndexedDB).toHaveBeenCalledWith('gitlab-db', 'file-system-handles');
      expect(result.service).toBe('gitlab');
    });
  });

  describe('signIn', () => {
    beforeEach(() => {
      // Mock window.showDirectoryPicker
      // @ts-ignore - Mock setup
      global.window = /** @type {any} */ ({
        showDirectoryPicker: /** @type {any} */ (vi.fn()),
      });
    });

    it('should throw error when File System Access API is not supported', async () => {
      // @ts-ignore - Testing undefined case
      delete (/** @type {any} */ (global.window).showDirectoryPicker);

      const service = localBackend.default;

      await expect(service.signIn({ auto: false })).rejects.toThrow('unsupported');
    });

    it('should sign in with new directory selection', async () => {
      mockDirHandle.requestPermission.mockResolvedValue('granted');
      mockDirHandle.entries.mockReturnValue({
        next: vi.fn().mockResolvedValue({ done: false }),
      });
      mockDirHandle.getDirectoryHandle.mockResolvedValue({});

      /** @type {any} */ (global.window).showDirectoryPicker.mockResolvedValue(mockDirHandle);
      mockDB.get.mockResolvedValue(null);

      const service = localBackend.default;

      service.init();

      const result = await service.signIn({ auto: false });

      expect(global.window.showDirectoryPicker).toHaveBeenCalled();
      expect(mockDirHandle.getDirectoryHandle).toHaveBeenCalledWith('.git');
      expect(mockDB.set).toHaveBeenCalledWith('root_dir_handle', mockDirHandle);
      expect(result).toEqual({ backendName: 'local' });
    });

    it('should sign in with cached directory handle', async () => {
      mockDirHandle.requestPermission.mockResolvedValue('granted');
      mockDirHandle.entries.mockReturnValue({
        next: vi.fn().mockResolvedValue({ done: false }),
      });

      mockDB.get.mockResolvedValue(mockDirHandle);

      const service = localBackend.default;

      service.init();

      const result = await service.signIn({ auto: true });

      expect(global.window.showDirectoryPicker).not.toHaveBeenCalled();
      expect(mockDirHandle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(result).toEqual({ backendName: 'local' });
    });

    it('should re-prompt when permission is denied', async () => {
      mockDirHandle.requestPermission.mockResolvedValue('denied');

      const newMockDirHandle = {
        requestPermission: vi.fn().mockResolvedValue('granted'),
        entries: vi.fn().mockReturnValue({
          next: vi.fn().mockResolvedValue({ done: false }),
        }),
        getDirectoryHandle: vi.fn().mockResolvedValue({}),
      };

      mockDB.get.mockResolvedValue(mockDirHandle);
      /** @type {any} */ (global.window).showDirectoryPicker.mockResolvedValue(newMockDirHandle);

      const service = localBackend.default;

      service.init();

      const result = await service.signIn({ auto: false });

      expect(mockDirHandle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(global.window.showDirectoryPicker).toHaveBeenCalled();
      expect(result).toEqual({ backendName: 'local' });
    });

    it('should throw error when directory picker is dismissed', async () => {
      mockDB.get.mockResolvedValue(null);

      // AbortError is thrown when picker is dismissed
      const abortError = new Error('The user aborted a request.');

      abortError.name = 'AbortError';
      /** @type {any} */ (global.window).showDirectoryPicker.mockRejectedValue(abortError);

      const service = localBackend.default;

      service.init();

      await expect(service.signIn({ auto: false })).rejects.toThrow('The user aborted a request.');
    });

    it('should throw error when selected directory is not a project root', async () => {
      const notFoundError = new Error('Directory not found');

      notFoundError.name = 'NotFoundError';

      mockDirHandle.requestPermission.mockResolvedValue('granted');
      mockDirHandle.entries.mockReturnValue({
        next: vi.fn().mockResolvedValue({ done: false }),
      });
      mockDirHandle.getDirectoryHandle.mockRejectedValue(notFoundError);

      mockDB.get.mockResolvedValue(null);
      /** @type {any} */ (global.window).showDirectoryPicker.mockResolvedValue(mockDirHandle);

      const service = localBackend.default;

      service.init();

      await expect(service.signIn({ auto: false })).rejects.toThrow('Directory not found');
    });

    it('should handle directory that has been moved or deleted', async () => {
      mockDirHandle.requestPermission.mockResolvedValue('granted');
      mockDirHandle.entries.mockReturnValue({
        next: vi.fn().mockRejectedValue(new Error('Directory no longer exists')),
      });

      const newMockDirHandle = {
        requestPermission: vi.fn().mockResolvedValue('granted'),
        entries: vi.fn().mockReturnValue({
          next: vi.fn().mockResolvedValue({ done: false }),
        }),
        getDirectoryHandle: vi.fn().mockResolvedValue({}),
      };

      mockDB.get.mockResolvedValue(mockDirHandle);
      /** @type {any} */ (global.window).showDirectoryPicker.mockResolvedValue(newMockDirHandle);

      const service = localBackend.default;

      service.init();

      const result = await service.signIn({ auto: false });

      expect(global.window.showDirectoryPicker).toHaveBeenCalled();
      expect(result).toEqual({ backendName: 'local' });
    });

    it('should throw error when handle cannot be acquired', async () => {
      mockDB.get.mockResolvedValue(null);
      /** @type {any} */ (global.window).showDirectoryPicker.mockResolvedValue(null);

      const service = localBackend.default;

      service.init();

      await expect(service.signIn({ auto: false })).rejects.toThrow(
        'Directory handle could not be acquired',
      );
    });
  });

  describe('signOut', () => {
    it('should delete cached directory handle', async () => {
      const service = localBackend.default;

      service.init();

      await service.signOut();

      expect(mockDB.delete).toHaveBeenCalledWith('root_dir_handle');
    });

    it('should handle signOut when no DB is initialized', async () => {
      mockGet.mockReturnValue({
        backend: { name: 'github' },
      });

      mockInit.mockReturnValue({
        service: 'github',
        // No databaseName, so DB will be null
      });

      const service = localBackend.default;

      service.init();

      // Should not throw
      await expect(service.signOut()).resolves.toBeUndefined();
    });
  });

  describe('fetchFiles', () => {
    it('should call loadFiles with directory handle', async () => {
      mockDirHandle.requestPermission.mockResolvedValue('granted');
      mockDirHandle.entries.mockReturnValue({
        next: vi.fn().mockResolvedValue({ done: false }),
      });
      mockDirHandle.getDirectoryHandle.mockResolvedValue({});

      // @ts-ignore - Mock setup
      global.window = /** @type {any} */ ({
        showDirectoryPicker: /** @type {any} */ (vi.fn().mockResolvedValue(mockDirHandle)),
      });

      mockDB.get.mockResolvedValue(null);
      mockLoadFiles.mockResolvedValue(undefined);

      const service = localBackend.default;

      service.init();

      await service.signIn({ auto: false });
      await service.fetchFiles();

      expect(mockLoadFiles).toHaveBeenCalledWith(mockDirHandle);
    });
  });

  describe('commitChanges', () => {
    it('should call saveChanges with directory handle and changes', async () => {
      const changes = [
        {
          action: 'create',
          path: 'test.md',
          data: 'test content',
        },
      ];

      const mockResults = {
        commitId: 'abc123',
        files: [{ path: 'test.md', sha: 'def456' }],
      };

      mockDirHandle.requestPermission.mockResolvedValue('granted');
      mockDirHandle.entries.mockReturnValue({
        next: vi.fn().mockResolvedValue({ done: false }),
      });
      mockDirHandle.getDirectoryHandle.mockResolvedValue({});

      // @ts-ignore - Mock setup
      global.window = /** @type {any} */ ({
        showDirectoryPicker: /** @type {any} */ (vi.fn().mockResolvedValue(mockDirHandle)),
      });

      mockDB.get.mockResolvedValue(null);
      mockSaveChanges.mockResolvedValue(mockResults);

      const service = localBackend.default;

      service.init();

      await service.signIn({ auto: false });

      const result = await service.commitChanges(changes);

      expect(mockSaveChanges).toHaveBeenCalledWith(mockDirHandle, changes);
      expect(result).toEqual(mockResults);
    });
  });

  describe('repository', () => {
    it('should proxy to remote repository when available', async () => {
      const mockRepoInfo = {
        service: 'github',
        label: 'GitHub',
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main',
        databaseName: 'test-db',
      };

      mockGet.mockReturnValue({
        backend: { name: 'github' },
      });

      mockInit.mockReturnValue(mockRepoInfo);

      const service = localBackend.default;

      service.init();

      expect(service.repository.service).toBe('github');
      expect(service.repository.owner).toBe('test-owner');
      expect(service.repository.repo).toBe('test-repo');
    });

    it('should use empty repository props when no remote repository', async () => {
      mockGet.mockReturnValue({
        backend: { name: 'github' },
      });

      mockInit.mockReturnValue(undefined);

      const service = localBackend.default;

      service.init();

      expect(service.repository.service).toBe('');
      expect(service.repository.owner).toBe('');
      expect(service.repository.repo).toBe('');
    });
  });
});
