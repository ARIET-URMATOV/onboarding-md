interface PathSvgProps {
  /** Index of the current node (1-based). Controls how far the "active" overlay extends. */
  currentIndex: number;
  /** Path "d" attribute. Shared by dim and active layers. */
  d: string;
  /** Total path length, cached by the parent after render. */
  pathLength: number;
}

/**
 * Renders two SVG path layers:
 *  - dim full path (background)
 *  - bright animated overlay (stroke-dashoffset flow + cropped to active length)
 *
 * Animation is purely CSS via `stroke-dashoffset` — no rAF needed.
 */
export function PathSvg({ currentIndex, d, pathLength }: PathSvgProps) {
  const activeT = Math.max(0, Math.min(1, currentIndex / 5));
  const activeLen = activeT * pathLength;

  return (
    <svg className="path-svg" viewBox="0 0 1000 400" preserveAspectRatio="none">
      <defs>
        <linearGradient id="activeGrad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="60%" stopColor="#f9a8d4" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* DIM BASE — full path, always visible */}
      <path
        d={d}
        fill="none"
        stroke="#0f3856"
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.9}
      />

      {/* GLOW — soft halo on the active portion only */}
      {activeT > 0 && (
        <path
          d={d}
          fill="none"
          stroke="rgba(244,114,182,0.32)"
          strokeWidth={8}
          strokeLinecap="round"
          filter="url(#softGlow)"
          pathLength={pathLength}
          strokeDasharray={`${activeLen} ${pathLength}`}
        />
      )}

      {/* ANIMATED DASHED — the "alive road" effect via stroke-dashoffset */}
      {activeT > 0 && (
        <path
          className="flow-path"
          d={d}
          fill="none"
          stroke="url(#activeGrad)"
          strokeWidth={3}
          strokeLinecap="round"
          pathLength={pathLength}
          strokeDasharray={`${activeLen} ${pathLength}`}
        />
      )}

      {/* SOLID LEADING EDGE — bright crisp line up to current */}
      {activeT > 0 && (
        <path
          d={d}
          fill="none"
          stroke="#A5F3FC"
          strokeWidth={1.5}
          strokeLinecap="round"
          pathLength={pathLength}
          strokeDasharray={`${activeLen} ${pathLength}`}
          opacity={0.7}
        />
      )}

      <style>{`
        .path-svg{
          position:absolute; inset:0; width:100%; height:100%;
          pointer-events:none;
        }
        .flow-path{
          /* The CSS keyframe 'flow' (in theme.css) animates stroke-dashoffset.
             The dasharray above uses real units, so we use an offset in those units. */
          animation:flow 1.6s linear infinite;
        }
      `}</style>
    </svg>
  );
}
