import { UserProfile } from "@clerk/nextjs";
import Link from "next/link";

export default function UserSettingsPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <div className="mx-auto w-full max-w-[896px] px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#647078] transition-colors hover:text-[#1b1c1c]"
        >
          <span className="material-symbols-rounded text-base">arrow_back</span>
          Back
        </Link>
        <UserProfile routing="hash" />
      </div>
    </div>
  );
}
