import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { STAGES } from '../../data/stages';
import type { StageId } from '../../data/stages';
import type { StageStatus } from '../../store/useOnboarding';
import { useOnboarding } from '../../store/useOnboarding';
import { Stage1Documents } from '../stages/Stage1Documents';
import { Stage2Team } from '../stages/Stage2Team';
import { Stage3Video } from '../stages/Stage3Video';
import { Stage4Checklist } from '../stages/Stage4Checklist';
import { Stage5Test } from '../stages/Stage5Test';

type Props = {
  statuses: Record<StageId, StageStatus>;
  onSelect?: (id: StageId) => void; // kept for compat, not used as modal
  done: number;
};

const TABS: { id: string; label: string; path?: string; d: string }[] = [
  { id: 'dash', label: 'Dashboard', path: '/dashboard', d: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { id: 'map', label: 'Этапы', d: 'M9 20l-5.5 2V6L9 4l6 2 5.5-2v16L15 22l-6-2zM9 4v16M15 6v16' },
  { id: 'check', label: 'Чек-лист', d: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  { id: 'test', label: 'Тест', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6' },
];

export function IsometricRoadmap({ statuses, done }: Props) {
  const nav = useNavigate();
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const toggleTask = useOnboarding((s) => s.toggleTask);
  const completeStage = useOnboarding((s) => s.completeStage);

  const [selected, setSelected] = useState<StageId>(() => {
    for (let i = 1 as StageId; i <= 5; i = (i + 1) as StageId) {
      if (statuses[i] === 'current') return i;
    }
    return 1;
  });
  // keep selected in sync when status changes (e.g. after completion)
  useEffect(() => {
    if (statuses[selected] === 'locked') {
      // fallback to current
      for (let i = 1 as StageId; i <= 5; i = (i + 1) as StageId) if (statuses[i] === 'current') { setSelected(i); return; }
    }
  }, [statuses, selected]);

  const [shakeId, setShakeId] = useState<StageId | null>(null);
  const [finale, setFinale] = useState(false);
  const [unlockingId, setUnlockingId] = useState<StageId | null>(null);
  const [xpToast, setXpToast] = useState<{ id: number; val: number } | null>(null);
  const prevDoneRef = useRef(done);

  const sel = STAGES.find((s) => s.id === selected)!;
  const selStatus = statuses[selected];
  const selDoneTasks = useMemo(() => STAGES.find((s) => s.id === selected)!.subTasks, [selected]);
  const selDoneIds = doneTasks[selected] || [];
  const allDoneForGate = sel.subTasks.every((t) => selDoneIds.includes(t.id));
  const hasNext = selected < 5;

  // finale when 5/5
  useEffect(() => {
    if (done === 5 && prevDoneRef.current < 5) {
      setTimeout(() => setFinale(true), 500);
      const end = Date.now() + 1800;
      const colors = ['#2563EB', '#1E3A8A', '#3B82F6', '#3B82F6'];
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
        confetti({ particleCount: 3, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
      confetti({ particleCount: 80, spread: 90, origin: { y: 0.6 }, colors, scalar: 1.1 });
    }
    prevDoneRef.current = done;
  }, [done]);

  // unlocking animation when progress increments
  const prevStatusesRef = useRef(statuses);
  useEffect(() => {
    const prev = prevStatusesRef.current;
    for (let i = 1 as StageId; i <= 5; i = (i + 1) as StageId) {
      if (prev[i] === 'locked' && statuses[i] !== 'locked') {
        setUnlockingId(i);
        setTimeout(() => setUnlockingId(null), 1400);
        const reward = STAGES.find((s) => s.id === (i - 1) as StageId)?.xpReward || 100;
        setXpToast({ id: Date.now(), val: reward });
        setTimeout(() => setXpToast(null), 1700);
        confetti({ particleCount: 40, spread: 70, origin: { y: 0.65 }, colors: ['#2563EB', '#3B82F6', '#3B82F6'], scalar: 1.0, ticks: 140 });
        break;
      }
    }
    prevStatusesRef.current = statuses;
  }, [statuses]);

  const pick = (id: StageId) => {
    if (statuses[id] === 'locked') {
      setShakeId(id);
      setTimeout(() => setShakeId(null), 450);
      return;
    }
    setSelected(id);
  };

  const handleComplete = () => {
    completeStage(selected);
    // next will be unlocked via effect
  };
  const handleNext = () => {
    const next = (selected + 1) as StageId;
    if (next <= 5 && statuses[next] !== 'locked') setSelected(next);
    else if (next <= 5) {
      // try to trigger complete then jump
      setSelected(next);
    }
  };

  return (
    <div className="gm-root">
      {/* ================= ЛЕВАЯ ПАНЕЛЬ ================= */}
      <aside className="gm-left">
        <div className="gl-brand">
          <img src="/public/mdigital-logo.svg" alt="logo" width={100} />
        </div>

        <motion.div className="gm-tabs" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}>
          {TABS.map((t, i) => (
            <motion.button
              key={t.id}
              className={`gm-tab ${i === 1 ? 'on' : ''}`}
              title={t.label}
              onClick={() => t.path && nav(t.path)}
              variants={{ hidden: { opacity: 0, scale: 0.7, y: 6 }, visible: { opacity: 1, scale: 1, y: 0 } }}
              whileHover={{ scale: 1.08, y: -2 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d={t.d} />
              </svg>
              {i === 1 && <motion.span layoutId="activeTab" className="gm-tabActive" />}
            </motion.button>
          ))}
        </motion.div>

        <div className="gm-sect">
          <div className="gs-rule" />
          <div className="gs-meta font-mono">
            <span>Прогресс</span>
            <motion.span key={done} initial={{ scale: 1.25, color: '#fff' }} animate={{ scale: 1, color: '#3B82F6' }} transition={{ duration: 0.35 }} className="gs-count">{done}/5</motion.span>
          </div>
        </div>

        <div className="gm-list">
          {STAGES.map((s, idx) => {
            const st = statuses[s.id];
            const isSel = selected === s.id && st !== 'locked';
            const isUnlocking = unlockingId === s.id;
            return (
              <div key={s.id} className="gm-itemWrap">
                {idx > 0 && <i className="gm-connector" aria-hidden />}
                <motion.div
                  layout
                  className={`gm-cardWrap ${st} ${isSel ? 'sel' : ''} ${shakeId === s.id ? 'shake' : ''} ${isUnlocking ? 'unlocking' : ''}`}
                  animate={isUnlocking ? { scale: [0.96, 1.06, 1], rotate: [0, 0.6, 0] } : {}}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                >
                  <button
                    className={`gm-card ${st}`}
                    onClick={() => pick(s.id as StageId)}
                    aria-label={`Этап ${s.id}: ${s.title}`}
                    disabled={st === 'locked'}
                  >
                    <span className="gc-ico">
                      {st === 'locked' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                          <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                        </svg>
                      ) : st === 'done' ? (
                        <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </motion.svg>
                      ) : (
                        <span className="gc-spark">✦</span>
                      )}
                    </span>
                    <span className="gc-body">
                      <span className="gc-name">{s.shortLabel}</span>
                      <span className="gc-state">{st === 'locked' ? 'Закрыто' : st === 'current' ? 'Сейчас' : 'Пройдено'}</span>
                    </span>
                    <span className="gc-num font-mono">0{s.id}</span>
                    {isUnlocking && <span className="gc-shine" aria-hidden />}
                  </button>
                </motion.div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ================= ПРАВАЯ ПАНЕЛЬ — INLINE CONTENT ================= */}
      <AnimatePresence mode="wait">
        <motion.section
          key={selected}
          className="gm-right"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="gr-head">
            <div className="gr-headtxt">
              <div className="gr-title">{selected}. {sel.title}</div>
              <div className="gr-subtitle">
                {selStatus === 'locked' ? 'Этап закрыт' : selStatus === 'current' ? 'Текущий этап' : 'Этап пройден'}
              </div>
            </div>
            <motion.div layout className={`gr-emblem ${selStatus}`} animate={unlockingId === selected ? { scale: [1, 1.12, 1] } : {}} transition={{ duration: 0.6 }}>
              <span className="ge-ring" />
              <span className="ge-core font-orbitron">{selected}</span>
            </motion.div>
          </div>

          <div className="gr-divider" />

          <div className="gr-body">
            <p className="gr-desc">{sel.description}</p>

            {selected === 1 && selStatus !== 'locked' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
                <Stage1Documents stageId={selected} />
              </motion.div>
            )}
            {selected === 2 && selStatus !== 'locked' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Stage2Team stageId={selected} />
                {/* generic checklist for stage 2 */}
              </motion.div>
            )}
            {selected === 3 && selStatus !== 'locked' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Stage3Video stageId={selected} />
              </motion.div>
            )}
            {selected === 4 && selStatus !== 'locked' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Stage4Checklist stageId={selected} />
              </motion.div>
            )}
            {selected === 5 && selStatus !== 'locked' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Stage5Test stageId={selected} />
              </motion.div>
            )}

            {selected !== 1 && selStatus !== 'locked' && (
              <div className="sub-tasks" style={{ marginTop: 14 }}>
                {sel.subTasks.map((t, i) => {
                  const done = selDoneIds.includes(t.id);
                  return (
                    <motion.label
                      key={t.id}
                      className={`task-row ${done ? 'is-done' : ''}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ x: 2 }}
                    >
                      <span className="task-box">
                        {done && (
                          <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} viewBox="0 0 24 24" fill="none" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </motion.svg>
                        )}
                      </span>
                      <span className="task-title">{t.title}</span>
                      <span className="task-xp">+{t.xp} XP</span>
                      <input type="checkbox" checked={done} onChange={() => toggleTask(selected, t.id)} style={{ display: 'none' }} />
                    </motion.label>
                  );
                })}
                <motion.div className="reward" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                  </svg>
                  <div>
                    <b className="font-orbitron">Ачивка «{sel.rewardName.replace('Ачивка «', '').replace('»', '')}»</b>
                    <span>{sel.rewardDesc}</span>
                  </div>
                </motion.div>
              </div>
            )}

            {selStatus === 'locked' && (
              <div className="locked-body">
                <div className="locked-icon">🔒</div>
                <div className="locked-title">Этот этап пока недоступен</div>
                <div className="locked-desc">Пройди предыдущий этап, чтобы открыть «{sel.title}».</div>
              </div>
            )}

            {selected === 1 && selStatus === 'current' && !allDoneForGate && (
              <div className="gr-gate">Открой каждый документ и пролистай до конца — иначе этап не засчитается.</div>
            )}

            <div className="gr-tasksLabel font-mono" style={{ marginTop: 16 }}>Задачи этапа</div>
            <div className="gr-chips">
              {selDoneTasks.map((t, i) => (
                <motion.span
                  key={t.id}
                  className={`gr-chip ${selDoneIds.includes(t.id) || selStatus === 'done' ? 'is-done' : ''}`}
                  title={t.title}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 420, damping: 18 }}
                >
                  {selDoneIds.includes(t.id) || selStatus === 'done' ? '✓' : i + 1}
                </motion.span>
              ))}
              <span className="gr-chipLabel">{selDoneTasks.length} задач{selDoneTasks.length === 1 ? 'а' : selDoneTasks.length < 5 ? 'и' : ''}</span>
            </div>
          </div>

          <div className="gr-foot">
            <span className="gr-hint font-mono">
              {selStatus === 'locked' ? 'Пройди предыдущий этап' : selStatus === 'current' && !allDoneForGate ? 'Выполни все задачи' : selStatus === 'done' && hasNext ? 'Готово → следующий этап' : selStatus === 'done' ? 'Все этапы пройдены' : 'Готов к завершению'}
            </span>
            {selStatus === 'locked' ? (
              <button className="gr-cta" disabled>Этап закрыт</button>
            ) : selStatus === 'current' ? (
              allDoneForGate ? (
                hasNext ? (
                  <motion.button className="gr-cta" onClick={handleComplete} whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                    Завершить →
                  </motion.button>
                ) : (
                  <motion.button className="gr-cta" onClick={handleComplete} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Завершить →</motion.button>
                )
              ) : (
                <button className="gr-cta" disabled>Сначала задачи</button>
              )
            ) : (
              hasNext ? (
                <motion.button className="gr-cta" onClick={handleNext} whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                  Следующий →
                </motion.button>
              ) : (
                <button className="gr-cta" onClick={() => nav('/complete')}>Достижения →</button>
              )
            )}
          </div>
        </motion.section>
      </AnimatePresence>

      {/* XP toast gamified */}
      <AnimatePresence>
        {xpToast && (
          <motion.div
            key={xpToast.id}
            className="xp-toast"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 420, damping: 20 }}
          >
            +{xpToast.val} XP
          </motion.div>
        )}
      </AnimatePresence>

      {/* финал */}
      {finale && (
        <div className="gm-finale">
          <div className="gf-flash" />
          <div className="gf-banner">
            <div className="gf-title">Добро пожаловать в ряды MDIGITAL</div>
            <div className="gf-sub">Ты — часть команды. Поехали!</div>
            <button className="gf-cta" onClick={() => nav('/dashboard')}>Перейти в кабинет →</button>
          </div>
        </div>
      )}

     <style>{`
        /* ===== ROADMAP — MOBILE-FIRST · BLUE · Cinzel/ABeeZee/Marcellus ===== */
        .gm-root .font-orbitron{ font-family:'Open Sans',sans-serif !important;font-size:14px; letter-spacing:.06em }
        .gm-root .font-mono{ font-family:'Open Sans',sans-serif !important }
        .gm-root{ font-family:'Open Sans',sans-serif; }
        .gm-root{
          position:relative; display:grid; grid-template-columns:1fr; gap:10px; align-items:start;
          min-height:0; height:auto;
          background:
            radial-gradient(560px 340px at 18% 12%, rgba(30,58,138,.13), transparent 62%),
            radial-gradient(480px 320px at 84% 88%, rgba(59,130,246,.10), transparent 62%),
            linear-gradient(165deg, #0D1526 0%, #0A0F1E 70%);
          border:1px solid rgba(30,58,138,.14); border-radius:14px; overflow:hidden;
        }
        .gm-root::after{
          content:''; position:absolute; inset:0; pointer-events:none; z-index:1; opacity:.14;
          background:repeating-linear-gradient(0deg, transparent 0 2px, rgba(10,7,25,.5) 2px 4px);
        }

        .gm-left{
          position:static; align-self:start; z-index:2;
          display:flex; flex-direction:column;
          padding:14px 12px 10px;
          border-right:none; border-bottom:1px solid rgba(30,58,138,.12);
          background:linear-gradient(180deg, rgba(13,21,38,.48), rgba(10,15,30,.28));
          min-height:0; max-height:none; overflow:visible;
          border-radius:14px 14px 0 0;
        }
        .gl-brand{ display:flex; align-items:center; gap:10px; padding:10px 0; }
        .gl-mark{
          width:26px; height:26px; border-radius:7px; display:grid; place-items:center; flex-shrink:0;
          background:linear-gradient(135deg,#1E3A8A,#1E3A8A); box-shadow:0 0 16px rgba(37,99,235,.45);
        }
        .gl-mark svg{ width:14px; height:14px; stroke:#fff }
        .gl-eyebrow{ font-family:'Open Sans',sans-serif; font-size:11px; font-weight:800; letter-spacing:.14em; color:#fff }
        .gl-sub{ font-family:'Open Sans',sans-serif; font-size:10px; color:#a9a6c2; letter-spacing:.06em; margin-top:2px }

        .gm-tabs{ display:flex; gap:8px; margin-bottom:12px }
        .gm-tab{
          width:34px; height:34px; border-radius:50%; display:grid; place-items:center; position:relative;
          background:rgba(255,255,255,.04); border:1px solid rgba(30,58,138,.22);
          color:#8c88a6; cursor:pointer; transition:all .18s ease;
        }
        .gm-tab svg{ width:14px; height:14px; position:relative; z-index:2; }
        .gm-tab:hover{ color:#DBEAFE; border-color:rgba(37,99,235,.5) }
        .gm-tab.on{ color:#fff; border-color:#2563EB; box-shadow:0 0 0 3px rgba(30,58,138,.18), 0 0 16px rgba(30,58,138,.45); background:rgba(30,58,138,.14); }
        .gm-tabActive{ position:absolute; inset:0; border-radius:50%; background:rgba(30,58,138,.16); z-index:1; }

        .gm-sect{ margin-bottom:12px }
        .gs-rule{ height:1px; margin:8px 0; background:linear-gradient(90deg, rgba(37,99,235,.55), transparent) }
        .gs-meta{ display:flex; justify-content:space-between; font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#8c88a6 }
        .gs-count{ color:#3B82F6 }

        .gm-list{ flex:1; display:flex; flex-direction:column; min-height:0; overflow:visible; padding-right:0; gap:6px; max-width:100%; width:100%; }
        .gm-itemWrap{ flex:0 0 auto; width:100%; display:flex; flex-direction:column; align-items:stretch; }
        .gm-connector{ width:1px; height:8px; margin:0 0 0 13px; align-self:flex-start; background:linear-gradient(180deg, rgba(37,99,235,.30), rgba(37,99,235,.10)) }

        .gm-cardWrap{ filter:none; transition:filter .18s ease; position:relative; overflow:hidden; width:100%; }
        .gm-cardWrap.sel{ filter:drop-shadow(0 0 14px rgba(30,58,138,.45)) }
        .gm-cardWrap.shake{ animation:gmShake .42s ease }
        .gm-cardWrap.unlocking .gc-shine{
          position:absolute; inset:0; pointer-events:none; z-index:5;
          background:linear-gradient(100deg, transparent 30%, rgba(255,255,255,.55) 50%, transparent 70%);
          transform: translateX(-110%); animation: shineSweep 0.9s ease 0.15s;
        }
        @keyframes shineSweep{ to{ transform: translateX(110%) } }
        @keyframes gmShake{ 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }

        .gm-card{
          display:flex; align-items:center; gap:10px; width:100%;
          padding:13px 14px; text-align:left; cursor:pointer;
          background:rgba(13,21,38,.6);
          clip-path:none; border-radius:10px; border:1px solid rgba(30,58,138,.18);
          color:inherit; font-family:inherit;
          transition:background .18s ease, transform .18s ease;
        }
        .gm-card:hover{ transform:none }
        .gm-card:disabled{ cursor:not-allowed }
        .gm-card.locked{ background:rgba(13,21,38,.5); opacity:.6 }
        .gm-card.locked:hover{ transform:none }
        .gm-card.done{ background:rgba(16,26,48,.72) }

        .gc-ico{
          width:32px; height:32px; border-radius:50%; flex-shrink:0;
          display:grid; place-items:center;
          background:rgba(255,255,255,.06); border:1px solid rgba(37,99,235,.42); color:#3B82F6;
        }
        .gc-ico svg{ width:14px; height:14px }
        .gm-card.done .gc-ico{ background:rgba(37,99,235,.16); border-color:#3B82F6; color:#3B82F6 }
        .gm-card.locked .gc-ico{ color:#64748b; border-color:rgba(100,116,139,.3) }

        .gc-spark{ font-size:14px; color:#fff; display:inline-block; animation:sparkTw 1.6s ease-in-out infinite; }
        @keyframes sparkTw{ 0%,100%{ transform:scale(1) rotate(0deg); opacity:.85 } 50%{ transform:scale(1.25) rotate(90deg); opacity:1 } }

        .gc-body{ flex:1; min-width:0; display:flex; flex-direction:column; gap:3px }
        .gc-name{ font-family:'Open Sans',sans-serif; font-size:14px; font-weight:800; color:#f1f5f9; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .gc-state{ font-family:'Open Sans',sans-serif; font-size:9.5px; letter-spacing:.11em; text-transform:uppercase; color:#c4c0db }
        .gc-num{ align-self:center; font-size:9px; opacity:.62; flex-shrink:0 }

        .gm-card.current{ background:linear-gradient(100deg, rgba(37,99,235,.9), rgba(30,58,138,.85)) }
        .gm-card.current .gc-name{ color:#fff }
        .gm-card.current .gc-state{ color:rgba(255,255,255,.8) }
        .gm-card.current .gc-ico{ background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.5); color:#fff }
        .gm-cardWrap.sel:not(:has(.gm-card.current)) .gm-card:not(.locked){ background:linear-gradient(100deg, rgba(30,58,138,.28), rgba(37,99,235,.28)); }
        .gm-card.done .gc-name{ color:#DBEAFE }

        /* ---------- ПРАВАЯ ---------- */
        .gm-right{
          position:relative; z-index:2;
          display:flex; flex-direction:column; min-height:0;
          padding:12px 10px 10px;
          overflow:hidden; max-width:100%;
        }

        .gr-head{ display:flex; justify-content:space-between; align-items:flex-start; gap:10px }
        .gr-title{ font-family:'Open Sans',sans-serif; font-size:16px; font-weight:800; color:#fff; line-height:1.2; text-shadow:0 1px 8px rgba(0,0,0,.3) }
        .gr-subtitle{ font-family:'Open Sans',sans-serif; font-size:10px; letter-spacing:.13em; text-transform:uppercase; color:#93C5FD; margin-top:3px }
        .gr-emblem{ position:relative; width:40px; height:40px; flex-shrink:0 }
        .ge-ring{
          position:absolute; inset:0; border-radius:50%;
          background:conic-gradient(from 0deg, transparent 0 70%, rgba(37,99,235,.8) 85%, transparent 100%);
          animation:geSpin 3.2s linear infinite;
          -webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
          mask:radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
        }
        @keyframes geSpin{ to{ transform:rotate(360deg) } }
        .ge-core{
          position:absolute; inset:5px; border-radius:50%;
          display:grid; place-items:center; font-size:12px; font-weight:800; color:#DBEAFE;
          background:rgba(30,58,138,.12); border:1px solid rgba(37,99,235,.3);
          box-shadow:inset 0 0 18px rgba(30,58,138,.2);
        }
        .gr-emblem.done .ge-core{ color:#3B82F6; border-color:rgba(37,99,235,.45) }

        .gr-divider{ height:1px; margin:12px 0; background:linear-gradient(90deg, rgba(37,99,235,.4), rgba(37,99,235,.06)) }

        .gr-body{ flex:1; min-height:0; overflow:visible; padding-right:4px; padding-bottom:8px; }
        .gr-desc{ font-family:'Open Sans',sans-serif; font-size:16px; line-height:1.55; color:#E2E8F0; margin:0 0 12px; word-break:break-word; }
        .gr-gate{
          padding:8px 10px; border-radius:10px; margin-bottom:10px;
          background:rgba(59,130,246,.06); border:1px dashed rgba(59,130,246,.3);
          color:#93C5FD; font-size:11.5px; line-height:1.5; font-family:'Open Sans',sans-serif;
        }
        .gr-tasksLabel{ font-size:10.5px; letter-spacing:.18em; text-transform:uppercase; color:#b8b5cc; margin-bottom:8px }
        .gr-chips{ display:flex; align-items:center; gap:6px; flex-wrap:wrap }
        .gr-chip{
          width:30px; height:30px; border-radius:50%; display:grid; place-items:center;
          font-family:'Open Sans',sans-serif; font-size:10.5px; font-weight:700; color:#3B82F6;
          background:rgba(30,58,138,.08); border:1px solid rgba(37,99,235,.35);
        }
        .gr-chip.is-done{ background:rgba(37,99,235,.14); border-color:#3B82F6; color:#fff; box-shadow:0 0 10px rgba(37,99,235,.35); }
        .gr-chipLabel{ font-family:'Open Sans',sans-serif; font-size:10px; color:#c4c0db; margin-left:4px }

        /* ===== SUB TASKS (MOBILE-FIRST: УВЕЛИЧЕНО ДЛЯ МАЛЫХ ЭКРАНОВ) ===== */
        .sub-tasks{ display:flex; flex-direction:column; gap:9px; max-width:100%; }
        .task-row{
          display:flex; align-items:center; gap:10px; padding:11px 13px;
          background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08);
          border-radius:10px; cursor:pointer; font-size:13px; max-width:100%;
          transition:background .15s ease, border-color .15s ease;
        }
        .task-row:hover{ background:rgba(59,130,246,.08); border-color:rgba(59,130,246,.3) }
        .task-row.is-done{ color:#94a3b8; }
        .task-row.is-done .task-title{ text-decoration:line-through; opacity:.65 }
        .task-box{ width:18px; height:18px; border-radius:5px; border:1px solid rgba(147,197,253,.5); display:grid; place-items:center; flex-shrink:0; }
        .task-box svg{ width:10px; height:10px; stroke:#fff; }
        .task-row.is-done .task-box{ background:#2563EB; border-color:#2563EB; }
        .task-title{ flex:1; font-size:14px; line-height:1.4; color:#E2E8F0; min-width:0; word-break:break-word; }
        .task-xp{ font-size:11px; color:#a9a6c2; font-weight:600; letter-spacing:.04em; flex-shrink:0; }
        .reward{
          display:flex; align-items:center; gap:9px; margin-top:10px; padding:10px 12px;
          border:1px dashed rgba(251,191,36,.32); border-radius:10px; background:rgba(251,191,36,.06);
          position:relative; overflow:hidden; max-width:100%;
        }
        .reward::after{ content:''; position:absolute; inset:0; background:linear-gradient(100deg, transparent 40%, rgba(255,255,255,.16) 50%, transparent 60%); transform:translateX(-100%); animation: rewardShine 3.8s ease infinite; }
        @keyframes rewardShine{ 60%{ transform:translateX(100%)} 100%{ transform:translateX(100%)} }
        .reward svg{ width:15px; height:15px; stroke:#fbbf24; flex-shrink:0 }
        .reward b{ font-family:'Open Sans',sans-serif; font-size:11px; letter-spacing:.03em; color:#fbbf24; display:block }
        .reward span{ font-size:12px; color:#cbd5e1; display:block; margin-top:2px }

        .locked-body{ text-align:center; padding:10px 0 6px; }
        .locked-icon{ font-size:20px; opacity:.55; margin-bottom:6px; }
        .locked-title{ font-family:'Open Sans',sans-serif; font-size:10.5px; color:#fff; margin-bottom:6px; }
        .locked-desc{ font-size:12px; color:#cbd5e1; line-height:1.5; max-width:100%; margin:0 auto; }

        .gr-foot{
          display:flex; justify-content:space-between; align-items:center; gap:8px;
          padding-top:10px; margin-top:12px; border-top:1px solid rgba(30,58,138,.12);
          position:static; background:none; backdrop-filter:none; flex-wrap:wrap;
        }
        .gr-hint{ font-size:9px; letter-spacing:.12em; color:#a9a6c2; text-transform:uppercase; flex:1; min-width:0; }
        .gr-cta{
          padding:10px 18px; border:none; cursor:pointer; flex-shrink:0;
          font-family:'Open Sans',sans-serif; font-size:10px; font-weight:700; letter-spacing:.09em; text-transform:uppercase;
          color:#fff; background:linear-gradient(90deg,#1E3A8A 0%,#1D4ED8 100%);
          clip-path:polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
          transition:filter .16s ease, transform .16s ease; max-width:100%;
        }
        .gr-cta:hover:not(:disabled){ filter:brightness(1.15) drop-shadow(0 0 12px rgba(30,58,138,.5)); transform:translateY(-1px) }
        .gr-cta:disabled{ opacity:.4; cursor:not-allowed }

        .xp-toast{
          position:absolute; right:22px; top:78px; z-index:12;
          padding:8px 14px; border-radius:999px;
          background:linear-gradient(135deg, #2563EB, #1E3A8A); color:#fff;
          font-family:'Open Sans',sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em;
          box-shadow:0 8px 24px rgba(30,58,138,.45), 0 0 0 1px rgba(255,255,255,.15) inset;
          pointer-events:none;
        }

        /* финал */
        .gm-finale{ position:absolute; inset:0; z-index:20; display:grid; place-items:center; background:rgba(10,15,30,.82); backdrop-filter:blur(8px); animation:gfin .3s ease }
        @keyframes gfin{ from{opacity:0} to{opacity:1} }
        .gf-flash{ position:absolute; inset:0; background:#fff; opacity:0; pointer-events:none; animation:gflash .32s ease .05s }
        @keyframes gflash{ 0%{opacity:0} 20%{opacity:.85} 100%{opacity:0} }
        .gf-banner{
          position:relative; text-align:center; padding:30px 26px; max-width:520px; width:calc(100% - 24px);
          background:linear-gradient(170deg, rgba(13,21,38,.96), rgba(10,15,30,.98));
          border:1px solid rgba(37,99,235,.3);
          clip-path:polygon(22px 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%, 0 22px);
          box-shadow:0 24px 64px rgba(0,0,0,.55);
        }
        .gf-title{
          font-family:'Open Sans',sans-serif; font-weight:800; font-size:17px; line-height:1.35; margin-bottom:10px;
          background:linear-gradient(90deg,#3B82F6,#93C5FD,#3B82F6);
          -webkit-background-clip:text; background-clip:text; color:transparent;
        }
        .gf-sub{ font-family:'Open Sans',sans-serif; font-size:13px; color:#94a3b8; margin-bottom:20px }
        .gf-cta{
          padding:13px 26px; border:none; cursor:pointer;
          font-family:'Open Sans',sans-serif; font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase;
          color:#fff; background:linear-gradient(90deg,#1E3A8A,#1D4ED8);
          clip-path:polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
          transition:filter .16s;
        }
        .gf-cta:hover{ filter:brightness(1.15) }

        /* ===== ТЕЛЕФОНЫ (≤480) — сохраняем читабельный размер подзадач ===== */
        @media (max-width:480px){
          .gm-left{ padding:10px 8px 8px; }
          .gm-card{ padding:9px 10px; gap:8px; }
          .gc-name{ font-size:12px; } .gc-state{ font-size:7px; } .gc-ico{ width:26px; height:26px; }
          .gr-title{ font-size:18px; } .gr-chip{ width:26px; height:26px; font-size:9px; }
          .gm-right{ padding:10px 8px 8px; }
        }
        @media (max-width:380px){
          .gr-title{ font-size:16px; }
        }

        /* ===== ДЕСКТОП / ТАБЛЕТ (≥861) — оригинальные десктопные размеры ===== */
        @media (min-width:861px){
          .gm-root{ grid-template-columns:420px 1fr; gap:16px; min-height:680px; border-radius:20px; overflow:visible; }
          .gm-left{
            position:sticky; top:72px; align-self:start;
            padding:22px 18px 18px 20px;
            border-right:1px solid rgba(30,58,138,.14); border-bottom:none;
            background:linear-gradient(180deg, rgba(13,21,38,.5), rgba(10,15,30,.3));
            max-height: calc(100vh - 84px); overflow-y:auto; overflow-x:hidden;
            border-radius:20px 0 0 20px;
          }
          .gl-brand{ gap:11px; margin-bottom:16px }
          .gl-mark{ width:36px; height:36px; border-radius:9px; } .gl-mark svg{ width:19px; height:19px; }
          .gl-eyebrow{ font-size:13.5px; letter-spacing:.18em } .gl-sub{ font-size:11.5px; margin-top:3px }
          .gm-tabs{ gap:12px; margin-bottom:18px }
          .gm-tab{ width:44px; height:44px; } .gm-tab svg{ width:18px; height:18px; }
          .gm-sect{ margin-bottom:16px } .gs-title{ font-size:18px } .gs-rule{ margin:10px 0 } .gs-meta{ font-size:11px }
          .gm-list{ overflow-y:auto; padding-right:2px; gap:2px; }
          .gm-connector{ height:14px; margin-left:28px; }
          .gm-cardWrap{ filter:drop-shadow(0 3px 10px rgba(0,0,0,.35)); }
          .gm-cardWrap.sel{ filter:drop-shadow(0 0 14px rgba(30,58,138,.45)) drop-shadow(0 4px 12px rgba(0,0,0,.4)); }
          .gm-card{ padding:16px 18px; gap:14px; background:rgba(13,21,38,.6); clip-path:polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%); border:none; border-radius:0; }
          .gm-card:hover{ transform:translateX(3px) }
          .gc-ico{ width:42px; height:42px; } .gc-ico svg{ width:17px; height:17px; }
          .gc-spark{ font-size:16px; }
          .gc-body{ gap:4px } .gc-name{ font-size:16.5px; white-space:normal; overflow:visible; text-overflow:clip; } .gc-state{ font-size:11px; letter-spacing:.13em } .gc-num{ font-size:9px }
          .gm-right{ padding:20px 22px 22px; overflow:visible; }
          .gr-head{ gap:16px } .gr-title{ font-size:20px; text-shadow:none } .gr-subtitle{ font-size:11px; letter-spacing:.16em; margin-top:5px } .gr-emblem{ width:62px; height:62px } .ge-core{ font-size:18px }
          .gr-divider{ margin:16px 0 }
          .gr-desc{ font-size:14.5px; line-height:1.7; margin:0 0 16px }
          .gr-gate{ padding:10px 12px; font-size:11.5px; margin-bottom:16px }
          .gr-tasksLabel{ font-size:10.5px; margin-bottom:10px }
          .gr-chips{ gap:10px } .gr-chip{ width:42px; height:42px; font-size:13px; border-width:1.5px } .gr-chipLabel{ font-size:12px }
          .sub-tasks{ gap:8px } .task-row{ padding:10px 12px; font-size:11.8px; gap:10px } .task-box{ width:17px; height:17px; border-radius:5px } .task-box svg{ width:10px; height:10px } .task-title{ font-size:13px } .task-xp{ font-size:10px }
          .reward{ gap:10px; margin-top:12px; padding:11px 13px } .reward svg{ width:16px; height:16px } .reward b{ font-size:12px } .reward span{ font-size:11px }
          .locked-body{ padding:18px 0 8px } .locked-icon{ font-size:28px; margin-bottom:10px } .locked-title{ font-size:13.5px } .locked-desc{ font-size:12.5px; max-width:280px }
          .gr-foot{ gap:12px; padding-top:16px; margin-top:18px } .gr-hint{ font-size:10px } .gr-cta{ padding:12px 26px; font-size:11.5px; letter-spacing:.12em; clip-path:polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%) }
          .gr-emblem.done .ge-core{ color:#3B82F6 }
        }
        @media (prefers-reduced-motion: reduce){
          .gc-spark, .ge-ring, .gr-chip, .gm-cardWrap.shake, .reward::after{ animation:none !important }
          .gm-right{ animation:none }
        }
      `}</style>
    </div>
  );
}
