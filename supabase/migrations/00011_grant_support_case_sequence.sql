-- ============================================================
-- Let service_role number new cases
--
-- SUPPORT_SESSION.case_number defaults to nextval('support_case_seq').
-- A column DEFAULT calls nextval() as the inserting role, and that needs
-- USAGE on the sequence. Migrations create sequences owned by postgres with
-- no grants, so every new-session insert made through the API died with
-- "permission denied for sequence support_case_seq" (42501). Identity
-- columns like CHAT_MESSAGE.id don't hit this, which is why old sessions
-- kept working while new ones failed.
-- ============================================================

GRANT USAGE ON SEQUENCE support_case_seq TO service_role;
