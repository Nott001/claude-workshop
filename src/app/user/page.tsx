import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/lib/session";
import { AccountSettings } from "@/modules/user/components/account-settings";

export default async function UserSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?redirect_url=/user");
  }
  return <AccountSettings />;
}
