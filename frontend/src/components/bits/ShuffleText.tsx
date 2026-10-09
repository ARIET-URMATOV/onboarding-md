import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "../../lib/utils";

interface ShuffleTextProps {
  text: string;
  className?: string;
  delay?: number;
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#%&*";

export function ShuffleText({ text, className, delay = 0 }: ShuffleTextProps) {
  const [displayText, setDisplayText] = useState("");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  useEffect(() => {
    if (!isInView) return;

    const startTimeout = window.setTimeout(() => {
      let iteration = 0;
      const maxIterations = text.length;
      
      const interval = window.setInterval(() => {
        setDisplayText(() => {
          return text
            .split("")
            .map((char, index) => {
              if (index < iteration) {
                return text[index];
              }
              if (char === " ") return " ";
              return CHARS[Math.floor(Math.random() * CHARS.length)];
            })
            .join("");
        });

        if (iteration >= maxIterations) {
          clearInterval(interval);
        }

        iteration += 1 / 3; 
      }, 30);

      return () => clearInterval(interval);
    }, delay * 1000);

    return () => {
      clearTimeout(startTimeout);
    };
  }, [text, delay, isInView]);

  return (
    <motion.span
      ref={ref}
      className={cn("inline-block", className)}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.1, delay }}
    >
      {displayText || text.replace(/./g, "\u00A0")}
    </motion.span>
  );
}
