import { SignIn } from "@clerk/nextjs";
import { AuthLayout } from "@/components/auth-layout";

export default function SignInPage() {
  return (
    <AuthLayout alternateAction={{ label: "Sign up", href: "/sign-up" }}>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/events"
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
            formResendCodeLink: "text-accent hover:text-accent/80",
          },
        }}
      />
    </AuthLayout>
  );
}
