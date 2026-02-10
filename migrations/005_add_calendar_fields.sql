-- Add Calendar features to events table
-- Date: 2026-02-10

ALTER TABLE events ADD COLUMN "eventType" VARCHAR(50) DEFAULT 'event'; -- meeting, booth, outing
ALTER TABLE events ADD COLUMN "startTime" VARCHAR(10); -- HH:mm (24hr)
ALTER TABLE events ADD COLUMN "endTime" VARCHAR(10); -- HH:mm (24hr)
ALTER TABLE events ADD COLUMN "location" TEXT;
ALTER TABLE events ADD COLUMN "targetGroup" VARCHAR(50) DEFAULT 'Troop'; -- Troop, Pack, Lion, AOL, etc.

CREATE INDEX idx_events_troopId_date ON events("troopId", "eventDate");
