import { cn } from "../../lib/utils"

interface GradientLineProps {
  className?: string
  colorClass?: string
}

export function GradientLine({ className, colorClass = "via-border" }: GradientLineProps) {
  return (
    <div className={cn("flex w-full justify-center", className)} aria-hidden="true">
      <div className={cn("h-px w-full max-w-5xl bg-gradient-to-r from-transparent to-transparent", colorClass)} />
    </div>
  )
}
