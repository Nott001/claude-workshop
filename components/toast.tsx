"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ToastProps {
  title: string;
  description?: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose?: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  success: "check_circle",
  error: "error",
  info: "info",
};

const TYPE_COLORS: Record<string, string> = {
  success: "text-green-500",
  error: "text-red-500",
  info: "text-blue-400",
};

export function Toast({ title, description, type = "success", duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  return (
    <div className="inline-flex items-center gap-2.5 rounded-md border border-border-strong bg-surface px-4 py-3 shadow-md">
      <span className={cn("material-symbols-rounded text-xl", TYPE_COLORS[type])}>{TYPE_ICONS[type]}</span>
      <div>
        <strong className="block text-[13px] font-semibold text-foreground">{title}</strong>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
    </div>
  );
}
