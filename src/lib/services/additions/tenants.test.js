import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAdditions } from '$lib/services/additions/api';
import { additionsSetup } from '$lib/services/additions/setup.svelte';
import {
  createTenant,
  deleteTenant,
  isValidTenantId,
  listTenants,
} from '$lib/services/additions/tenants';

vi.mock('@sveltia/i18n', () => ({ _: vi.fn((key) => key) }));
vi.mock('$lib/services/additions/api', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAdditions: vi.fn(),
}));

const TENANT = {
  id: 'acme',
  name: 'Acme Inc.',
  created_at: '2026-11-21T00:00:00.000Z',
  url: 'https://additions.example.com/t/acme',
};

beforeEach(() => {
  vi.mocked(fetchAdditions).mockReset();
  additionsSetup.secret = 'the secret';
});

describe('isValidTenantId', () => {
  test('accepts what the service does', () => {
    expect(isValidTenantId('acme')).toBe(true);
    expect(isValidTenantId('a')).toBe(true);
    expect(isValidTenantId('acme-2')).toBe(true);
    expect(isValidTenantId('a'.repeat(32))).toBe(true);
  });

  test('refuses anything else, including the root site’s ID', () => {
    expect(isValidTenantId('')).toBe(false);
    expect(isValidTenantId('Acme')).toBe(false);
    expect(isValidTenantId('-acme')).toBe(false);
    expect(isValidTenantId('acme-')).toBe(false);
    expect(isValidTenantId('ac me')).toBe(false);
    expect(isValidTenantId('a'.repeat(33))).toBe(false);
    expect(isValidTenantId('default')).toBe(false);
  });
});

describe('listTenants', () => {
  test('lists the sites with the admin secret', async () => {
    vi.mocked(fetchAdditions).mockResolvedValue({ tenants: [TENANT] });

    await expect(listTenants()).resolves.toEqual([TENANT]);
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/tenants', { token: 'the secret' });
  });

  test('returns null where the sites can’t be managed', async () => {
    vi.mocked(fetchAdditions).mockRejectedValue(new Error('Not found', { cause: { status: 404 } }));

    await expect(listTenants()).resolves.toBeNull();
  });

  test('returns null when an older service doesn’t let the browser read the response', async () => {
    vi.mocked(fetchAdditions).mockRejectedValue(
      new Error('Unreachable', { cause: { message: 'unreachable' } }),
    );

    await expect(listTenants()).resolves.toBeNull();
  });

  test('passes on other errors', async () => {
    const error = new Error('Wrong', { cause: { status: 401 } });

    vi.mocked(fetchAdditions).mockRejectedValue(error);
    await expect(listTenants()).rejects.toBe(error);
  });
});

describe('createTenant', () => {
  test('adds a site with a name', async () => {
    vi.mocked(fetchAdditions).mockResolvedValue({ tenant: TENANT });

    await expect(createTenant({ id: 'acme', name: 'Acme Inc.' })).resolves.toEqual(TENANT);
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/tenants', {
      method: 'POST',
      token: 'the secret',
      body: { id: 'acme', name: 'Acme Inc.' },
    });
  });

  test('leaves the name to the service without one', async () => {
    vi.mocked(fetchAdditions).mockResolvedValue({ tenant: { ...TENANT, name: 'acme' } });

    await createTenant({ id: 'acme', name: '' });
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/tenants', {
      method: 'POST',
      token: 'the secret',
      body: { id: 'acme' },
    });
  });
});

describe('deleteTenant', () => {
  test('deletes a site', async () => {
    vi.mocked(fetchAdditions).mockResolvedValue({ deleted: true });

    await expect(deleteTenant('acme')).resolves.toBeUndefined();
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/tenants/acme', {
      method: 'DELETE',
      token: 'the secret',
    });
  });

  test('counts a site that’s already gone as deleted', async () => {
    vi.mocked(fetchAdditions).mockRejectedValue(
      new Error('Gone', { cause: { status: 404, code: 'tenant_not_found' } }),
    );

    await expect(deleteTenant('acme')).resolves.toBeUndefined();
  });

  test('passes on other errors', async () => {
    const error = new Error('Wrong', { cause: { status: 401, code: 'wrong_admin_secret' } });

    vi.mocked(fetchAdditions).mockRejectedValue(error);
    await expect(deleteTenant('acme')).rejects.toBe(error);
  });
});
