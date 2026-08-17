-- Issue #240: QR tokens shrink from 64 hex chars to 6, and a 16M-code space
-- cannot stay unique in a relational sense forever. Codes are repooled when a
-- ticket is checked in or cancelled, so uniqueness is enforced application-side
-- against active (issued) tickets only, at issue time. The NOT NULL and the
-- btree index for lookups stay; only the global constraint goes.

ALTER TABLE "public"."TICKET" DROP CONSTRAINT "TICKET_qr_token_key";