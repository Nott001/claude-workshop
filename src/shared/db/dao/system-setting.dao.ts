import type { z } from "zod";
import type { DbClient } from "./types";
import { throwOnDbError } from "./helpers";

/**
 * Key/value access to SYSTEM_SETTING, the jsonb store for settings an operator
 * changes without a deploy.
 *
 * The table is granted to `service_role` only and carries no read policy, so
 * every caller here must be a server route holding the service client. Values
 * are parsed through the caller's schema rather than cast: a row edited by
 * hand in the dashboard is the expected way to change one, so a malformed
 * value must degrade to the caller's fallback instead of reaching a gate as an
 * unchecked shape.
 */
export async function getSetting<T>(supabase: DbClient, key: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  const { data, error } = await supabase.from("SYSTEM_SETTING").select("setting_value").eq("setting_key", key).maybeSingle();
  throwOnDbError(error, "system-setting.dao.getSetting");
  if (!data) return fallback;

  const parsed = schema.safeParse(data.setting_value);
  if (!parsed.success) {
    console.error(`system-setting.dao.getSetting rejected ${key}:`, parsed.error.message);
    return fallback;
  }
  return parsed.data;
}

export async function setSetting(supabase: DbClient, key: string, value: unknown, updatedBy: number): Promise<boolean> {
  const { error } = await supabase.from("SYSTEM_SETTING").upsert(
    {
      setting_key: key,
      setting_value: value,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "setting_key" },
  );

  if (error) {
    console.error("system-setting.dao.setSetting failed:", error.message, error.code);
    return false;
  }
  return true;
}
