import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { cn } from "../../lib/utils"

interface HeroSequenceProps {
  introText: string
  finalText: string
  className?: string
  introHoldMs?: number
  finalClassName?: string
}

type Phase = "intro" | "exit" | "final"

/**
 * Two-phase hero timeline: intro line blurs in, holds, blurs out —
 * then the final statement rises once. Reduced-motion renders final immediately.
 */
export function HeroSequence({
  introText,
  finalText,
  className,
  introHoldMs = 1700,
  finalClassName,
}: HeroSequenceProps) {
  const reduceMotion = useReducedMotion()
  const [phase, setPhase] = useState<Phase>("intro")

  useEffect(() => {
    if (reduceMotion) return
    const t1 = window.setTimeout(() => setPhase("exit"), 900 + introHoldMs)
    const t2 = window.setTimeout(() => setPhase("final"), 900 + introHoldMs + 550)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [reduceMotion, introHoldMs])

  if (reduceMotion) {
    return (
      <div className={cn("relative", className)} aria-live="polite">
        <h1
          className={cn(
            "font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-primary sm:text-7xl",
            finalClassName
          )}
        >
          {finalText}
        </h1>
      </div>
    )
  }

  return (
    <div className={cn("relative", className)} aria-live="polite">
      <AnimatePresence mode="wait">
        {phase !== "final" ? (
          <motion.p
            key="hero-intro"
            className="font-display text-xl font-medium text-muted-foreground sm:text-2xl"
            initial={{ opacity: 0, filter: "blur(10px)", y: 10 }}
            animate={
              phase === "intro"
                ? { opacity: 1, filter: "blur(0px)", y: 0 }
                : { opacity: 0, filter: "blur(10px)", y: -10 }
            }
            exit={{ opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: phase === "intro" ? 0.9 : 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {introText}
          </motion.p>
        ) : (
          <motion.h1
            key="hero-final"
            className={cn(
              "font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-primary sm:text-7xl",
              finalClassName
            )}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: "40%", filter: "blur(12px)" }}
            animate={{ opacity: 1, y: "0%", filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {finalText}
          </motion.h1>
        )}
      </AnimatePresence>
    </div>
  )
}
