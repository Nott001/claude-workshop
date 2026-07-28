import { SignUpForm } from "@/modules/auth";
import { AuthLayout } from "@/modules/auth/components/auth-layout";

export default function SignUpPage() {
  return (
    <AuthLayout>
      <SignUpForm />
    </AuthLayout>
  );
}
