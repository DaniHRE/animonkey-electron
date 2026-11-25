import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRelativeTime } from '../src/lib/relative-time.mts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test('formats recent notifications as now, minutes, hours, and days', () => {
  const now = Date.UTC(2026, 10, 24, 12);

  assert.equal(formatRelativeTime(now - 45_000, now), 'agora');
  assert.equal(formatRelativeTime(now - 2 * MINUTE, now), 'há 2 min.');
  assert.equal(formatRelativeTime(now - 3 * HOUR, now), 'há 3 h');
  assert.equal(formatRelativeTime(now - 2 * DAY, now), 'anteontem');
});

test('formats future notification timestamps in the future tense', () => {
  const now = Date.UTC(2026, 10, 24, 12);

  assert.equal(formatRelativeTime(now + 2 * MINUTE, now), 'em 2 min.');
});
