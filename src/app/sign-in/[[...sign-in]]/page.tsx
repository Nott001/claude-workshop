import { SignInForm } from "@/modules/auth/components/sign-in-form";
import { AuthLayout } from "@/modules/auth/components/auth-layout";
import { isSafeRedirectPath } from "@/modules/auth/lib/redirect-url";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string }> }) {
  const { redirect_url } = await searchParams;
  const redirectUrl = isSafeRedirectPath(redirect_url) ? redirect_url : null;

  return (
    <AuthLayout>
      <SignInForm redirectUrl={redirectUrl} />
    </AuthLayout>
  );
}
