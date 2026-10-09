import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "../../lib/utils";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  baseOpacity?: number;
}

export function ScrollReveal({ children, className, baseOpacity = 0.3 }: ScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 90%", "end 60%"],
  });

  const opacity = useTransform(scrollYProgress, [0, 1], [baseOpacity, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [15, 0]);

  return (
    <motion.div ref={containerRef} style={{ opacity, y }} className={cn("will-change-transform", className)}>
      {children}
    </motion.div>
  );
}
