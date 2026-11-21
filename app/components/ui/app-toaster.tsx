"use client";

import type { ReactNode } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CheckIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

/** 轻拟物 Toast 状态图标：圆形渐变底 + 白色线性图标（参照 v008） */
const stateIcon = (
  icon: ReactNode,
  tone: "success" | "error" | "warning" | "info"
) => (
  <span className={`skeu-toast-ico ${tone}`} aria-hidden>
    {icon}
  </span>
);

export function Toaster(props: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      offset={84}
      icons={{
        success: stateIcon(<CheckIcon className="size-4" strokeWidth={3} />, "success"),
        error: stateIcon(<XIcon className="size-4" strokeWidth={3} />, "error"),
        warning: stateIcon(
          <TriangleAlertIcon className="size-4" strokeWidth={2.6} />,
          "warning"
        ),
        info: stateIcon(<InfoIcon className="size-4" strokeWidth={2.6} />, "info"),
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--sk-border)",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "skeu-toast",
        },
      }}
      {...props}
    />
  );
}
