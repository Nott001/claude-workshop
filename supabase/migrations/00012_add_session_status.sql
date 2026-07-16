ALTER TABLE "LIVE_SESSION_STATE"
ADD COLUMN session_status VARCHAR NOT NULL DEFAULT 'scheduled'
CHECK (session_status IN ('scheduled', 'live', 'ended'));