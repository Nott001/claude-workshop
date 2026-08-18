import * as React from "react";
import { Input } from "@/shared/components/input";
import { FormField, FormLabel, FormMessage, FormDescription } from "@/shared/components/form";

interface TextFieldProps extends Omit<React.ComponentProps<"input">, "id" | "onChange"> {
  id: string;
  label?: string;
  /** The value, handed over already unwrapped — no caller reads `e.target`. */
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
  /** Replaces the `<input>`, for the one field that is a textarea. */
  render?: (props: RenderedControlProps) => React.ReactNode;
}

/**
 * What a control needs to be labelled and described the same way `Input` is.
 * Handed to `render` so an alternative control cannot quietly drop the wiring.
 */
export interface RenderedControlProps {
  id: string;
  value: string | number | readonly string[] | undefined;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

/**
 * A labelled control with its message and ARIA wiring.
 *
 * The four pieces were spelled out at every field — label, input, the
 * conditional message, and the `aria-invalid`/`aria-describedby` pair tying
 * them together. Fourteen fields across the settings and dialog forms repeated
 * it, which is both the bulk of those files and four chances each to wire the
 * description to an id that is not there. The ids are derived from one prop
 * here, so a field cannot be labelled without also being described.
 */
export function TextField({ id, label, onChange, error, hint, render, ...props }: TextFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  // Both, when both exist: a field can carry standing guidance and a rejection
  // at once, and naming only the error would silence the hint for a screen
  // reader exactly when the user most needs it.
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  const control: RenderedControlProps = {
    id,
    value: props.value,
    onChange: (e) => onChange(e.target.value),
    "aria-invalid": !!error,
    "aria-describedby": describedBy,
  };

  return (
    <FormField>
      {label && <FormLabel htmlFor={id}>{label}</FormLabel>}
      {render ? render(control) : <Input {...props} {...control} />}
      {hint && (
        <FormDescription id={hintId} className="text-xs">
          {hint}
        </FormDescription>
      )}
      {error && (
        <FormMessage id={errorId} role="alert">
          {error}
        </FormMessage>
      )}
    </FormField>
  );
}
