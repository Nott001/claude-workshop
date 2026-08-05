import { SignUpForm } from "@/modules/auth/components/sign-up-form";
import { AuthLayout } from "@/modules/auth/components/auth-layout";

export default function SignUpPage() {
  return (
    <AuthLayout>
      <SignUpForm />
    </AuthLayout>
  );
}
