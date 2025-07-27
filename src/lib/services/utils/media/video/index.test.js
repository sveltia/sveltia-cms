import { describe, expect, test } from 'vitest';

import { formatDuration } from './index';

describe('formatDuration', () => {
  test('should format duration in seconds to hh:mm:ss format', () => {
    expect(formatDuration(0)).toBe('00:00:00');
    expect(formatDuration(30)).toBe('00:00:30');
    expect(formatDuration(60)).toBe('00:01:00');
    expect(formatDuration(90)).toBe('00:01:30');
    expect(formatDuration(3600)).toBe('01:00:00');
    expect(formatDuration(3661)).toBe('01:01:01');
    expect(formatDuration(7200)).toBe('02:00:00');
  });

  test('should handle fractional seconds', () => {
    // Note: this will truncate fractional seconds
    expect(formatDuration(30.5)).toBe('00:00:30');
    expect(formatDuration(60.9)).toBe('00:01:00');
  });

  test('should handle edge cases', () => {
    // Very small durations
    expect(formatDuration(0.1)).toBe('00:00:00');
    expect(formatDuration(1)).toBe('00:00:01');

    // Maximum duration under 24 hours
    expect(formatDuration(86399)).toBe('23:59:59');
  });

  test('should handle large durations (over 24 hours)', () => {
    // Note: The function assumes duration is less than 24 hours
    // but technically it will still format larger values, wrapping around
    expect(formatDuration(86400)).toBe('00:00:00'); // 24 hours wraps to 00:00:00
    expect(formatDuration(90000)).toBe('01:00:00'); // 25 hours wraps to 01:00:00
  });
});
