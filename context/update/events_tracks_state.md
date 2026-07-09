# Events now track state

We updated our schema to have events track its state. The corresponding SQL command is:

```sql
CREATE TYPE event_status AS ENUM ('draft', 'active', 'complete');

-- 4. Add the column back
ALTER TABLE "EVENTS"
  ADD COLUMN status event_status NOT NULL DEFAULT 'draft';
```

We have also updated our supabase so these changes are live. Update all coresponding documents in @context and @context/spec to reflect these changes. Ensure
updates are also made to @supabase/migrations. I also forgot to include @docs/update_table_include_price.sql. Make sure it updates the correct migration script.
Also update the way events are handled so that when they're in draft, users cannot see them in the event list only after it's either active or completed.

Verify all changes are now correct according to the new spec sheets. Make sure you've also updated the @context/functional-planning.md and that it's checked against these.
