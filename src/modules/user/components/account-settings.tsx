"use client";

import { Toast } from "@/shared/components/toast";
import { StaffPage, StaffPageHeader } from "@/shared/components/staff-page";
import { BackLink } from "@/shared/components/back-link";
import { useAccountSettings } from "@/modules/user/lib/use-account-settings";
import { ProfileSection } from "@/modules/user/components/profile-section";
import { EmailSection } from "@/modules/user/components/email-section";
import { PasswordSection } from "@/modules/user/components/password-section";
import { SpeakerProfileSection } from "@/modules/user/components/speaker-profile-section";
import { DeleteAccountSection } from "@/modules/user/components/delete-account-section";

export function AccountSettings() {
  const { toast, dismissToast, currentUser, profile, email, password, speaker, photo } = useAccountSettings();

  return (
    <StaffPage>
      <BackLink href="/" className="mb-6">
        Back to Home
      </BackLink>
      <StaffPageHeader title="Account Settings" description="Manage your account, security, and profile." />

      {/* Stacked full-width panels in the page column, laid out exactly as the
          staff event page lays out its own — same frame, same card, same
          spacing — so moving between them is not a change of shape. The width
          is spent inside each card, on field grids that go multi-column, rather
          than on one long ladder of inputs. */}
      <div className="space-y-6">
        <ProfileSection profile={profile} photo={photo} email={currentUser?.email} role={currentUser?.role} />
        <EmailSection currentEmail={currentUser?.email} email={email} />
        <PasswordSection password={password} context={{ email: currentUser?.email, fullName: currentUser?.full_name }} />
        {speaker.isSpeaker && <SpeakerProfileSection speaker={speaker} />}
        <DeleteAccountSection />
      </div>

      {toast && (
        <div className="fixed bottom-4 right-8 z-50">
          <Toast key={toast.id} title={toast.title} description={toast.description} type={toast.type} onClose={dismissToast} />
        </div>
      )}
    </StaffPage>
  );
}
