import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, LayoutDashboard, Lock, Map as MapIcon, Sparkles, FileText, Smartphone, ListChecks, FlaskConical, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Card, CardContent } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Separator } from '../ui/separator';
import { CountUp, ShinyText } from '../bits';
import { cn } from '../../lib/utils';
import { STAGES as FALLBACK_STAGES } from '../../data/stages';
import type { StageId } from '../../data/stages';
import type { StageStatus } from '../../store/useOnboarding';
import { useOnboarding } from '../../store/useOnboarding';
import { useStages } from '../../api/queries';
import { useEmbedded } from '../../hooks/useEmbedded';
import { Stage2AppDownload } from '../stages/v2/Stage2AppDownload';
import { Stage3Docs } from '../stages/v2/Stage3Docs';
import { Stage4TeamVideoChecklist } from '../stages/v2/Stage4Combined';
import { Stage5Dept } from '../stages/v2/Stage5Dept';

type Props = {
  statuses: Record<StageId, StageStatus>;
  onSelect?: (id: StageId) => void; // kept for compat, not used as modal
  done: number;
};

const TABS: { id: string; label: string; path?: string; Icon: typeof LayoutDashboard }[] = [
  { id: 'dash', label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard },
  { id: 'map', label: 'Карта', path: '/map', Icon: MapIcon },
];

