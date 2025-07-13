import { describe, test, expect } from 'vitest';
import { getConfigPath } from './loader';

describe('getConfigPath', () => {
  test('should append config.yml if path ends with a slash', () => {
    expect(getConfigPath('/admin/')).toBe('/admin/config.yml');
    expect(getConfigPath('/admin/cms/')).toBe('/admin/cms/config.yml');
    expect(getConfigPath('/')).toBe('/config.yml');
  });

  test('should replace file with config.yml if path ends with a file', () => {
    expect(getConfigPath('/admin/index.html')).toBe('/admin/config.yml');
    expect(getConfigPath('/admin/cms.php')).toBe('/admin/config.yml');
  });

  test('should append config.yml if path does not end with a slash or file', () => {
    expect(getConfigPath('/admin')).toBe('/admin/config.yml');
    expect(getConfigPath('/admin/cms')).toBe('/admin/cms/config.yml');
  });
});
