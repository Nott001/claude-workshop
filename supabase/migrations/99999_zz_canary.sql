-- CANARY — a table with no RLS, to prove the RLS policy check actually fails.
CREATE TABLE canary_unprotected (
  id bigserial PRIMARY KEY,
  secret_note text
);
