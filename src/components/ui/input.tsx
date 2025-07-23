
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-7 w-full rounded-md bg-lunar-surface px-3 py-1 text-xs text-lunar-text shadow-sm border border-transparent transition-all duration-150 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-lunar-text placeholder:text-lunar-textSecondary placeholder:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lunar-accent focus-visible:border-lunar-accent disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
