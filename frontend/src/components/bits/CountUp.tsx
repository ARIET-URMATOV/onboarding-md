import { useEffect, useRef, useState } from "react"
import { useInView, animate, useReducedMotion } from "framer-motion"
import { cn } from "../../lib/utils"

interface CountUpProps {
  to: number
  duration?: number
  className?: string
}

export function CountUp({ to, duration = 1.5, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduceMotion = useReducedMotion()
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!inView || reduceMotion) return
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setVal(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, to, duration, reduceMotion])

  return (
    <span ref={ref} className={cn(className)}>
      {(reduceMotion ? to : val).toLocaleString("ru-RU")}
    </span>
  )
}
