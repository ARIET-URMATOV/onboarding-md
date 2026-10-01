import { motion } from "framer-motion"
import { cn } from "../../lib/utils"

interface SplitTextProps {
  text: string
  className?: string
  delay?: number
  stagger?: number
  as?: "h1" | "h2" | "p" | "span"
}

export function SplitText({ text, className, delay = 0, stagger = 0.03, as = "span" }: SplitTextProps) {
  const words = text.split(" ")
  const MotionTag = motion[as] as typeof motion.span
  return (
    <MotionTag
      className={cn("inline", className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={{ visible: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
    >
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden pb-1 -mb-1 align-bottom">
          <motion.span
            className="inline-block will-change-transform"
            variants={{ hidden: { y: "110%" }, visible: { y: "0%", transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  )
}
