import { SignUpForm } from "@/modules/auth";
import { AuthLayout } from "@/components/auth-layout";

export default function SignUpPage() {
  return (
    <AuthLayout>
      <SignUpForm />
    </AuthLayout>
  );
}
