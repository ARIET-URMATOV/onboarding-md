import { useRef, type MouseEvent, type ReactNode } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { ImageIcon } from "lucide-react"
import { cn } from "../../lib/utils"

interface TiltedCardProps {
  image?: string
  alt?: string
  captionText?: string
  overlayContent?: ReactNode
  className?: string
  rotateAmplitude?: number
  scaleOnHover?: number
}

/**
 * Photo card with mouse-driven 3D tilt and caption overlay
 * (React Bits "Tilted Card" pattern, framer-motion implementation).
 */
export function TiltedCard({
  image,
  alt,
  captionText,
  overlayContent,
  className,
  rotateAmplitude = 12,
  scaleOnHover = 1.04,
}: TiltedCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const rotateX = useSpring(useTransform(my, [0, 1], [rotateAmplitude, -rotateAmplitude]), {
    stiffness: 200,
    damping: 20,
  })
  const rotateY = useSpring(useTransform(mx, [0, 1], [-rotateAmplitude, rotateAmplitude]), {
    stiffness: 200,
    damping: 20,
  })

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    mx.set((e.clientX - rect.left) / rect.width)
    my.set((e.clientY - rect.top) / rect.height)
  }

  const handleLeave = () => {
    mx.set(0.5)
    my.set(0.5)
  }

  return (
    <motion.figure
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      whileHover={{ scale: scaleOnHover }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card",
        className
      )}
      role="img"
      aria-label={captionText ?? alt ?? "Фото"}
    >
      {image ? (
        <img
          src={image}
          alt={alt ?? captionText ?? "Фото"}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full min-h-56 w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border bg-muted/20 p-6 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {captionText ? `Фото: ${captionText}` : "Фото"}
          </span>
          <span className="text-xs text-muted-foreground/70">скоро здесь</span>
        </div>
      )}
      {(overlayContent ?? captionText) && (
        <figcaption
          className="pointer-events-none absolute inset-x-0 bottom-0 p-5"
          style={{
            background: "linear-gradient(to top, rgba(3,6,12,0.85) 0%, transparent 100%)",
          }}
        >
          {overlayContent ?? (
            <span className="font-display text-base font-bold text-white">{captionText}</span>
          )}
        </figcaption>
      )}
    </motion.figure>
  )
}
