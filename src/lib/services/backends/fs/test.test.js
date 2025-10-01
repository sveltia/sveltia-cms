import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { BackendService } from '$lib/types/private';
 */

// Mock dependencies
const mockLoadFiles = vi.fn();
const mockSaveChanges = vi.fn();
const mockGetDirectoryHandle = vi.fn();

vi.mock('$lib/services/backends/fs/shared/files', () => ({
  loadFiles: mockLoadFiles,
  saveChanges: mockSaveChanges,
  getDirectoryHandle: mockGetDirectoryHandle,
}));

vi.mock('$lib/services/contents', () => ({
  dataLoaded: {
    set: vi.fn(),
  },
}));

describe('Test Backend Service', () => {
  /** @type {BackendService} */
  let testBackend;
  /** @type {any} */
  let mockRootHandle;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock root directory handle
    mockRootHandle = {
      kind: 'directory',
      name: 'sveltia-cms-test',
    };

    // Mock navigator.storage.getDirectory
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: vi.fn().mockResolvedValue(mockRootHandle),
      },
    });

    // Reset module cache and import
    vi.resetModules();

    const module = await import('./test.js');

    testBackend = module.default;
  });

  describe('Service Structure', () => {
    it('should export correct service properties', () => {
      expect(testBackend).toEqual({
        isGit: false,
        name: 'test-repo',
        label: 'Test',
        init: expect.any(Function),
        signIn: expect.any(Function),
        signOut: expect.any(Function),
        fetchFiles: expect.any(Function),
        commitChanges: expect.any(Function),
      });
    });

    it('should have isGit set to false', () => {
      expect(testBackend.isGit).toBe(false);
    });

    it('should have correct backend name', () => {
      expect(testBackend.name).toBe('test-repo');
    });

    it('should have correct label', () => {
      expect(testBackend.label).toBe('Test');
    });
  });

  describe('init', () => {
    it('should return undefined', () => {
      const result = testBackend.init();

      expect(result).toBeUndefined();
    });
  });

  describe('signIn', () => {
    it('should return user with backend name', async () => {
      mockGetDirectoryHandle.mockResolvedValue(mockRootHandle);

      // @ts-ignore - Testing actual implementation signature
      const result = await testBackend.signIn();

      expect(result).toEqual({ backendName: 'test-repo' });
      expect(navigator.storage.getDirectory).toHaveBeenCalled();
      expect(mockGetDirectoryHandle).toHaveBeenCalledWith(mockRootHandle, 'sveltia-cms-test');
    });

    it('should handle errors when getting directory handle fails', async () => {
      mockGetDirectoryHandle.mockRejectedValue(new Error('Security error'));

      // @ts-ignore - Testing actual implementation signature
      const result = await testBackend.signIn();

      expect(result).toEqual({ backendName: 'test-repo' });
      expect(navigator.storage.getDirectory).toHaveBeenCalled();
    });

    it('should not throw error when handle cannot be acquired', async () => {
      mockGetDirectoryHandle.mockRejectedValue(new Error('Access denied'));

      // @ts-ignore - Testing actual implementation signature
      await expect(testBackend.signIn()).resolves.toEqual({ backendName: 'test-repo' });
    });
  });

  describe('signOut', () => {
    it('should complete without errors', async () => {
      await expect(testBackend.signOut()).resolves.toBeUndefined();
    });

    it('should not call any external functions', async () => {
      await testBackend.signOut();

      expect(mockLoadFiles).not.toHaveBeenCalled();
      expect(mockSaveChanges).not.toHaveBeenCalled();
      expect(mockGetDirectoryHandle).not.toHaveBeenCalled();
    });
  });

  describe('fetchFiles', () => {
    it('should call loadFiles when root handle is available', async () => {
      mockGetDirectoryHandle.mockResolvedValue(mockRootHandle);
      mockLoadFiles.mockResolvedValue(undefined);

      // @ts-ignore - Testing actual implementation signature
      await testBackend.signIn();
      await testBackend.fetchFiles();

      expect(mockLoadFiles).toHaveBeenCalledWith(mockRootHandle);
    });

    it('should set dataLoaded when root handle is not available', async () => {
      mockGetDirectoryHandle.mockRejectedValue(new Error('Handle not available'));

      const { dataLoaded } = await import('$lib/services/contents');

      // @ts-ignore - Testing actual implementation signature
      await testBackend.signIn();
      await testBackend.fetchFiles();

      expect(mockLoadFiles).not.toHaveBeenCalled();
      expect(dataLoaded.set).toHaveBeenCalledWith(true);
    });

    it('should handle case where signIn was not called', async () => {
      const { dataLoaded } = await import('$lib/services/contents');

      await testBackend.fetchFiles();

      expect(mockLoadFiles).not.toHaveBeenCalled();
      expect(dataLoaded.set).toHaveBeenCalledWith(true);
    });
  });

  describe('commitChanges', () => {
    it('should call saveChanges with root handle when available', async () => {
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

      mockGetDirectoryHandle.mockResolvedValue(mockRootHandle);
      mockSaveChanges.mockResolvedValue(mockResults);

      // @ts-ignore - Testing actual implementation signature
      await testBackend.signIn();

      // @ts-ignore - Testing actual implementation signature
      const result = await testBackend.commitChanges(changes);

      expect(mockSaveChanges).toHaveBeenCalledWith(mockRootHandle, changes);
      expect(result).toEqual(mockResults);
    });

    it('should call saveChanges with undefined handle when not available', async () => {
      const changes = [
        {
          action: 'update',
          path: 'existing.md',
          data: 'updated content',
        },
      ];

      const mockResults = {
        commitId: 'xyz789',
        files: [{ path: 'existing.md', sha: 'ghi012' }],
      };

      mockGetDirectoryHandle.mockRejectedValue(new Error('Handle not available'));
      mockSaveChanges.mockResolvedValue(mockResults);

      // @ts-ignore - Testing actual implementation signature
      await testBackend.signIn();

      // @ts-ignore - Testing actual implementation signature
      const result = await testBackend.commitChanges(changes);

      expect(mockSaveChanges).toHaveBeenCalledWith(undefined, changes);
      expect(result).toEqual(mockResults);
    });

    it('should handle multiple file changes', async () => {
      const changes = [
        {
          action: 'create',
          path: 'file1.md',
          data: 'content 1',
        },
        {
          action: 'update',
          path: 'file2.md',
          data: 'content 2',
        },
        {
          action: 'delete',
          path: 'file3.md',
        },
      ];

      const mockResults = {
        commitId: 'multi123',
        files: [
          { path: 'file1.md', sha: 'sha1' },
          { path: 'file2.md', sha: 'sha2' },
          { path: 'file3.md', sha: 'sha3' },
        ],
      };

      mockGetDirectoryHandle.mockResolvedValue(mockRootHandle);
      mockSaveChanges.mockResolvedValue(mockResults);

      // @ts-ignore - Testing actual implementation signature
      await testBackend.signIn();

      // @ts-ignore - Testing actual implementation signature
      const result = await testBackend.commitChanges(changes);

      expect(mockSaveChanges).toHaveBeenCalledWith(mockRootHandle, changes);
      expect(result).toEqual(mockResults);
    });

    it('should work without prior signIn call', async () => {
      const changes = [
        {
          action: 'create',
          path: 'test.md',
          data: 'test content',
        },
      ];

      const mockResults = {
        commitId: 'nosignin123',
        files: [{ path: 'test.md', sha: 'nosignin456' }],
      };

      mockSaveChanges.mockResolvedValue(mockResults);

      // @ts-ignore - Testing actual implementation signature
      const result = await testBackend.commitChanges(changes);

      expect(mockSaveChanges).toHaveBeenCalledWith(undefined, changes);
      expect(result).toEqual(mockResults);
    });
  });

  describe('OPFS integration', () => {
    it('should use Origin Private File System through navigator.storage', async () => {
      mockGetDirectoryHandle.mockResolvedValue(mockRootHandle);

      // @ts-ignore - Testing actual implementation signature
      await testBackend.signIn();

      expect(navigator.storage.getDirectory).toHaveBeenCalled();
      expect(mockGetDirectoryHandle).toHaveBeenCalledWith(expect.any(Object), 'sveltia-cms-test');
    });

    it('should handle OPFS not being available', async () => {
      vi.stubGlobal('navigator', {
        storage: {
          getDirectory: vi.fn().mockRejectedValue(new Error('OPFS not supported')),
        },
      });

      // @ts-ignore - Testing actual implementation signature
      const result = await testBackend.signIn();

      expect(result).toEqual({ backendName: 'test-repo' });
    });
  });

  describe('Error handling', () => {
    it('should gracefully handle loadFiles errors', async () => {
      mockGetDirectoryHandle.mockResolvedValue(mockRootHandle);
      mockLoadFiles.mockRejectedValue(new Error('Load failed'));

      // @ts-ignore - Testing actual implementation signature
      await testBackend.signIn();

      await expect(testBackend.fetchFiles()).rejects.toThrow('Load failed');
    });

    it('should gracefully handle saveChanges errors', async () => {
      const changes = [
        {
          action: 'create',
          path: 'test.md',
          data: 'test content',
        },
      ];

      mockGetDirectoryHandle.mockResolvedValue(mockRootHandle);
      mockSaveChanges.mockRejectedValue(new Error('Save failed'));

      // @ts-ignore - Testing actual implementation signature
      await testBackend.signIn();

      // @ts-ignore - Testing actual implementation signature
      await expect(testBackend.commitChanges(changes)).rejects.toThrow('Save failed');
    });
  });
});
