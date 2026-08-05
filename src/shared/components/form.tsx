import * as React from "react";
import { cn } from "@/shared/lib/utils";

function Form({ className, ...props }: React.ComponentProps<"form">) {
  return <form className={cn(className)} {...props} />;
}

function FormField({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5", className)} {...props} />;
}

function FormLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("text-sm leading-none font-medium select-none disabled:pointer-events-none disabled:opacity-50", className)}
      {...props}
    />
  );
}

function FormMessage({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-error", className)} {...props} />;
}

function FormDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-fg", className)} {...props} />;
}

export { Form, FormField, FormLabel, FormMessage, FormDescription };
