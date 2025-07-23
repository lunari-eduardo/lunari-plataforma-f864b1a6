
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lunar-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-lunar-accent text-lunar-text shadow-sm hover:bg-lunar-accentHover hover:shadow-lunar-hover hover:translate-y-[-1px] active:translate-y-0",
        destructive: "bg-lunar-error text-white shadow-sm hover:bg-lunar-error/90 hover:shadow-lunar-hover hover:translate-y-[-1px] active:translate-y-0",
        outline: "border border-lunar-border bg-lunar-surface text-lunar-text hover:bg-lunar-bg hover:shadow-lunar-sm hover:translate-y-[-1px] active:translate-y-0",
        secondary: "bg-lunar-surface text-lunar-textSecondary shadow-sm hover:bg-lunar-bg hover:text-lunar-text hover:shadow-lunar-sm hover:translate-y-[-1px] active:translate-y-0",
        ghost: "text-lunar-text hover:bg-lunar-surface/50 hover:text-lunar-text hover:shadow-lunar-sm hover:translate-y-[-1px] active:translate-y-0",
        link: "text-lunar-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-7 px-3 py-1",
        sm: "h-6 rounded px-2 text-2xs",
        lg: "h-8 rounded-md px-4 text-sm",
        icon: "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
