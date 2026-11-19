PRAGMA foreign_keys = ON;

CREATE TABLE devices (
  device_id TEXT PRIMARY KEY,
  token_hash BLOB NOT NULL UNIQUE CHECK (length(token_hash) = 32),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE TABLE push_subscriptions (
  device_id TEXT PRIMARY KEY REFERENCES devices(device_id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL CHECK (length(endpoint) BETWEEN 12 AND 2048),
  p256dh TEXT NOT NULL CHECK (length(p256dh) BETWEEN 1 AND 512),
  auth TEXT NOT NULL CHECK (length(auth) BETWEEN 1 AND 512),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0)
);

CREATE TABLE reminder_schedules (
  device_id TEXT PRIMARY KEY REFERENCES devices(device_id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  local_time TEXT NOT NULL CHECK (
    length(local_time) = 5
    AND local_time GLOB '[0-9][0-9]:[0-9][0-9]'
    AND substr(local_time, 3, 1) = ':'
    AND CAST(substr(local_time, 1, 2) AS INTEGER) BETWEEN 0 AND 23
    AND CAST(substr(local_time, 4, 2) AS INTEGER) BETWEEN 0 AND 59
  ),
  timezone TEXT NOT NULL CHECK (length(timezone) BETWEEN 1 AND 128),
  weekday_mask INTEGER NOT NULL CHECK (weekday_mask BETWEEN 0 AND 127),
  next_due_at INTEGER CHECK (next_due_at IS NULL OR next_due_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  CHECK (enabled = 0 OR weekday_mask > 0)
);

CREATE INDEX idx_devices_active ON devices(revoked_at, created_at);
CREATE INDEX idx_reminder_schedules_due
  ON reminder_schedules(enabled, next_due_at, device_id)
  WHERE enabled = 1 AND next_due_at IS NOT NULL;
