import { useEffect, useRef } from 'react';

export function FuturisticGrid({ progress = 0 }: { progress?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    let off = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      off = (off + 0.45) % 40;
      ctx.clearRect(0, 0, w, h);
      // bg
      ctx.fillStyle = '#0A0F1E';
      ctx.fillRect(0, 0, w, h);
      // horizon glow — hybrid pink→purple→cyan
      const g = ctx.createRadialGradient(w * 0.5, 0, 0, w * 0.5, 0, w * 0.85);
      g.addColorStop(0, 'rgba(59,130,246,0.09)');
      g.addColorStop(0.35, 'rgba(37,99,235,0.07)');
      g.addColorStop(0.65, 'rgba(59,130,246,0.05)');
      g.addColorStop(1, 'rgba(11,7,25,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h * 0.72);
      // perspective grid
      ctx.save();
      ctx.strokeStyle = 'rgba(59,27,95,0.95)';
      ctx.lineWidth = 1;
      const step = 42;
      const vpY = h * 0.46;
      // horizontal lines with perspective spacing
      for (let y = vpY; y < h; y += step) {
        const t = (y - vpY) / (h - vpY);
        const alpha = 0.04 + t * 0.18;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(0, y + (off * t));
        ctx.lineTo(w, y + (off * t));
        ctx.stroke();
      }
      // vertical lines converging to vanishing point
      ctx.globalAlpha = 1;
      const cx = w * 0.5;
      for (let x = -600; x <= 600; x += 42) {
        const topX = cx + x * 0.08;
        const botX = cx + x * 1.35;
        ctx.strokeStyle = 'rgba(37,99,235,0.18)';
        ctx.globalAlpha = 0.14;
        ctx.beginPath();
        ctx.moveTo(topX, vpY);
        ctx.lineTo(botX, h);
        ctx.stroke();
      }
      ctx.restore();
      // scanline subtle
      ctx.fillStyle = 'rgba(255,255,255,0.015)';
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
      // FOW vignette based on progress (0-100)
      const reveal = 0.18 + (progress / 100) * 0.55;
      const fogG = ctx.createRadialGradient(w * 0.5, h * 0.55, w * 0.12, w * 0.5, h * 0.55, w * reveal);
      fogG.addColorStop(0, 'rgba(0,0,0,0)');
      fogG.addColorStop(0.7, 'rgba(0,0,0,0)');
      fogG.addColorStop(1, 'rgba(11,7,25,0.82)');
      ctx.fillStyle = fogG;
      ctx.fillRect(0, 0, w, h);
      // bottom fade
      const bot = ctx.createLinearGradient(0, h * 0.62, 0, h);
      bot.addColorStop(0, 'rgba(11,7,25,0)');
      bot.addColorStop(1, 'rgba(11,7,25,0.92)');
      ctx.fillStyle = bot;
      ctx.fillRect(0, h * 0.62, w, h * 0.38);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [progress]);
  return <canvas ref={ref} className="grid-bg" aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, display: 'block', pointerEvents: 'none' }} />;
}
