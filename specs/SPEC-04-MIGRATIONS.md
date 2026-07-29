# SPEC-04: Database Migrations

## Migration 00002 — Add roles

File: `supabase/migrations/00002_add_admin_super_admin.sql`

```sql
ALTER TYPE user_role ADD VALUE 'admin' AFTER 'facilitator';
ALTER TYPE user_role ADD VALUE 'super_admin' AFTER 'admin';
```

## Migration 00003 — Update RLS policies

File: `supabase/migrations/00003_update_rls_for_new_roles.sql`

Update two RLS policies that hardcode `('facilitator', 'speaker')` to include
`'admin'` and `'super_admin'`:

### 1. SUPPORT_SESSION SELECT policy

Current (line 483):
```sql
EXISTS (
  SELECT 1 FROM "USER" u
  WHERE u.auth_user_id = auth.uid() AND u.role IN ('facilitator', 'speaker')
)
```

New:
```sql
EXISTS (
  SELECT 1 FROM "USER" u
  WHERE u.auth_user_id = auth.uid() AND u.role IN ('facilitator', 'speaker', 'admin', 'super_admin')
)
```

### 2. CHAT_MESSAGE SELECT policy

Same change to the `EVENT_FACILITATOR` subquery that checks facilitator role.
Add `'admin'` and `'super_admin'` to the `IN` clause.

## Migration 00004 — Course-event 1:1 ownership

File: `supabase/migrations/00004_course_event_ownership.sql`

### Changes to COURSE table

```sql
-- Add event_id (1:1, each course belongs to exactly one event)
ALTER TABLE "COURSE" ADD COLUMN event_id INT NOT NULL UNIQUE REFERENCES "EVENT"(id) ON DELETE CASCADE;

-- Add created_by (speaker who created the course)
ALTER TABLE "COURSE" ADD COLUMN created_by INT REFERENCES "USER"(id) ON DELETE SET NULL;
```

### Drop course_id from EVENT

```sql
ALTER TABLE "EVENT" DROP COLUMN course_id;
```

### Updated COURSE table schema

```sql
CREATE TABLE "COURSE" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT NOT NULL UNIQUE REFERENCES "EVENT"(id) ON DELETE CASCADE,
  course_name VARCHAR NOT NULL,
  course_description TEXT,
  created_by INT REFERENCES "USER"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
