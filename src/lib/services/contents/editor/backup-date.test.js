import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { formatBackupTime } from '$lib/services/contents/editor/backup-date';

describe('formatBackupTime()', () => {
  const { TZ } = process.env;

  afterEach(() => {
    process.env.TZ = TZ;
  });

  describe('in UTC', () => {
    test('shows the time alone for a backup made today', () => {
      expect(
        formatBackupTime({
          timestamp: new Date('2026-11-07T10:30:00Z'),
          locale: 'en-US',
          now: new Date('2026-11-07T18:00:00Z'),
        }),
      ).toBe('10:30 AM');
    });

    test('adds the date for a backup made on another day this year', () => {
      expect(
        formatBackupTime({
          timestamp: new Date('2026-01-15T10:30:00Z'),
          locale: 'en-US',
          now: new Date('2026-11-07T18:00:00Z'),
        }),
      ).toBe('Jan 15, 10:30 AM');
      // The same day of another month
      expect(
        formatBackupTime({
          timestamp: new Date('2026-10-07T10:30:00Z'),
          locale: 'en-US',
          now: new Date('2026-11-07T18:00:00Z'),
        }),
      ).toBe('Oct 7, 10:30 AM');
    });

    test('adds the year for a backup made in another year', () => {
      expect(
        formatBackupTime({
          timestamp: new Date('2025-11-07T10:30:00Z'),
          locale: 'en-US',
          now: new Date('2026-11-07T18:00:00Z'),
        }),
      ).toBe('Nov 7, 2025, 10:30 AM');
    });

    test('compares with the current time by default', () => {
      const timestamp = new Date();

      timestamp.setHours(10, 30, 0, 0);
      expect(formatBackupTime({ timestamp, locale: 'en-US' })).toBe('10:30 AM');
    });
  });

  describe('in another time zone', () => {
    beforeEach(() => {
      process.env.TZ = 'Asia/Tokyo';
    });

    test('compares the dates in the user’s time zone, which the time is shown in', () => {
      // 23:30 the previous evening in Tokyo, while it’s the same day in UTC
      expect(
        formatBackupTime({
          timestamp: new Date('2026-11-06T14:30:00Z'),
          locale: 'en-US',
          now: new Date('2026-11-06T23:00:00Z'),
        }),
      ).toBe('Nov 6, 11:30 PM');
      // 08:30 the same morning in Tokyo, while it was the previous day in UTC
      expect(
        formatBackupTime({
          timestamp: new Date('2026-11-06T23:30:00Z'),
          locale: 'en-US',
          now: new Date('2026-11-07T01:00:00Z'),
        }),
      ).toBe('8:30 AM');
      // New Year’s Eve in Tokyo, while it’s already New Year’s Day in UTC
      expect(
        formatBackupTime({
          timestamp: new Date('2025-12-31T14:30:00Z'),
          locale: 'en-US',
          now: new Date('2026-01-01T03:00:00Z'),
        }),
      ).toBe('Dec 31, 2025, 11:30 PM');
    });
  });
});
