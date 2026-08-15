import { AuthCardLayout } from "@/modules/auth/components/auth-card-layout";
import { ForgotPasswordForm } from "@/modules/auth/components/forgot-password-form";
import { BACK_LINK_PARAM, toBackLinkOrigin, type BackLinkSearchParams } from "@/shared/lib/back-link";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<BackLinkSearchParams> }) {
  const backOrigin = toBackLinkOrigin((await searchParams)[BACK_LINK_PARAM]);

  return (
    <AuthCardLayout backOrigin={backOrigin}>
      <ForgotPasswordForm />
    </AuthCardLayout>
  );
}
