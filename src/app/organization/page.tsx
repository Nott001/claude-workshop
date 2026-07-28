"use client";

import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { Footer } from "@/shared/components/footer";

interface Member {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

export default function OrganizationPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/organization")
      .then((r) => r.json())
      .then((data) => setMembers(data.members ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto max-w-4xl flex-1 p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Manage staff</h1>
          <Button disabled>
            <span className="material-symbols-rounded text-[18px]">person_add</span>
            Invite member
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading members...</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members found.</p>
        ) : (
          <div className="rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{m.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                    <td className="px-4 py-3">{m.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer role="facilitator" />
    </div>
  );
}
