import { motion } from "framer-motion"
import type { ReactNode } from "react"
import { cn } from "../../lib/utils"

interface FadeContentProps {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
}

export function FadeContent({ children, className, delay = 0, y = 16 }: FadeContentProps) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
