import { beforeEach, describe, expect, test, vi } from 'vitest';

import { parsePublishMode } from '$lib/services/config/parser/publish-mode';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };
/** @type {any} */
const context = { cmsConfig: {} };
/**
 * Run the check with the given option value.
 * @param {any} value `publish_mode` option value.
 * @returns {void}
 */
const check = (value) => parsePublishMode({ value, context, collectors });

describe('parsePublishMode', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('says nothing about the string form or an object without stages', () => {
    check(undefined);
    check('');
    check('preview');
    check({ type: 'editorial_workflow' });
    check({ type: 'editorial_workflow', stages: 'draft' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('accepts stages in order, starting with the drafting stage', () => {
    check({ stages: ['draft'] });
    check({ stages: ['draft', 'pending_publish'] });
    check({ stages: ['draft', 'pending_review'] });
    check({ stages: ['draft', 'pending_review', 'pending_publish'] });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('reports stages that don’t start with the drafting stage, are out of order or repeat', () => {
    [
      [],
      ['pending_review', 'pending_publish'],
      ['draft', 'pending_publish', 'pending_review'],
      ['draft', 'draft'],
      ['draft', 'pending_review', 'pending_review'],
    ].forEach((stages) => {
      vi.mocked(addMessage).mockClear();
      check({ stages });
      expect(addMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'invalid_publish_mode_stages',
        context,
        collectors,
      });
    });
  });

  test('warns about stages given with a publish mode they don’t apply to', () => {
    check({ type: 'preview', stages: ['draft'] });
    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'warning',
      strKey: 'publish_mode_stages_ignored',
      values: { type: 'preview' },
      context,
      collectors,
    });

    vi.mocked(addMessage).mockClear();
    check({ type: 'editorial_workflow', stages: ['draft'] });
    check({ stages: ['draft'] });
    expect(addMessage).not.toHaveBeenCalled();
  });
});
