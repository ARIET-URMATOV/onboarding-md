import { motion, useReducedMotion } from "framer-motion"
import { cn } from "../../lib/utils"

interface BlurTextProps {
  text: string
  className?: string
  delay?: number
  stagger?: number
}

export function BlurText({ text, className, delay = 0, stagger = 0.04 }: BlurTextProps) {
  const reduceMotion = useReducedMotion()
  const words = text.split(" ")
  if (reduceMotion) {
    return <span className={cn("block", className)}>{text}</span>;
  }
  return (
    <motion.span
      className={cn("block", className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={{ visible: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
    >
      {words.map((word, i) => (
        <span key={i} className="inline-block whitespace-pre">
          <motion.span
            className="inline-block will-change-transform"
            variants={{
              hidden: { opacity: 0, filter: "blur(8px)", y: 8 },
              visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.5 } },
            }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </motion.span>
  )
}
