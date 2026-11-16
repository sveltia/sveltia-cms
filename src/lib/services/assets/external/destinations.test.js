import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  enabledCloudServices,
  externalAssets,
  externalFolders,
  selectedCloudService,
} from '$lib/services/assets/external';

import {
  buildServiceFolderTree,
  getExternalMoveDestinations,
  getMoveTargetServices,
} from './destinations.js';

vi.mock('$lib/services/assets/external', () => ({
  enabledCloudServices: { current: [] },
  externalAssets: { current: undefined },
  externalFolders: { current: [] },
  getFetchOptions: vi.fn(() => ({ apiKey: 'key', userName: '', password: '' })),
  hasAuthInfo: vi.fn((/** @type {any} */ service) => service.serviceId !== 'no_key'),
  selectedCloudService: { current: undefined },
}));

/**
 * Create a file on a service.
 * @param {string} description File path.
 * @returns {any} Asset.
 */
const file = (description) => ({ id: description, description });

describe('assets/external/destinations', () => {
  beforeEach(() => {
    /** @type {any} */ (enabledCloudServices).current = [];
    externalAssets.current = undefined;
    externalFolders.current = [];
    selectedCloudService.current = undefined;
  });

  describe('getMoveTargetServices', () => {
    it('lists the services that take uploads, with the credentials entered', () => {
      const s3 = { serviceId: 'aws_s3', upload: vi.fn() };
      const cloudinary = { serviceId: 'cloudinary' };
      const noKey = { serviceId: 'no_key', upload: vi.fn() };

      /** @type {any} */ (enabledCloudServices).current = [s3, cloudinary, noKey];

      expect(getMoveTargetServices()).toEqual([s3]);
    });
  });

  describe('buildServiceFolderTree', () => {
    it('builds the folders off the file paths and the empty folders', () => {
      const service = /** @type {any} */ ({ serviceId: 'aws_s3', serviceLabel: 'Amazon S3' });

      const tree = buildServiceFolderTree(service, {
        assets: [file('a.png'), file('trips/2024/map.png'), file('trips/b.png')],
        folders: ['empty', 'trips/2025'],
      });

      expect(tree).toEqual({
        service,
        dirPath: '',
        label: 'Amazon S3',
        children: [
          { service, dirPath: 'empty', label: 'empty', children: [] },
          {
            service,
            dirPath: 'trips',
            label: 'trips',
            children: [
              {
                service,
                dirPath: 'trips/2024',
                label: '2024',
                children: [],
              },
              { service, dirPath: 'trips/2025', label: '2025', children: [] },
            ],
          },
        ],
      });
    });
  });

  describe('getExternalMoveDestinations', () => {
    it('lists each service with its folders, browsing those that aren’t being browsed', async () => {
      const browsed = {
        serviceId: 'aws_s3',
        serviceLabel: 'S3',
        upload: vi.fn(),
        browse: vi.fn(),
      };

      const other = {
        serviceId: 'cloudflare_r2',
        serviceLabel: 'R2',
        upload: vi.fn(),
        browse: vi.fn(async () => ({ assets: [file('docs/c.pdf')], folders: [] })),
      };

      // Without folders, so the service root only
      const flat = { serviceId: 'uploadcare', serviceLabel: 'Uploadcare', upload: vi.fn() };

      const failing = {
        serviceId: 'azure',
        serviceLabel: 'Azure',
        upload: vi.fn(),
        browse: vi.fn(async () => {
          throw new Error('Forbidden');
        }),
      };

      vi.spyOn(console, 'error').mockImplementation(() => {});
      /** @type {any} */ (enabledCloudServices).current = [browsed, other, flat, failing];
      selectedCloudService.current = /** @type {any} */ (browsed);
      externalAssets.current = [file('a.png')];
      externalFolders.current = ['trips'];

      const destinations = await getExternalMoveDestinations();

      expect(
        destinations.map(({ label, children }) => [label, children.map((c) => c.label)]),
      ).toEqual([
        ['S3', ['trips']],
        ['R2', ['docs']],
        ['Uploadcare', []],
        ['Azure', []],
      ]);
      // The listing of the service being browsed is at hand
      expect(browsed.browse).not.toHaveBeenCalled();
      expect(other.browse).toHaveBeenCalledWith({ apiKey: 'key', userName: '', password: '' });
    });

    it('browses the selected service whose files haven’t been listed yet', async () => {
      const service = {
        serviceId: 'aws_s3',
        serviceLabel: 'S3',
        upload: vi.fn(),
        browse: vi.fn(async () => ({ assets: [], folders: ['x'] })),
      };

      /** @type {any} */ (enabledCloudServices).current = [service];
      selectedCloudService.current = /** @type {any} */ (service);

      const [destination] = await getExternalMoveDestinations();

      expect(destination.children.map(({ dirPath }) => dirPath)).toEqual(['x']);
    });
  });
});
