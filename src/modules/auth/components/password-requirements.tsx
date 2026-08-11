"use client";

import { evaluatePassword, type PasswordContext } from "@/shared/lib/password-policy";
import { cn } from "@/shared/lib/utils";

interface PasswordRequirementsProps {
  password: string;
  context?: PasswordContext;
}

/**
 * The rules as a live checklist, rendered from the same evaluation the server
 * refuses on, so the two cannot drift into telling the user different things.
 *
 * A checklist rather than a strength score: a score says "weak" without saying
 * what to change, and every rule here is pass or fail anyway.
 */
export function PasswordRequirements({ password, context }: PasswordRequirementsProps) {
  const { rules } = evaluatePassword(password, context);
  const met = rules.filter((rule) => rule.passed).length;

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden>
        {rules.map((rule) => (
          <span
            key={rule.id}
            className={cn("h-1 flex-1 rounded-full transition-colors", rule.passed ? "bg-success" : "bg-muted")}
          />
        ))}
      </div>
      <ul className="mt-2 space-y-1">
        {rules.map((rule) => (
          <li key={rule.id} className={cn("flex items-center gap-1.5 text-xs", rule.passed ? "text-muted-fg" : "text-fg")}>
            <span
              aria-hidden
              className={cn("material-symbols-rounded text-[14px]", rule.passed ? "text-success" : "text-muted-fg")}
            >
              {rule.passed ? "check_circle" : "radio_button_unchecked"}
            </span>
            {rule.label}
          </li>
        ))}
      </ul>
      {/* The list above is decorative repetition for a screen reader on every
          keystroke; this says the same thing once, politely. */}
      <p className="sr-only" role="status">
        {met} of {rules.length} password requirements met.
      </p>
    </div>
  );
}
