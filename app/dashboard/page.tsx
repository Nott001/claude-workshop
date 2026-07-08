import { currentUser } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";

export default async function DashboardPage() {
  const result = await requireRole("facilitator");

  if (!result.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive text-lg font-medium">Access denied</p>
      </div>
    );
  }

  const clerkUser = await currentUser();

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-foreground mb-2 text-3xl font-bold">Facilitator Dashboard</h1>
      <p className="text-muted-foreground">Welcome, {clerkUser?.fullName ?? "Facilitator"}</p>
    </div>
  );
}
