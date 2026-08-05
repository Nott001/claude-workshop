import { SignInForm } from "@/modules/auth/components/sign-in-form";
import { AuthLayout } from "@/modules/auth/components/auth-layout";

export default function SignInPage() {
  return (
    <AuthLayout>
      <SignInForm />
    </AuthLayout>
  );
}
