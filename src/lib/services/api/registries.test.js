import { SvelteMap } from 'svelte/reactivity';
import { describe, expect, test } from 'vitest';

import {
  customComponentRegistry,
  customFieldTypeRegistry,
  customFileFormatRegistry,
  customPageRegistry,
  customPreviewStyleRegistry,
  customPreviewTemplateRegistry,
  customStringTransformationRegistry,
  eventHookRegistry,
} from '$lib/services/api/registries';

describe('API registries', () => {
  test('keyed registries are empty maps', () => {
    [
      customComponentRegistry,
      customFieldTypeRegistry,
      customFileFormatRegistry,
      customPreviewTemplateRegistry,
      customStringTransformationRegistry,
    ].forEach((registry) => {
      expect(registry).toBeInstanceOf(Map);
      expect(registry.size).toBe(0);
    });
  });

  test('the custom page registry is an empty reactive map', () => {
    expect(customPageRegistry).toBeInstanceOf(SvelteMap);
    expect(customPageRegistry.size).toBe(0);
  });

  test('unkeyed registries are empty sets', () => {
    [customPreviewStyleRegistry, eventHookRegistry].forEach((registry) => {
      expect(registry).toBeInstanceOf(Set);
      expect(registry.size).toBe(0);
    });
  });

  test('each registry is a separate collection', () => {
    const registries = [
      customComponentRegistry,
      customFieldTypeRegistry,
      customFileFormatRegistry,
      customPageRegistry,
      customPreviewStyleRegistry,
      customPreviewTemplateRegistry,
      customStringTransformationRegistry,
      eventHookRegistry,
    ];

    expect(new Set(registries).size).toBe(registries.length);
  });
});
