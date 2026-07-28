import { SignInForm } from "@/modules/auth";
import { AuthLayout } from "@/modules/auth/components/auth-layout";

export default function SignInPage() {
  return (
    <AuthLayout>
      <SignInForm />
    </AuthLayout>
  );
}
