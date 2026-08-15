import { SignInForm } from "@/modules/auth/components/sign-in-form";
import { AuthCardLayout } from "@/modules/auth/components/auth-card-layout";
import { isSafeRedirectPath } from "@/modules/auth/lib/redirect-url";
import { BACK_LINK_PARAM, toBackLinkOrigin, type BackLinkSearchParams } from "@/shared/lib/back-link";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string } & BackLinkSearchParams>;
}) {
  const params = await searchParams;
  const { redirect_url } = params;
  const backOrigin = toBackLinkOrigin(params[BACK_LINK_PARAM]);
  const redirectUrl = isSafeRedirectPath(redirect_url) ? redirect_url : null;

  return (
    <AuthCardLayout backOrigin={backOrigin}>
      <SignInForm redirectUrl={redirectUrl} backOrigin={backOrigin} />
    </AuthCardLayout>
  );
}
