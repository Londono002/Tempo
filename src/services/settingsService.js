import { getDatabase } from './database';

export const DEFAULT_FOCUS_INTERVAL_MINUTES = 25;
export const MIN_FOCUS_INTERVAL_MINUTES = 5;
export const MAX_FOCUS_INTERVAL_MINUTES = 120;
export const DEFAULT_BREAK_DURATION_MINUTES = 5;
export const MIN_BREAK_DURATION_MINUTES = 5;
export const MAX_BREAK_DURATION_MINUTES = 60;

export async function getBreakDurationMinutes() {
  const db = getDatabase();
  const row = await db.getFirstAsync(
    "SELECT value FROM app_settings WHERE key = 'break_duration_minutes'"
  );
  const value = Number(row?.value);
  return Number.isInteger(value) && value >= MIN_BREAK_DURATION_MINUTES && value <= MAX_BREAK_DURATION_MINUTES
    ? value
    : DEFAULT_BREAK_DURATION_MINUTES;
}

export async function saveBreakDurationMinutes(minutes) {
  const value = Math.max(
    MIN_BREAK_DURATION_MINUTES,
    Math.min(MAX_BREAK_DURATION_MINUTES, Math.round(Number(minutes) / 5) * 5),
  );
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES ('break_duration_minutes', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(value)]
  );
  return value;
}

export async function getFocusIntervalMinutes() {
  const db = getDatabase();
  const row = await db.getFirstAsync(
    "SELECT value FROM app_settings WHERE key = 'focus_interval_minutes'"
  );
  const value = Number(row?.value);
  return Number.isInteger(value) && value >= MIN_FOCUS_INTERVAL_MINUTES && value <= MAX_FOCUS_INTERVAL_MINUTES
    ? value
    : DEFAULT_FOCUS_INTERVAL_MINUTES;
}

export async function saveFocusIntervalMinutes(minutes) {
  const value = Math.max(
    MIN_FOCUS_INTERVAL_MINUTES,
    Math.min(MAX_FOCUS_INTERVAL_MINUTES, Math.round(Number(minutes) / 5) * 5),
  );
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES ('focus_interval_minutes', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(value)]
  );
  return value;
}
