import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/shared/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  // 数值输入框聚焦时浏览器会将滚轮转为改值操作，易误触；
  // 通过原生非被动监听拦截（React 合成 onWheel 为被动监听，无法 preventDefault），
  // 仅阻止聚焦状态下的滚轮改值，不 blur、不影响页面滚动
  const handleRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      if (!node || type !== "number") return
      const onWheel = (e: WheelEvent) => {
        if (document.activeElement === node) {
          e.preventDefault()
        }
      }
      node.addEventListener("wheel", onWheel, { passive: false })
      return () => node.removeEventListener("wheel", onWheel)
    },
    [type]
  )

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      ref={handleRef}
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-transparent bg-input/50 px-2.5 py-1 text-sm transition-[color,border-color] duration-200 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        type === "number" && "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
      {...props}
    />
  )
}

export { Input }
