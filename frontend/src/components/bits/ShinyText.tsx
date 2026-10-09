import { cn } from "../../lib/utils"

interface ShinyTextProps {
  text: string
  className?: string
}

export function ShinyText({ text, className }: ShinyTextProps) {
  return (
    <>
      <style>{`@keyframes rb-shine { to { background-position: -200% center; } } @media (prefers-reduced-motion: reduce) { .rb-shiny { animation: none !important; } }`}</style>
      <span
        className={cn("rb-shiny inline-block", className)}
        style={{
          background: "linear-gradient(110deg, currentColor 40%, #ffffff 50%, currentColor 60%)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          animation: "rb-shine 3s linear infinite",
        }}
      >
        {text}
      </span>
    </>
  )
}
