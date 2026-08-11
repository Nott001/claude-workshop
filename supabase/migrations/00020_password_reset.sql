-- ============================================================
-- Password reset
--
-- Until now a locked-out account had no way back in: the only password change
-- is `auth.updateUser({password})`, which needs a session the user cannot get.
-- The sign-in form has linked to /forgot-password since it was written, and
-- that address 404s.
--
-- The reset mail is sent by this project rather than by Supabase, the same way
-- invitations are, so the message uses our template, transport and mail server
-- instead of one that can only be edited in a dashboard.
--
-- PASSWORD_RESET_ATTEMPT exists only to rate-limit that endpoint. It is
-- unauthenticated and it sends mail on demand, which makes it both a mail-bomb
-- vector and an enumeration oracle; the existing limiter in support-service
-- counts rows per USER id and is useless here, because there is no session.
-- A table rather than KV or a Durable Object: counting rows in a window is
-- what the other limiter already does, and it keeps the thresholds in version
-- control instead of welding this to one host's primitives.
--
-- Access is service-client only: no grants, RLS on with no policies, so the
-- anon and authenticated roles cannot read who has been requesting resets.
-- ============================================================

CREATE TABLE "PASSWORD_RESET_ATTEMPT" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Stored lowercased. Recorded whether or not the address owns an account:
  -- skipping the unknown ones would make the table itself an enumeration hint.
  email VARCHAR NOT NULL,
  -- Null when the request arrives without CF-Connecting-IP, which is every
  -- request under `next dev`. The per-email limit still applies.
  ip VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_attempt_email ON "PASSWORD_RESET_ATTEMPT"(email, created_at DESC);
CREATE INDEX idx_password_reset_attempt_ip ON "PASSWORD_RESET_ATTEMPT"(ip, created_at DESC);

ALTER TABLE "PASSWORD_RESET_ATTEMPT" ENABLE ROW LEVEL SECURITY;

-- Completions only. A request is attacker-controllable, so auditing those would
-- hand anyone a way to flood the trail; a completion means a token was actually
-- spent. The value must not be *used* in this migration: an enum value added by
-- ALTER TYPE is not visible until the transaction ends.
ALTER TYPE audit_action ADD VALUE 'auth.password_reset_completed';
