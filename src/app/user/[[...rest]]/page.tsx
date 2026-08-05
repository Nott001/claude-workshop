import { redirect } from "next/navigation";
import { requireAuth } from "@/modules/auth/lib/session";
import { AccountSettings } from "@/modules/user/components/account-settings";

export default async function UserSettingsPage() {
  const user = await requireAuth();
  if (!user) {
    redirect("/sign-in?redirect_url=/user");
  }
  return <AccountSettings />;
}
