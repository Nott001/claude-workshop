"use client";

import type { ReactNode } from "react";
import { Button } from "@/shared/components/button";
import { Form } from "@/shared/components/form";
import { SectionCard } from "@/shared/components/section-card";

interface SettingsCardProps {
  id: string;
  title: string;
  icon: string;
  description?: string;
  /** Sits opposite the title — a link out, not a save. */
  aside?: ReactNode;
  children: ReactNode;
  footer?: SettingsCardFooter;
}

interface SettingsCardFooter {
  /** Runs on submit. Absent for a card whose controls each act on their own. */
  onSave?: () => void;
  label: string;
  savingLabel?: string;
  dirty?: boolean;
  saving?: boolean;
  /** Shown in the footer once this card's own save has landed. */
  saved?: string | null;
  /** Standing note about what saving here will do. */
  note?: ReactNode;
}

/**
 * One concern, one card, one action.
 *
 * The chrome is `SectionCard`, the same panel the staff event page uses, so
 * settings and the rest of the signed-in app read as one product rather than
 * two. That component's own note warns what happens otherwise — the event page
 * grew a second identical card once, and the two drifted apart in padding and
 * heading weight. This adds only what a settings panel needs on top: a form of
 * its own, and a footer holding that form's single action.
 *
 * The page used to be one form with one Save at the foot, which made the button
 * mean whatever happened to be dirty: a press could rename the account, mail a
 * confirmation link and change the password in one go, and the confirmation
 * afterwards had to reconstruct which of those it had done. A card per concern
 * is what lets the button say what it does — "Send verification link" rather
 * than "Save Changes" — and each card being its own `<form>` means Enter
 * submits the section the cursor is in and nothing else.
 */
export function SettingsCard({ id, title, icon, description, aside, children, footer }: SettingsCardProps) {
  const body = (
    <>
      {children}
      {footer && (
        // Sits directly under the fields it saves. It was a full-bleed tinted
        // band, which needed a rule above it to read as a foot at all; without
        // the rule the band was only padding, and the button ended up floating
        // a long way from the last field.
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          {footer.note && <p className="mr-auto text-xs text-muted-fg">{footer.note}</p>}
          {footer.saved && (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <span aria-hidden className="material-symbols-rounded text-sm">
                check_circle
              </span>
              {footer.saved}
            </p>
          )}
          {footer.onSave && (
            <Button type="submit" disabled={!footer.dirty || footer.saving}>
              {footer.saving ? (footer.savingLabel ?? "Saving…") : footer.label}
            </Button>
          )}
        </div>
      )}
    </>
  );

  return (
    <SectionCard id={id} title={title} icon={icon} description={description} actions={aside} className="scroll-mt-24">
      {footer?.onSave ? (
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            footer.onSave?.();
          }}
        >
          {body}
        </Form>
      ) : (
        body
      )}
    </SectionCard>
  );
}
