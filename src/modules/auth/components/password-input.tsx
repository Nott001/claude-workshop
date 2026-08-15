"use client";

import * as React from "react";
import { useState } from "react";
import { IconInput } from "./icon-input";

/**
 * A password field that can show what was typed.
 *
 * Reveal is the defence a confirmation field cannot be: retyping catches a typo
 * made twice differently, and nothing else. Seeing the characters catches the
 * one made twice the same way, and is the only way to check a passphrase on a
 * phone keyboard. The two are complementary, so the sign-up form uses both.
 *
 * The toggle stays in the tab order. It is a control a keyboard user needs
 * more than a mouse user, not less.
 */
type PasswordInputProps = Omit<React.ComponentProps<typeof IconInput>, "type" | "endAdornment">;

function PasswordInput({ icon, ...props }: PasswordInputProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <IconInput
      icon={icon}
      type={revealed ? "text" : "password"}
      endAdornment={
        <button
          type="button"
          onClick={() => setRevealed((shown) => !shown)}
          aria-label={revealed ? "Hide password" : "Show password"}
          aria-pressed={revealed}
          className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-fg transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span aria-hidden className="material-symbols-rounded text-[18px]">
            {revealed ? "visibility_off" : "visibility"}
          </span>
        </button>
      }
      {...props}
    />
  );
}

export { PasswordInput };
