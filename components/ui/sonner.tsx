"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { Loader2Icon } from "lucide-react"

/** 参照 v008：圆形渐变状态图标（成功绿 / 失败红 / 警告琥珀） */
const stateIcon = (glyph: string, tone: "success" | "error" | "warning") => (
  <span className={`skeu-toast-ico ${tone}`} aria-hidden>
    {glyph}
  </span>
)

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      offset={84}
      icons={{
        success: stateIcon("✓", "success"),
        error: stateIcon("✕", "error"),
        warning: stateIcon("!", "warning"),
        info: stateIcon("i", "warning"),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "#ffffff",
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
  )
}

export { Toaster }