export function IsometricRoadmap({ statuses, done }: Props) {
  const nav = useNavigate();
  const embedded = useEmbedded();
  const { data: stagesData } = useStages();
  const STAGES = stagesData ?? FALLBACK_STAGES;
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const toggleTask = useOnboarding((s) => s.toggleTask);
  const completeStage = useOnboarding((s) => s.completeStage);

  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<StageId>(() => {
    const q = Number(searchParams.get('stage')) as StageId;
    if (q >= 1 && q <= 4 && statuses[q] !== 'locked') return q;
    for (let i = 1 as StageId; i <= 4; i = (i + 1) as StageId) {
      if (statuses[i] === 'current') return i;
    }
    return 1;
  });
  useEffect(() => {
    const q = Number(searchParams.get('stage')) as StageId;
    if (q >= 1 && q <= 4 && statuses[q] !== 'locked') setSelected(q);
  }, [searchParams, statuses]);
  // keep selected in sync when status changes (e.g. after completion)
  useEffect(() => {
    if (statuses[selected] === 'locked') {
      // fallback to current
      for (let i = 1 as StageId; i <= 4; i = (i + 1) as StageId) if (statuses[i] === 'current') { setSelected(i); return; }
    }
  }, [statuses, selected]);

  const [shakeId, setShakeId] = useState<StageId | null>(null);
  const [finale, setFinale] = useState(false);
  const [unlockingId, setUnlockingId] = useState<StageId | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [xpToast, setXpToast] = useState<{ id: number; val: number } | null>(null);
  const prevDoneRef = useRef(done);

  const sel = STAGES.find((s) => s.id === selected)!;
  const selStatus = statuses[selected];
  const selDoneTasks = useMemo(() => STAGES.find((s) => s.id === selected)!.subTasks, [selected]);
  const selDoneIds = doneTasks[selected] || [];
  const allDoneForGate = sel.subTasks.every((t) => selDoneIds.includes(t.id));
  const hasNext = selected < 4;

  // finale when 4/4
  useEffect(() => {
    if (done === 4 && prevDoneRef.current < 4) {
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

  useEffect(() => {
    if (!finale) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';
    document.documentElement.style.overscrollBehavior = 'contain';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, [finale]);

  // unlocking animation when progress increments
  const prevStatusesRef = useRef(statuses);
  useEffect(() => {
    const prev = prevStatusesRef.current;
    for (let i = 1 as StageId; i <= 4; i = (i + 1) as StageId) {
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
    if (next <= 4 && statuses[next] !== 'locked') setSelected(next);
    else if (next <= 4) {
      // try to trigger complete then jump
      setSelected(next);
    }
  };

  return (
    <div className="gm-root">
      {/* ================= ЛЕВАЯ ПАНЕЛЬ ================= */}
      <aside className="gm-left">
        <div className="gl-brand">
          <img src="/mdigital-logo.svg" alt="logo" width={100} />
        </div>

        {!embedded && (
        <motion.div className="mb-3 flex gap-2" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}>
          {TABS.map((t) => (
            <motion.span
              key={t.id}
              variants={{ hidden: { opacity: 0, scale: 0.7, y: 6 }, visible: { opacity: 1, scale: 1, y: 0 } }}
            >
              <Button size="icon" variant="outline" title={t.label} onClick={() => t.path && nav(t.path)}>
                <t.Icon />
              </Button>
            </motion.span>
          ))}
        </motion.div>
        )}

        <div className="mb-3">
          <Separator className="mb-2 bg-primary/30" />
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>Прогресс</span>
            <span className="font-bold text-primary"><CountUp to={done} />/4</span>
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
                        <Lock size={14} strokeWidth={1.8} />
                      ) : st === 'done' ? (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ display: 'grid', placeItems: 'center' }}>
                          <Check size={14} strokeWidth={2.4} />
                        </motion.span>
                      ) : (
                        <span className="gc-spark"><Sparkles size={14} /></span>
                      )}
                    </span>
                    <span className="gc-body">
                      <span className="gc-name">{s.shortLabel}</span>
                      <Badge
                        variant={st === 'done' ? 'default' : 'secondary'}
                        className={cn(
                          'w-fit px-1.5 py-0 text-[9px] uppercase tracking-widest',
                          st === 'locked' && 'bg-muted text-muted-foreground',
                          st === 'current' && 'bg-primary/20 text-primary-foreground',
                        )}
                      >
                        {st === 'locked' ? 'Закрыто' : st === 'current' ? 'Сейчас' : 'Пройдено'}
                      </Badge>
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

      {/* bottom: нижняя таб-панель этапов (только ≤640px, см. CSS) */}
        <nav className="gm-bottombar" aria-label="Этапы">
          {STAGES.map((s) => {
            const st = statuses[s.id];
            const isOn = selected === s.id && st !== 'locked';
            const StageIcon = [Smartphone, FileText, ListChecks, FlaskConical][s.id - 1] ?? Smartphone;
            return (
              <button
                key={s.id}
                type="button"
                className={`gm-btab ${st} ${isOn ? 'on' : ''}`}
                onClick={() => pick(s.id as StageId)}
                disabled={st === 'locked'}
                aria-label={`Этап ${s.id}: ${s.title}`}
              >
                <span className="btab-icon"><StageIcon size={16} strokeWidth={1.8} /></span>
                <span className="btab-label">{s.shortLabel}</span>
                <span className={`btab-dot ${st}`} />
              </button>
            );
          })}
        </nav>

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
            <motion.div
              layout
              className={cn(
                'grid h-11 w-11 shrink-0 place-items-center rounded-full border font-mono text-sm font-extrabold',
                selStatus === 'done'
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-border bg-muted text-muted-foreground',
              )}
              animate={unlockingId === selected ? { scale: [1, 1.12, 1] } : {}}
              transition={{ duration: 0.6 }}
            >
              {selected}
            </motion.div>
          </div>

          <div className="gr-divider" />

          <div className="gr-body">
            <p className="gr-desc">{sel.description}</p>

            {selected === 1 && selStatus !== 'locked' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Stage2AppDownload stageId={selected} />
              </motion.div>
            )}
            {selected === 2 && selStatus !== 'locked' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Stage3Docs stageId={selected} />
              </motion.div>
            )}
            {selected === 3 && selStatus !== 'locked' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Stage4TeamVideoChecklist stageId={selected} onVideoEnded={setVideoEnded} />
              </motion.div>
            )}
            {selected === 4 && selStatus !== 'locked' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Stage5Dept stageId={selected} />
              </motion.div>
            )}

            {selected !== 1 && selStatus !== 'locked' && (
              <div className="sub-tasks" style={{ marginTop: 14 }}>
                {sel.subTasks.map((t, i) => {
                  const done = selDoneIds.includes(t.id);
                  const videoBlock = selected === 3 && !videoEnded && !done;
                  return (
                    <motion.div
                      key={t.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card/60 px-3 py-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5',
                        videoBlock && 'pointer-events-none opacity-50',
                      )}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => { if (!videoBlock) toggleTask(selected, t.id); }}
                    >
                      <Checkbox checked={done} disabled={videoBlock} onCheckedChange={() => { if (!videoBlock) toggleTask(selected, t.id); }} />
                      <span className={cn('min-w-0 flex-1 leading-snug', done && 'text-muted-foreground line-through opacity-70')}>{t.title}</span>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">+{t.xp} XP</Badge>
                    </motion.div>
                  );
                })}
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
                  <Card className="border-dashed border-amber-500/40 bg-amber-500/5">
                    <CardContent className="flex items-center gap-2.5 pt-4">
                      <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
                      <div>
                        <div className="text-[11px] font-bold tracking-wide text-amber-300">Ачивка «{sel.rewardName.replace('Ачивка «', '').replace('»', '')}»</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{sel.rewardDesc}</div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            )}

            {selStatus === 'locked' && (
              <div className="py-3 text-center">
                <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </div>
                <div className="mb-1 text-xs font-semibold">Этот этап пока недоступен</div>
                <div className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground">Пройди предыдущий этап, чтобы открыть «{sel.title}».</div>
              </div>
            )}

            {selected === 2 && selStatus === 'current' && !allDoneForGate && (
              <Alert className="mb-2.5 border-dashed border-primary/40 bg-primary/5">
                <AlertDescription className="text-xs text-primary">Открой каждый документ и пролистай до конца — иначе этап не засчитается.</AlertDescription>
              </Alert>
            )}

            <div className="gr-tasksLabel font-mono" style={{ marginTop: 16 }}>
              {selected === 2 ? 'Шаги этапа' : 'Задачи этапа'}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-3">
              {selected === 2 ? (
                (() => {
                  const d2 = (doneTasks[2] || []);
                  const steps = [
                    { label: 'Документы', ids: ['1-dogovor','1-nda','1-pdp','1-ip','1-sn'], hint: '5 документов' },
                    { label: 'Доступы', ids: ['1-mbusiness','1-accountant','1-wifi','1-proxy','1-telegram','1-jira','1-figma','1-gitlab'], hint: '8 сервисов' },
                    { label: 'Confluence', ids: ['1-confluence-read'], hint: '1 задача' },
                  ];
                  return steps.map((s, i) => {
                    const done = s.ids.every((id) => d2.includes(id)) || selStatus === 'done';
                    return (
                      <motion.span
                        key={s.label}
                        title={`${s.label} · ${s.hint}`}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.06, type: 'spring', stiffness: 420, damping: 18 }}
                      >
                        <Badge className={cn('grid h-8 w-8 place-items-center rounded-full p-0 text-[11px]', done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                          {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </Badge>
                      </motion.span>
                    );
                  });
                })()
              ) : (
                selDoneTasks.map((t, i) => {
                  const done = selDoneIds.includes(t.id) || selStatus === 'done';
                  return (
                    <motion.span
                      key={t.id}
                      title={t.title}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06, type: 'spring', stiffness: 420, damping: 18 }}
                    >
                      <Badge className={cn('grid h-8 w-8 place-items-center rounded-full p-0 text-[11px]', done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </Badge>
                    </motion.span>
                  );
                })
              )}
              <span className="ml-1 text-[10px] text-muted-foreground">
                {selected === 2 ? '3 шага' : `${selDoneTasks.length} задач${selDoneTasks.length === 1 ? 'а' : selDoneTasks.length < 5 ? 'и' : ''}`}
              </span>
            </div>
          </div>

          <div className="gr-foot">
            <span className="gr-hint font-mono">
              {selStatus === 'locked' ? 'Пройди предыдущий этап' : selStatus === 'current' && !allDoneForGate ? 'Выполни все задачи' : selStatus === 'current' && selected === 3 && !videoEnded ? 'Досмотри видео до конца' : selStatus === 'done' && hasNext ? 'Готово → следующий этап' : selStatus === 'done' ? 'Все этапы пройдены' : 'Готов к завершению'}
            </span>
            {selStatus === 'locked' ? (
              <Button disabled>Этап закрыт</Button>
            ) : selStatus === 'current' ? (
              allDoneForGate && (selected !== 3 || videoEnded) ? (
                <Button onClick={handleComplete}>Завершить <ArrowRight /></Button>
              ) : (
                <Button disabled>{selected === 3 && !videoEnded ? 'Досмотри видео' : 'Сначала задачи'}</Button>
              )
            ) : (
              hasNext ? (
                <Button onClick={handleNext}>Следующий <ArrowRight /></Button>
              ) : (
                <Button onClick={() => nav('/complete')}>Достижения <ArrowRight /></Button>
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
            className="pointer-events-none absolute right-5 top-20 z-10 rounded-full bg-primary px-4 py-2 text-[11px] font-extrabold tracking-widest text-primary-foreground shadow-lg"
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
      <Dialog open={finale} onOpenChange={(o) => { if (!o) setFinale(false); }}>
        <DialogContent className="max-w-md text-center">
          <DialogHeader>
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <Trophy className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl">
              <ShinyText text="Добро пожаловать в ряды MDIGITAL" />
            </DialogTitle>
            <DialogDescription>Все этапы успешно завершены!</DialogDescription>
          </DialogHeader>
          <Button size="lg" className="w-full" onClick={() => nav('/complete')}>
            Получить сертификат <ArrowRight />
          </Button>
        </DialogContent>
      </Dialog>

     <style>{`
        /* ===== ROADMAP — MOBILE-FIRST · BLUE · Cinzel/Marcellus ===== */
        .gm-root .font-orbitron{ font-family:'Open Sans',sans-serif !important; letter-spacing:.06em }
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
        .gm-card.done .gc-ico{ background:rgba(34,197,94,.14); border-color:#22C55E; color:#22C55E; box-shadow:0 0 12px rgba(34,197,94,.35); }
        .gm-card.locked .gc-ico{ color:#64748b; border-color:rgba(100,116,139,.3) }

        .gc-spark{ font-size:14px; color:#fff; display:inline-block; animation:sparkTw 1.6s ease-in-out infinite; }
        @keyframes sparkTw{ 0%,100%{ transform:scale(1) rotate(0deg); opacity:.85 } 50%{ transform:scale(1.25) rotate(90deg); opacity:1 } }

        .gc-body{ flex:1; min-width:0; display:flex; flex-direction:column; gap:3px }
        .gc-name{ font-family:'Open Sans',sans-serif; font-size:14px; font-weight:800; color:#f1f5f9; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .gc-num{ align-self:center; font-size:9px; opacity:.62; flex-shrink:0 }

        .gm-card.current{ background:linear-gradient(100deg, rgba(37,99,235,.9), rgba(30,58,138,.85)) }
        .gm-card.current .gc-name{ color:#fff }
        .gm-card.current .gc-ico{ background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.5); color:#fff }
        .gm-cardWrap.sel:not(:has(.gm-card.current)) .gm-card:not(.locked){ background:linear-gradient(100deg, rgba(30,58,138,.28), rgba(37,99,235,.28)); }
        .gm-card.done .gc-name{ color:#DBEAFE }

        /* ---------- ПРАВАЯ ---------- */
        .gm-right{
          position:relative; z-index:2;
          display:flex; flex-direction:column; min-height:0;
          padding:12px 10px 10px;
          overflow:hidden;
          max-width:100%;
        }

        .gr-head{ display:flex; justify-content:space-between; align-items:flex-start; gap:10px }
        .gr-title{ font-family:'Open Sans',sans-serif; font-size:16px; font-weight:800; color:#fff; line-height:1.2; text-shadow:0 1px 8px rgba(0,0,0,.3) }
        .gr-subtitle{ font-family:'Open Sans',sans-serif; font-size:10px; letter-spacing:.13em; text-transform:uppercase; color:#93C5FD; margin-top:3px }

        .gr-divider{ height:1px; margin:12px 0; background:linear-gradient(90deg, rgba(37,99,235,.4), rgba(37,99,235,.06)) }

        .gr-body{ flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; padding-right:4px; padding-bottom:24px; }
        .gr-desc{ font-family:'Open Sans',sans-serif; font-size:16px; line-height:1.55; color:#E2E8F0; margin:0 0 12px; word-break:break-word; }
        .gr-tasksLabel{ font-size:10.5px; letter-spacing:.18em; text-transform:uppercase; color:#b8b5cc; margin-bottom:8px }



        .gr-foot{
          display:flex; justify-content:space-between; align-items:center; gap:8px;
          padding:12px 0 16px; margin-top:auto; flex-shrink:0;
          border-top:1px solid rgba(30,58,138,.15);
          background:none; flex-wrap:wrap;
        }
        .gr-hint{ font-size:9px; letter-spacing:.12em; color:#a9a6c2; text-transform:uppercase; flex:1 1 200px; min-width:0 }



        /* ===== ТЕЛЕФОНЫ (≤480) — компактный UI ===== */
        @media (max-width:480px){
          .gm-left{ padding:10px 8px 8px; }
          .gm-card{ padding:9px 10px; gap:8px; }
          .gc-name{ font-size:11.5px; } .gc-ico{ width:26px; height:26px; }
          .gr-title{ font-size:15px; }
          .gm-right{ padding:10px 8px 8px; }
          .gr-desc{ font-size:13px; line-height:1.45; }

        }
        @media (max-width:380px){
          .gr-title{ font-size:14px; }
          .gr-desc{ font-size:12px; }
        }

        /* ===== ДЕСКТОП / ТАБЛЕТ (≥861) — app-shell: страница не скроллится,
           левая и правая панели скроллятся независимо внутри фиксированной высоты.
           (position:sticky ненадёжен: body{overflow-x:hidden} ломает его в grid) ===== */
        @media (min-width:861px){
          .gm-root{
            grid-template-columns:380px 1fr; gap:14px;
            height:calc(100vh - 60px - 18px - 40px); height:calc(100dvh - 60px - 18px - 40px); min-height:480px;
            border-radius:18px; overflow:hidden;
          }
          .gm-left{
            position:static; z-index:2;
            height:100%; max-height:none;
            padding:18px 16px 16px 18px;
            border-right:1px solid rgba(30,58,138,.14); border-bottom:none;
            background:linear-gradient(180deg, rgba(13,21,38,.5), rgba(10,15,30,.3));
            overflow-y:auto; overflow-x:hidden;
            scrollbar-gutter:stable;
            border-radius:0;
          }
          .gl-brand{ gap:10px; margin-bottom:14px }
          .gl-mark{ width:32px; height:32px; border-radius:8px; } .gl-mark svg{ width:16px; height:16px; }
          .gl-eyebrow{ font-size:12px; letter-spacing:.16em } .gl-sub{ font-size:10.5px; margin-top:2px }
          .gm-list{ overflow:visible; padding-right:2px; gap:1px; }
          .gm-connector{ height:10px; margin-left:22px; }
          .gm-cardWrap{ filter:drop-shadow(0 2px 8px rgba(0,0,0,.3)); }
          .gm-cardWrap.sel{ filter:drop-shadow(0 0 10px rgba(30,58,138,.4)) drop-shadow(0 3px 10px rgba(0,0,0,.35)); }
          .gm-card{ padding:12px 14px; gap:10px; background:rgba(13,21,38,.6); border-radius:10px; border:1px solid rgba(30,58,138,.18); }
          .gm-card:hover{ transform:translateX(2px) }
          .gc-ico{ width:34px; height:34px; } .gc-ico svg{ width:15px; height:15px; }
          .gc-spark{ font-size:14px; }
          .gc-body{ gap:3px } .gc-name{ font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .gc-num{ font-size:8px }
          .gm-right{ padding:16px 18px 18px; height:100%; overflow:hidden; scrollbar-gutter:stable; }
          .gr-head{ gap:12px } .gr-title{ font-size:15px; text-shadow:none } .gr-subtitle{ font-size:9.5px; letter-spacing:.14em; margin-top:3px }
          .gr-divider{ margin:12px 0 }
          .gr-desc{ font-size:12px; line-height:1.6; margin:0 0 12px }
          .gr-body{ overflow-y:auto; overflow-x:hidden; scrollbar-gutter:stable; }
          .gr-tasksLabel{ font-size:9.5px; margin-bottom:8px }
          .sub-tasks{ gap:6px }
          .gr-foot{ gap:10px; padding:14px 0 0; margin-top:auto } .gr-hint{ font-size:9px; flex:1 1 160px }
        }
        /* ===== МОБАЙЛ-НАВИГАЦИЯ: ≤640px нижняя таб-панель ===== */
        .gm-bottombar{ display:none; }
        @media (max-width:640px){
          .gm-left{ display:none; }
          .gm-bottombar{
            display:flex; position:fixed; left:0; right:0; bottom:0; z-index:60;
            padding:6px 6px calc(6px + env(safe-area-inset-bottom, 0px));
            background:rgba(8,12,24,.96); border-top:1px solid rgba(59,130,246,.2);
            backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
            gap:0; justify-content:space-around;
          }
          .gm-btab{
            flex:1; display:flex; flex-direction:column; align-items:center; gap:3px;
            padding:5px 2px; border-radius:10px; color:#64748b; min-width:0;
            transition:color .15s, background .15s; -webkit-tap-highlight-color:transparent; border:none; background:none;
          }
          .gm-btab:active{ transform:scale(.92) }
          .btab-icon{ display:grid; place-items:center; width:22px; height:22px; border-radius:6px; transition:background .15s, box-shadow .15s, color .15s }
          .gm-btab.on .btab-icon{ background:rgba(59,130,246,.2); color:#fff; box-shadow:0 0 10px rgba(59,130,246,.35) }
          .gm-btab.done .btab-icon{ color:#60A5FA }
          .btab-label{ font-size:9px; font-weight:600; letter-spacing:.04em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100% }
          .gm-btab.on .btab-label{ color:#fff }
          .btab-dot{ width:5px; height:5px; border-radius:50%; background:#334155; transition:background .15s, box-shadow .15s }
          .btab-dot.done{ background:#3B82F6; box-shadow:0 0 6px rgba(59,130,246,.8) }
          .btab-dot.current{ background:#fff; box-shadow:0 0 6px rgba(255,255,255,.7) }
          .gm-btab:disabled{ opacity:.35; -webkit-tap-highlight-color:transparent }
          .gm-btab:disabled .btab-icon{ background:none; box-shadow:none }
          .gr-hint{ font-size:8px; letter-spacing:.1em }
          .gm-right{ padding-bottom:calc(76px + env(safe-area-inset-bottom, 0px)); }
          .gr-body{ padding-bottom:8px; }
        }
        @media (prefers-reduced-motion: reduce){
          .gc-spark, .gm-cardWrap.shake{ animation:none !important }
          .gm-right{ animation:none }
        }
      `}</style>
    </div>
  );
}
