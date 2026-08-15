import { SignUpForm } from "@/modules/auth/components/sign-up-form";
import { SignUpLayout } from "@/modules/auth/components/sign-up-layout";
import { isSafeRedirectPath } from "@/modules/auth/lib/redirect-url";
import { BACK_LINK_PARAM, toBackLinkOrigin, type BackLinkSearchParams } from "@/shared/lib/back-link";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string } & BackLinkSearchParams>;
}) {
  const params = await searchParams;
  const { redirect_url } = params;
  const backOrigin = toBackLinkOrigin(params[BACK_LINK_PARAM]);
  const redirectUrl = isSafeRedirectPath(redirect_url) ? redirect_url : null;

  return (
    <SignUpLayout backOrigin={backOrigin}>
      <SignUpForm redirectUrl={redirectUrl} backOrigin={backOrigin} />
    </SignUpLayout>
  );
}
