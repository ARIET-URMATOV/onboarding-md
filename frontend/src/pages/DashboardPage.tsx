import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TopBar } from '../components/layout/TopBar';
import { useOnboarding, getAllStatuses, getProgress } from '../store/useOnboarding';
import { STAGES } from '../data/stages';
import { usePageMeta } from '../hooks/usePageMeta';

type Phase = 'dark' | 'flight' | 'done';
const DUR = 1400;

function bezier(t: number, p0: number, p1: number, p2: number, p3: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/* ===== Голос: /voice.mp3 — студийная озвучка ===== */

export function DashboardPage() {
  usePageMeta("Дашборд — MDIGITAL Онбординг", "Твой прогресс онбординга MDIGITAL: текущий этап, опыт и уровень. Продолжай адаптацию в команде.");
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const statuses = useMemo(() => getAllStatuses(doneTasks), [doneTasks]);
  const progress = useMemo(() => getProgress(doneTasks), [doneTasks]);
  const xp = useOnboarding((s) => s.xp);
  const lvl = Math.floor(xp / 100) + 1;
  const current = STAGES.find((s) => statuses[s.id] === 'current');

  // интро (анимация + голос) — при первом входе в сессию (sessionStorage)
  const introSeen = useOnboarding((s) => s.introSeen);
  const markIntroSeen = useOnboarding((s) => s.markIntroSeen);
  const introSeenRef = useRef(introSeen);
  const [sessionIntroSeen] = useState(() => localStorage.getItem('md_intro_seen') === '1');

  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const [phase, setPhase] = useState<Phase>(reduced || sessionIntroSeen ? 'done' : 'dark');
  const [overlayOn, setOverlayOn] = useState(!reduced && !sessionIntroSeen);
  const voiceEnabled = useOnboarding((s) => s.voiceEnabled);
  const setVoiceEnabled = useOnboarding((s) => s.setVoiceEnabled);
  const [voiceOn, setVoiceOn] = useState(voiceEnabled);
  const spokeRef = useRef(sessionIntroSeen);
  const voiceOnRef = useRef(voiceOn);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);

  const toggleVoice = useCallback(() => {
    const next = !voiceOn;
    setVoiceOn(next);
    setVoiceEnabled(next);
    if (!next) {
      try { audioRef.current?.pause(); if (audioRef.current) audioRef.current.currentTime = 0; } catch { /* noop */ }
    } else {
      // if was muted and we are already in done phase, try to play
      if (phase === 'done' && !reduced) {
        audioRef.current?.play().catch(() => { });
      }
    }
  }, [phase, reduced, setVoiceEnabled, voiceOn]);

  // голос — синхронно с выходом текста после метеорита (под riseIn h-title/h-sub)
  useEffect(() => {
    if (phase !== 'done' || reduced) return;
    const t = window.setTimeout(() => {
      if (!voiceOnRef.current || spokeRef.current) return;
      spokeRef.current = true;
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = 0;
      el.volume = 0.9;
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          const fire = () => {
            window.removeEventListener('pointerdown', fire);
            window.removeEventListener('keydown', fire);
            if (voiceOnRef.current) {
              const a = audioRef.current;
              if (a) { a.currentTime = 0; a.play().catch(() => { }); }
            }
          };
          window.addEventListener('pointerdown', fire, { once: true });
          window.addEventListener('keydown', fire, { once: true });
        });
      }
    }, 950);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  // preload handled by <audio preload="auto">

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const cometRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const clearAll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);

  const spawnSpark = (x: number, y: number) => {
    if (!overlayRef.current) return;
    const dot = document.createElement('span');
    dot.className = 'md-spark-p';
    const size = 2.5 + Math.random() * 3;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.left = `${x + (Math.random() - 0.5) * 10}px`;
    dot.style.top = `${y + (Math.random() - 0.5) * 10}px`;
    overlayRef.current.appendChild(dot);
    window.setTimeout(() => dot.remove(), 1300);
  };

  const startIntro = useCallback(() => {
    clearAll();
    spokeRef.current = false;
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } } catch { /* noop */ }
    setOverlayOn(true);
    setPhase('dark');
    document.body.style.background = '#060B18';

    timersRef.current.push(window.setTimeout(() => setPhase('flight'), 500));

    let start = 0;
    let lastSpark = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / DUR);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const x = bezier(e, -40, w * 0.30, w * 0.55, w * 1.04);
      const y = bezier(e, h * 0.52, h * 0.44, h * 0.06, -h * 0.05);
      if (cometRef.current) cometRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;

      if (ts - lastSpark > 55 && x > -20 && x < w - 12) {
        lastSpark = ts;
        spawnSpark(x, y);
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Фаза «Осветление»: оверлей плавно светлеет и растворяется
        setPhase('done');
        markIntroSeen();
        localStorage.setItem('md_intro_seen', '1');
        document.body.style.background = '#0A0F1E';
        timersRef.current.push(
          window.setTimeout(() => setOverlayOn(false), 2400),
        );
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearAll, markIntroSeen]);

  useEffect(() => {
    if (introSeenRef.current || reduced) {
      document.body.style.background = '#0A0F1E';
      return;
    }
    startIntro();
    return () => {
      clearAll();
      document.body.style.background = '';
    };
  }, [reduced, startIntro, clearAll]);

  const skipIntro = useCallback(() => {
    if (phase === 'done') return;
    clearAll();
    setPhase('done');
    setOverlayOn(false);
    markIntroSeen();
    localStorage.setItem('md_intro_seen', '1');
    document.body.style.background = '#0A0F1E';
  }, [phase, clearAll, markIntroSeen]);

  // пауза аудио при размонтировании/skip
  useEffect(() => {
    return () => {
      try { audioRef.current?.pause(); } catch { /* noop */ }
    };
  }, []);

  const revealed = phase === 'done';

  return (
    <>
      <TopBar />
      <main className={`dash-hero ${revealed ? 'revealed' : 'hidden'}`}>
        {/* фон-картинка */}
        <div className="bg-photo" aria-hidden />
        <div className="bg-shade" aria-hidden />
        {/* звёздная пыль */}
        <div className="dust" aria-hidden>
          {[...Array(10)].map((_, i) => (
            <span key={i} className={`d c${i % 5}`} style={{ left: `${(i * 83) % 96}%`, top: `${(i * 47) % 88}%` }} />
          ))}
        </div>
        <div className="center-glow" aria-hidden />

        <div className="hero-inner">
          {/* cosmic atmospheric layer — violet planet + HK aura */}
          <div className="hero-cosmic" aria-hidden>
            <div className="hc-planet" />
            <div className="hc-planetRing" />
            <div className="hc-burst" />
            <div className="hc-rays" />
            <div className="hc-stardust">
              {[...Array(32)].map((_, i) => (
                <span
                  key={i}
                  className={`sd s${i % 6}`}
                  style={{
                    left: `${(i * 37 + 7) % 100}%`,
                    top: `${(i * 53 + 12) % 100}%`,
                    animationDelay: `${(i * 0.38) % 4}s`,
                    animationDuration: `${5 + (i % 5) * 1.6}s`,
                  }}
                />
              ))}
            </div>
            <div className="hc-stars">
              {['✦', '✧', '✶', '✦', '✧', '✶'].map((ch, i) => (
                <span key={i} className={`hc-star st${i}`} style={{ left: `${12 + i * 16}%`, top: `${18 + (i % 2) * 42}%`, animationDelay: `${i * 0.9}s` }}>{ch}</span>
              ))}
            </div>
          </div>

          <motion.div className="h-kicker" role="doc-subtitle" initial={{ opacity: 0, y: 10 }} animate={revealed ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.15, duration: 0.6 }}>
            <i className="k-line" />
            <span className="k-text">Добро пожаловать В</span>
            <i className="k-line" />
          </motion.div>
          <motion.h1 className="h-title" aria-label="В MDIGITAL" initial={{ opacity: 0, y: 18 }} animate={revealed ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.28, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <span className="h-title-planet" aria-hidden>
              <span className="ht-planet" />
              <span className="ht-planetRing" />
            </span>
            <span className="h-orn h-orn--top" aria-hidden>
              <svg viewBox="0 0 360 22" fill="none"><path d="M10 11 H110 C115 3 130 1 144 11 C158 21 173 21 178 11 H250 C255 3 270 1 284 11 H350" stroke="rgba(233,213,255,.82)" strokeWidth="1.1" strokeLinecap="round" fill="none" /><circle cx="178" cy="11" r="1.6" fill="#DBEAFE" /><circle cx="144" cy="11" r="1" fill="#60A5FA" opacity=".9" /><circle cx="212" cy="11" r="1" fill="#60A5FA" opacity=".9" /></svg>
            </span>
            <span className="h-m">M<span className="m-shine" aria-hidden /><span className="m-halo" aria-hidden /></span>DIGITAL
          </motion.h1>
          <p className="h-sub">
            Где рождаются инновационные решения
          </p>

          <motion.div className="h-actions" initial={{ opacity: 0, y: 12 }} animate={revealed ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.54, duration: 0.6 }}>
            <Link to="/roadmap" className="btn-f primary"><span className="btn-glow" aria-hidden />Начать</Link>
            <Link to="/map" className="btn-f secondary">Карта</Link>
          </motion.div>

          <motion.div className="h-progress" initial={{ opacity: 0 }} animate={revealed ? { opacity: 1 } : {}} transition={{ delay: 0.67, duration: 0.6 }}>
            <div className="hp-head font-mono">
              <span>Прогресс онбординга · Уровень {lvl}</span>
              <span>{progress.done}/5{current ? ` · Этап 0${current.id}` : ''}</span>
            </div>
            <div className="hp-bar"><i style={{ width: `${progress.pct}%` }}><span className="hp-shine" aria-hidden /></i></div>
          </motion.div>
        </div>

        {/* futuristic voice controls — right side */}
        <div className="hero-tools" aria-label="Управление звуком">
          <button className={`voice-btn ${voiceOn ? 'on' : 'off'}`} onClick={toggleVoice} aria-label={voiceOn ? 'Выключить звук' : 'Включить звук'} title={voiceOn ? 'Звук вкл.' : 'Звук выкл.'}>
            <span className="vb-ico" aria-hidden>
              {voiceOn ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M17.8 6.2a8 8 0 0 1 0 11.6" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M16 9l4 4M20 9l-4 4" />
                </svg>
              )}
            </span>
            <span className="vb-ring" aria-hidden />
          </button>
        </div>
        {/* hidden studio audio */}
        <audio ref={audioRef} src="/voice.mp3" preload="auto" playsInline />
      </main>

      {/* оверлей интро поверх всего; исчезает только после осветления */}
      {!reduced && overlayOn && (
        <div ref={overlayRef} className={`intro ${phase}`} onClick={skipIntro}>
          <div ref={cometRef} className="comet" />
        </div>
      )}

      <style>{`
        /* ===== HERO ===== */
        .dash-hero{
          position:relative; min-height:100vh;
          display:flex; align-items:center; justify-content:center; text-align:center;
          background:#0A0F1E; color:#F5F0FF; overflow:hidden;
          opacity:0; pointer-events:none;
          transition:opacity 1s ease .15s, background 2s ease;
          padding-top:72px; box-sizing:border-box;
        }
        .dash-hero.revealed{ opacity:1; pointer-events:auto }
        .dash-hero.hidden{ background:#060B18 }

        .bg-photo{
          position:absolute; inset:0; z-index:0;
          background:url('/blue_var_bg.jpg') center/cover no-repeat;
          opacity:0; transition:opacity 2.4s ease .2s;
        }
        .dash-hero.revealed .bg-photo{ opacity:1 }
        .bg-shade{
          position:absolute; inset:0; z-index:1;
          background:
            linear-gradient(180deg, rgba(11,11,16,.55) 0%, rgba(26,21,37,.72) 45%, rgba(26,21,37,.94) 100%),
            radial-gradient(closest-side at 50% 46%, rgba(96,165,250,.16), transparent 72%);
          opacity:0; transition:opacity 2.4s ease .2s;
        }
        .dash-hero.revealed .bg-shade{ opacity:1 }

        .center-glow{ display:none; }
        .dust{ position:absolute; inset:0; z-index:1; pointer-events:none }
        .d{
          position:absolute; border-radius:50%;
          background:radial-gradient(circle, rgba(147,197,253,.4), transparent 70%);
          animation:dustIn 2.4s ease both;
        }
        @keyframes dustIn{ from{opacity:0; transform:scale(.6)} to{opacity:.18; transform:scale(1)} }
        .d.c0{ width:120px; height:120px } .d.c1{ width:70px; height:70px }
        .d.c2{ width:180px; height:180px } .d.c3{ width:90px; height:90px }
        .d.c4{ width:150px; height:150px }

        .hero-inner{ position:relative; z-index:2; padding:40px 22px; max-width:940px; will-change:transform,opacity }
        /* cosmic atmospheric layer — violet planet (ONLY MOBILE, muted, no inner light) */
        .hero-cosmic{ position:absolute; inset:-80px -120px -60px -120px; z-index:-1; pointer-events:none; overflow:visible; }
        .hc-planet, .hc-planetRing, .hc-burst{ display:none !important; }
        @keyframes burstPulse{ 0%,100%{ transform:translate(-50%,-50%) scale(0.96); opacity:.82 } 50%{ transform:translate(-50%,-50%) scale(1.04); opacity:1 } }
        .hc-rays{
          position:absolute; left:50%; top:50%; width:1000px; height:1000px; transform:translate(-50%,-50%);
          background: conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(96,165,250,.04) 18deg, transparent 40deg, rgba(37,99,235,.03) 72deg, transparent 120deg, rgba(96,165,250,.03) 184deg, transparent 232deg, rgba(37,99,235,.025) 276deg, transparent 320deg);
          opacity:.22; animation: raysSpin 92s linear infinite; mix-blend-mode:screen;
        }
        @keyframes raysSpin{ to{ transform:translate(-50%,-50%) rotate(360deg) } }
        .hc-stardust{ position:absolute; inset:0; }
        .sd{ position:absolute; border-radius:50%; background: radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(147,197,253,.85) 38%, transparent 70%); box-shadow: 0 0 10px rgba(96,165,250,.75), 0 0 18px rgba(37,99,235,.35); animation: sdTwinkle ease-in-out infinite, sdDrift linear infinite; will-change: transform, opacity; }
        .sd.s0{ width:2.2px; height:2.2px; opacity:.55 } .sd.s1{ width:3.2px; height:3.2px; opacity:.7 } .sd.s2{ width:1.8px; height:1.8px; opacity:.45 } .sd.s3{ width:4px; height:4px; opacity:.8 } .sd.s4{ width:2.6px; height:2.6px; opacity:.6 } .sd.s5{ width:1.4px; height:1.4px; opacity:.4 }
        @keyframes sdTwinkle{ 0%,100%{ transform:scale(1); opacity:var(--o, .6) } 50%{ transform:scale(1.45); opacity:1 } }
        @keyframes sdDrift{ 0%{ transform: translate3d(0,0,0) } 50%{ transform: translate3d(6px,-10px,0) } 100%{ transform: translate3d(-4px,-18px,0) } }
        .hc-stars{ position:absolute; inset:0; }
        .hc-star{ position:absolute; font-size:13px; color:rgba(147,197,253,.85); text-shadow: 0 0 10px rgba(96,165,250,.9), 0 0 22px rgba(37,99,235,.45); animation: starOrbit linear infinite, starTw 2.8s ease-in-out infinite; will-change: transform, opacity; }
        .hc-star.st0{ font-size:11px; animation-duration:14s, 2.4s } .hc-star.st1{ font-size:9px; animation-duration:18s, 3.1s } .hc-star.st2{ font-size:14px; animation-duration:16s, 2.6s } .hc-star.st3{ font-size:8px; animation-duration:20s, 3.4s } .hc-star.st4{ font-size:12px; animation-duration:15s, 2.8s } .hc-star.st5{ font-size:10px; animation-duration:19s, 3.2s }
        @keyframes starOrbit{ from{ transform: rotate(0deg) translateX(2px) rotate(0deg) } to{ transform: rotate(360deg) translateX(2px) rotate(-360deg) } }
        @keyframes starTw{ 0%,100%{ opacity:.65; transform:scale(1) } 50%{ opacity:1; transform:scale(1.22) } }

        .h-kicker{
          display:flex; align-items:center; justify-content:center; gap:14px;
          margin-bottom:14px;
        }
        .k-line{
          display:block; width:84px; height:1px;
          background:linear-gradient(90deg, transparent, rgba(96,165,250,.85) 45%, rgba(37,99,235,.65));
          box-shadow:0 0 8px rgba(37,99,235,.35);
        }
        .k-line:last-child{ background:linear-gradient(90deg, rgba(37,99,235,.65), rgba(96,165,250,.85) 55%, transparent) }
        .k-text{
          font-family:'Prata',sans-serif; font-weight:600;
          font-size:12.5px; letter-spacing:.20em; text-transform:uppercase;
          color:#60A5FA; text-shadow:0 0 18px rgba(96,165,250,.55), 0 0 32px rgba(37,99,235,.28);
          padding-left:."52em;
        }
        .h-title{
          font-family:'Cinzel',sans-serif; font-weight:900;
          font-size:clamp(48px, 8.8vw, 86px); line-height:1; letter-spacing:-.02em;
          color:#F5F0FF; margin:0 0 20px; text-shadow:0 10px 40px rgba(0,0,0,.6);
          filter: drop-shadow(0 0 28px rgba(37,99,235,.18));
          position:relative; isolation:isolate;
        }
        .h-title-planet{ position:absolute; left:50%; top:50%; width:110%; aspect-ratio:1; max-width:400px; transform:translate(-50%,-50%); z-index:-1; pointer-events:none; display:none; }
        .ht-planet{
          position:absolute; inset:0; border-radius:50%;
          background: radial-gradient(closest-side at 50% 50%, #132A4F 0%, #122443 24%, #0E1A33 46%, #0A1224 66%, transparent 72%);
          box-shadow: inset -14px -10px 24px rgba(0,0,0,.38), 0 0 36px rgba(37,99,235,.16);
          opacity:.48; animation: planetFloat 8s ease-in-out infinite;
        }
        .ht-planetRing{
          position:absolute; inset:-6%; border-radius:50%; pointer-events:none; opacity:.06;
          background: conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(96,165,250,.38) 18deg, transparent 48deg, rgba(37,99,235,.22) 92deg, transparent 140deg, rgba(233,213,255,.20) 182deg, transparent 230deg, rgba(37,99,235,.18) 268deg, transparent 320deg);
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 1px), #000 calc(100% - .8px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 1px), #000 calc(100% - .8px));
          animation: raysSpin 68s linear infinite;
        }
        .h-m{
  position:relative; display:inline-block; font-size:1.08em; color:violet;
  background: linear-gradient(102deg, #93C5FD 18%, #DBEAFE 38%, #60A5FA 52%, #2563EB 72%);
  -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 8px rgba(96,165,250,.4)) drop-shadow(0 0 20px rgba(37,99,235,.25));
  animation: mGlow 3.2s ease-in-out infinite;
}
        @keyframes mGlow{ 0%,100%{ filter: drop-shadow(0 0 16px rgba(96,165,250,.6)) drop-shadow(0 0 32px rgba(37,99,235,.35)); } 50%{ filter: drop-shadow(0 0 26px rgba(96,165,250,.9)) drop-shadow(0 0 64px rgba(37,99,235,.55)); } }
        .m-shine{
          position:absolute; inset:0; pointer-events:none; overflow:hidden; border-radius:4px;
          background: linear-gradient(104deg, transparent 32%, rgba(255,255,255,.95) 50%, transparent 66%);
          background-size: 200% 100%; mix-blend-mode:screen; opacity:.0;
          animation: mShine 3s ease 1.2s infinite; -webkit-background-clip:text; background-clip:text;
        }
        @keyframes mShine{ 0%{ background-position: -80% 0; opacity:0 } 18%{ opacity:.95 } 42%{ opacity:0 } 100%{ background-position: 180% 0; opacity:0 } }
        .m-halo{
          position:absolute; left:50%; top:50%; width:140%; height:160%; transform:translate(-50%,-50%);
          background: radial-gradient(closest-side, rgba(96,165,250,.28), transparent 70%);
          filter: blur(14px); pointer-events:none; z-index:-1; animation: haloBreath 3.2s ease-in-out infinite;
        }
        @keyframes haloBreath{ 0%,100%{ opacity:.55; transform:translate(-50%,-50%) scale(.9) } 50%{ opacity:.95; transform:translate(-50%,-50%) scale(1.08) } }
        .h-orn{ position:absolute; left:50%; top:50%; width:min(480px,96%); height:22px; transform:translate(-50%,-50%); z-index:-1; pointer-events:none; opacity:.92; filter: drop-shadow(0 0 10px rgba(233,213,255,.55)); }
        .h-orn--top{ transform:translate(-50%,-52%); animation: ornIn .7s ease .35s both; }
        .h-orn--bot{ transform:translate(-50%,-48%); animation: ornIn .7s ease .45s both; }
        @keyframes ornIn{ from{ opacity:0; transform:translate(-50%,-50%) scaleX(.92) } to{ opacity:.92; transform:translate(-50%,-50%) scaleX(1) } }
        .h-orn svg{ width:100%; height:100%; }
        .h-sub{
          font-family:'Prata',sans-serif; font-weight:400;
          font-size:19px; letter-spacing:.02em; color:#DBEAFE; margin:0 auto 36px; max-width:560px;
          text-shadow:0 2px 18px rgba(0,0,0,.45), 0 0 22px rgba(37,99,235,.18);
        }

        .h-actions{
          display:flex; gap:14px; justify-content:center; flex-wrap:wrap;
        }

.btn-f {
  /* Размеры и Сетка */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 28px;
  position: relative;
  
  /* Типографика & Spacing */
  font-family: 'Syne', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-decoration: none;
  line-height: 1;
  
  /* Форма и Переходы */
  cursor: pointer;
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-f:active {
  transform: scale(0.98);
}

.btn-f.primary {
  background: #60A5FA;
  color: #0d0714;
  border: none;
  box-shadow: 0 0 12px rgba(96, 165, 250, 0.2);
}

.btn-f.primary:hover {
  background: #DBEAFE;
  box-shadow: 0 0 20px rgba(96, 165, 250, 0.4);
  transform: translateY(-1px);
}

.btn-f.secondary {
  background: rgba(13, 7, 20, 0.6);
  color: #DBEAFE;
  border: 1px solid rgba(96, 165, 250, 0.4);
}

.btn-f.secondary:hover {
  background: rgba(96, 165, 250, 0.08);
  border-color: #60A5FA;
  color: #ffffff;
  box-shadow: 0 0 15px rgba(96, 165, 250, 0.25);
  transform: translateY(-1px);
}
        .h-progress{
          max-width:500px; margin:40px auto 0;
        }
        .hp-head{
          display:flex; justify-content:space-between; gap:10px; margin-bottom:10px;
          font-family:'Space Grotesk',sans-serif; font-size:10px; font-weight:500; letter-spacing:.16em; text-transform:uppercase; color:#DBEAFE; opacity:.9;
        }
        .hp-bar{ height:4px; background:rgba(245,240,255,.10); border-radius:999px; overflow:hidden; position:relative; }
        .hp-bar i{
          display:block; height:100%; border-radius:999px; position:relative; overflow:hidden;
          background:linear-gradient(90deg,#2563EB 0%, #1E3A8A 55%, #3B82F6 100%);
          box-shadow:0 0 14px rgba(37,99,235,.45);
          transition:width .7s cubic-bezier(.16,1,.3,1);
        }
        .hp-shine{
          position:absolute; inset:0;
          background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,.7) 50%, transparent 70%);
          transform: translateX(-100%); animation: hpShine 2.8s ease 1s infinite;
        }
        @keyframes hpShine{ 60%{ transform:translateX(100%) } 100%{ transform:translateX(100%) } }

        .hero-tools{
          position:absolute; right:16px; bottom:16px; z-index:3;
          display:flex; flex-direction:column; gap:10px; align-items:center;
        }
        .voice-btn{
          width:44px; height:44px; border-radius:12px; position:relative;
          display:grid; place-items:center; cursor:pointer;
          background:rgba(37,99,235,.08); border:1px solid rgba(37,99,235,.18);
          backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
          color:#93C5FD; transition: all .22s ease;
          box-shadow: 0 4px 20px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.06);
        }
        .voice-btn:hover{ background:rgba(37,99,235,.14); border-color:rgba(37,99,235,.32); color:#fff; transform:translateY(-1px); }
        .voice-btn.on{ color:#fff; border-color:rgba(37,99,235,.34); box-shadow:0 0 16px rgba(37,99,235,.28), 0 4px 20px rgba(0,0,0,.25); }
        .voice-btn.off{ opacity:.72; }
        .vb-ico{ width:18px; height:18px; display:grid; place-items:center; }
        .vb-ico svg{ width:18px; height:18px; }
        .voice-btn.on .vb-ring{
          position:absolute; inset:-2px; border-radius:12px; pointer-events:none;
          border:1px solid rgba(37,99,235,.35);
          animation: vbPulse 2.4s ease infinite;
        }
        @keyframes vbPulse{ 0%{ opacity:.7; transform:scale(1)} 50%{ opacity:.15; transform:scale(1.08)} 100%{ opacity:0; transform:scale(1.14)} }

        /* ===== ИНТРО ОВЕРЛЕЙ — честное осветление ===== */
        .intro{
          position:fixed; inset:0; z-index:60; overflow:hidden;
          background:#060B18; cursor:pointer;
          transition:background 2s ease, opacity .8s ease 1.4s;
          will-change:opacity;
        }
        .intro.flight{ background:#060B18; opacity:1 }
        .intro.done{ background:#0A0F1E; opacity:0; pointer-events:none }

        .comet{
          position:absolute; left:0; top:0; width:14px; height:14px; border-radius:50%;
          background:#fff;
          box-shadow:
            0 0 12px 3px rgba(255,255,255,.9),
            -18px 0 26px 4px rgba(243,232,255,.55),
            -42px 0 54px 10px rgba(96,165,250,.35);
          opacity:0; will-change:transform;
        }
        .intro.flight .comet{ opacity:1; transition:opacity .25s ease }
        .intro.done .comet{ opacity:0; transition:opacity .25s ease }

        .md-spark-p{
          position:absolute; border-radius:50%; pointer-events:none;
          background:radial-gradient(circle, #F3E8FF, #60A5FA 65%, transparent);
          box-shadow:0 0 8px rgba(96,165,250,.8);
          animation:sparkFade 1.2s ease-out forwards;
          will-change:transform,opacity;
        }
        @keyframes sparkFade{
          0%{ opacity:.95; transform:scale(1) }
          100%{ opacity:0; transform:scale(.35) translateY(6px) }
        }

        /* ===== MOBILE — BEST QUALITY ===== */
        @media (max-width:860px){
          .dash-hero{ padding-top:64px; }
          .hero-inner{ padding:28px 20px; }
          .center-glow{ display:none; }
          .hero-cosmic{ inset:0; overflow:hidden; border-radius:0; }
          .hc-planet, .hc-planetRing{ display:none !important; }
          .h-title-planet{ display:block; width:118%; max-width:420px; }
          .ht-planet{ opacity:.48; }
          .ht-planetRing{ opacity:.06; }
        }
        @media (max-width:640px){
          .hero-inner{ padding:32px 18px 24px; max-width:100%; }
          .h-title-planet{ width:128%; max-width:400px; }
          .ht-planet{ opacity:.46; }
          .ht-planetRing{ display:none; }
          .hc-burst{ display:none; }
          .hc-rays{ display:none; }
          .h-kicker{ gap:10px; margin-bottom:10px; }
          .k-line{ width:36px; }
          .k-text{ font-size:10.5px; letter-spacing:.38em; }
          .h-title{
            font-size:clamp(42px, 12vw, 56px); line-height:.92; letter-spacing:-.015em;
            margin:0 0 12px;
            text-shadow: 0 0 24px rgba(255,255,255,.45), 0 4px 36px rgba(0,0,0,.65);
          }
          .h-sub{ font-size:17px; line-height:1.45; margin:0 auto 55px; max-width:92vw; }
          .h-actions{ flex-direction:column; align-items:stretch; gap:10px; width:100%; max-width:320px; margin:0 auto; }
          .btn-f{ width:100%; padding:13px 18px; font-size:10.5px; letter-spacing:.14em; justify-content:center; min-height:42px; }
          .h-progress{ margin:28px auto 0; max-width:92vw; }
          .hero-tools{ right:10px; bottom:10px; gap:8px; }
          .voice-btn,
        }
        @media (max-width:480px){
          .hero-inner{ padding:26px 16px 20px; }
          .h-title-planet{ width:132%; max-width:380px; }
          .ht-planet{ opacity:.44; }
          .h-title{ font-size:clamp(38px, 12.5vw, 50px); }
          .k-text{ font-size:9.5px; letter-spacing:.34em; }
          .h-sub{ font-size:15.5px; }
          .btn-f{ padding:12px 16px; font-size:10.5px; min-height:40px; }
           .h-orn{ position:absolute; left:50%; top:75%; width:min(480px,96%); height:22px; transform:translate(-50%,-50%); z-index:-1; pointer-events:none; opacity:.92; filter: drop-shadow(0 0 10px rgba(233,213,255,.55)); }
        }
        @media (max-width:380px){
          .h-title{ font-size:clamp(34px, 12vw, 46px); }
          .k-line{ width:28px; }
           .h-orn{ position:absolute; left:50%; top:90%; width:min(480px,96%); height:22px; transform:translate(-50%,-50%); z-index:-1; pointer-events:none; opacity:.92; filter: drop-shadow(0 0 10px rgba(233,213,255,.55)); }
        }
        @media (prefers-reduced-motion: reduce){
          .h-kicker,.h-title,.h-sub,.h-actions,.h-progress{ animation:none; opacity:1 }
          .intro{ display:none }
          .bg-photo,.bg-shade{ transition:none; opacity:1 }
        }
      `}</style>
    </>
  );
}

