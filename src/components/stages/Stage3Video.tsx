import { useRef, useState } from 'react';
import type { StageId } from '../../data/stages';

interface Props { stageId: StageId }

// Inline SVG poster — no external assets needed
const POSTER = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
    <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#4a1a2e"/><stop offset="100%" stop-color="#2563EB"/>
    </linearGradient></defs>
    <rect width="320" height="180" fill="url(#g)"/>
    <circle cx="160" cy="90" r="40" fill="rgba(255,255,255,0.95)"/>
    <polygon points="150,75 150,105 178,90" fill="#4a1a2e"/>
    <text x="160" y="155" font-family="Open Sans" font-size="11" fill="#fff" text-anchor="middle" letter-spacing="2">MDIGITAL · ПРИВЕТСТВИЕ</text>
  </svg>`,
)}`;

export function Stage3Video({ }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ended, setEnded] = useState(false);

  return (
    <div className="video-wrap">
      <div className="video-frame">
        <video
          ref={videoRef}
          controls
          poster={POSTER}
          onEnded={() => setEnded(true)}
          onPlay={() => {}}
          style={{ width: '100%', display: 'block', borderRadius: 8 }}
        >
          {/* Big Buck Bunny — public-domain sample clip */}
          <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
          Твой браузер не поддерживает видео.
        </video>
      </div>
      <div className={`video-hint ${ended ? 'is-done' : ''}`}>
        {ended ? '✓ Видео просмотрено — отметь чек-бокс выше' : 'Досмотри видео до конца, чтобы отметить шаг выполненным'}
      </div>
      <style>{`
        .video-wrap{ margin-bottom:6px }
        .video-frame{
          border:1px solid var(--border-strong);
          border-radius:10px; overflow:hidden;
          background:#02060d;
          box-shadow:0 0 24px rgba(59,130,246,.18);
        }
        .video-hint{
          margin-top:8px; padding:9px 12px;
          font-size:11px; color:var(--muted);
          border:1px dashed var(--border); border-radius:8px;
          background:rgba(59,130,246,.04);
          font-family:'Open Sans',sans-serif;
        }
        .video-hint.is-done{
          color:var(--mint); border-color:rgba(96,165,250,.4); background:rgba(96,165,250,.06);
        }
      `}</style>
    </div>
  );
}
