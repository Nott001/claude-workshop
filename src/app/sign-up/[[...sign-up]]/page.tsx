import { SignUp } from "@clerk/nextjs";
import { AuthLayout } from "@/components/auth-layout";

export default function SignUpPage() {
  return (
    <AuthLayout alternateAction={{ label: "Sign in", href: "/sign-in" }}>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        afterSignUpUrl="/"
        appearance={{
          elements: {
            rootBox: "w-full max-w-[350px]",
            card: "bg-transparent border-0 shadow-none",
            headerTitle: "text-foreground text-xl font-bold",
            headerSubtitle: "text-muted-foreground text-xs",
            formFieldLabel: "text-muted-foreground text-sm font-medium",
            formFieldInput: "bg-surface border-border text-foreground placeholder:text-muted-foreground",
            formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
            footerActionLink: "text-accent hover:text-accent/80",
            socialButtonsBlockButton: "bg-surface border-border text-foreground hover:bg-surface-hover",
            socialButtonsBlockButtonText: "text-foreground",
            dividerLine: "bg-border",
            dividerText: "text-muted-foreground",
            checkboxLabel: "text-muted-foreground",
            formFieldInputShowPasswordButton: "text-muted-foreground",
          },
        }}
      />
    </AuthLayout>
  );
}
