import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center border-l-2 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-l-primary bg-primary/10 text-primary",
        secondary: "border-l-[#72787e] bg-secondary text-secondary-foreground",
        destructive: "border-l-destructive bg-destructive/10 text-destructive",
        outline: "border-l-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
