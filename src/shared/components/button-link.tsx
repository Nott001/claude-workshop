"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "@/shared/components/button";

/** A real link painted as a button. Base UI's Button cannot be one without
 *  forcing button semantics onto the anchor, so links stay real anchors. */
function ButtonLink({
  className,
  variant = "secondary",
  size = "sm",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonStyles({ variant, size, className })} {...props} />;
}

export { ButtonLink };
