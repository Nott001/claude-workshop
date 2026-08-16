-- Cancel voids a pending email change at the source. GoTrue keeps the
-- one_time_tokens row and auth.users.email_change live until the link expires,
-- so a plain client-side dismiss left the mailed link usable for 24h. Deleting
-- the token is what makes a stale link fail as otp_expired; clearing the user's
-- fields stops the reload-restore effect from re-showing the pending banner and
-- resets the 60s resend gate. Runs as its owner through the same SECURITY
-- DEFINER seam as public.qa_message_visible. Scoped by auth.uid() so a caller
-- can only cancel their own change; a service key carries no JWT sub claim, so
-- it is deliberately a no-op there and gets no grant.
--
-- email_change is reset to '' (not NULL) on purpose: that is the seed's clean
-- state, and GoTrue v2.195.0 scans this column into a plain string, so a NULL
-- value makes every later getUser/updateUser for the user answer 500.

CREATE OR REPLACE FUNCTION "public"."cancel_pending_email_change"()
RETURNS void
LANGUAGE sql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DELETE FROM "auth"."one_time_tokens"
  WHERE "user_id" = auth.uid()
    AND "token_type" IN ('email_change_token_new', 'email_change_token_current');
  UPDATE "auth"."users"
  SET "email_change" = '',
      "email_change_sent_at" = NULL,
      "email_change_token_new" = '',
      "email_change_token_current" = '',
      "email_change_confirm_status" = 0
  WHERE "id" = auth.uid();
$function$;

ALTER FUNCTION "public"."cancel_pending_email_change"() OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."cancel_pending_email_change"() TO "authenticated";
