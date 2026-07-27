import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getServiceClient } from "@/lib/db";
import { userDao } from "@/lib/db/dao";
import type { UserRole } from "@/types";

const STAFF_ROLES: UserRole[] = ["facilitator", "speaker"];

export default async function StaffLoginPage() {
  const { userId } = await auth();

  if (userId) {
    const supabase = getServiceClient();
    const dbUser = await userDao.findByAuthIdWithRole(supabase, userId);

    if (!dbUser || !STAFF_ROLES.includes(dbUser.role as UserRole)) {
      redirect("/events");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="flex w-full max-w-[240px] flex-col items-center gap-2.5 text-center">
        <svg className="size-[22px] text-accent" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <div className="text-sm font-bold text-foreground">Staff login</div>
        <div className="text-[10.5px] text-muted-foreground">Access the internal portal</div>
        <SignIn
          routing="path"
          path="/staff-login"
          afterSignInUrl="/events"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-transparent border-0 shadow-none w-full",
              headerTitle: "sr-only",
              headerSubtitle: "sr-only",
              formFieldLabel: "text-muted-foreground text-sm font-medium",
              formFieldInput: "bg-surface border-border text-foreground placeholder:text-muted-foreground",
              formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 w-full",
              footerActionLink: "text-accent hover:text-accent/80",
              socialButtonsBlockButton: "bg-surface border-border text-foreground hover:bg-surface-hover",
              socialButtonsBlockButtonText: "text-foreground",
              dividerLine: "bg-border",
              dividerText: "text-muted-foreground",
              formResendCodeLink: "text-accent hover:text-accent/80",
            },
          }}
        />
      </div>
    </div>
  );
}
