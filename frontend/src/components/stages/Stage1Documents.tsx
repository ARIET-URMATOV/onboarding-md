import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, BadgeCheck, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Clock, FileCheck,
  FileText, FolderCheck, Hourglass, IdCard, KeyRound, RotateCcw, Send, ShieldCheck, Wifi, XCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { StageId } from '../../data/stages';
import { useOnboarding } from '../../store/useOnboarding';
import { DocumentModal, type DocKind } from './DocumentModal';
import { api } from '../../api/client';

interface Props { stageId: StageId }

/* ── ключи документов → taskId (legacy 1-docs/lead/mplus/jira/confluence удалены) ── */
type DocKey = Exclude<DocKind, 'docs' | 'lead' | 'mplus' | 'jira' | 'confluence'>;
const docToTask: Record<DocKey, string> = {
  dogovor: '1-dogovor', nda: '1-nda', pdp: '1-pdp', ip: '1-ip', sn: '1-sn',
  mbusiness: '1-mbusiness', accountant: '1-accountant', wifi: '1-wifi', proxy: '1-proxy', telegram: '1-telegram',
};

/* helpers */
function DocCard({ k, doneFlag, pendingFlag, icon, title, sub, onOpen }: {
  k: DocKey; doneFlag: boolean; pendingFlag?: boolean; icon: React.ReactNode; title: string; sub: string; onOpen: (k: DocKey) => void;
}) {
  return (
    <button type="button" className={`doc-card ${doneFlag ? 'done' : ''} ${pendingFlag ? 'pending' : ''}`} onClick={() => onOpen(k)} aria-label={title}>
      <div className={`dc-icon ${doneFlag ? 'dc-done' : ''}`}>{doneFlag ? '✓' : pendingFlag ? '…' : icon}</div>
      <div className="dc-body">
        <div className="dc-title">{title} {doneFlag && <span className="dc-badge">подтверждено</span>}{!doneFlag && pendingFlag && <span className="dc-badge pending">ожидает HR</span>}</div>
        <div className="dc-sub">{sub}</div>
      </div>
      <span className={`dc-chevron ${doneFlag ? 'is-done' : ''}`} aria-hidden>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5" /></svg>
      </span>
    </button>
  );
}

function StepHeader({ n, title, reward, desc, open, done, onToggle }: {
  n: number; title: string; reward: string; desc?: string; open?: boolean; done?: boolean; onToggle?: () => void;
}) {
  return (
    <div className={`step-head ${onToggle ? 'clickable' : ''}`} onClick={onToggle} role={onToggle ? 'button' : undefined} tabIndex={onToggle ? 0 : undefined}
      onKeyDown={onToggle ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}>
      <div className="sh-num">{done ? <CheckCircle2 size={16} /> : n}</div>
      <div className="sh-body">
        <div className="sh-title">{title} <span className="sh-reward">{reward}</span></div>
        {desc && <div className="sh-desc">{desc}</div>}
      </div>
      {onToggle && <span className={`sh-chevron ${open ? 'open' : ''}`} aria-hidden><ChevronDown size={18} /></span>}
    </div>
  );
}

export function Stage1Documents({ stageId }: Props) {
  const done = useOnboarding((s) => s.doneTasks[stageId] || []);
  const pending = useOnboarding((s) => s.pending);
  const requestTask = useOnboarding((s) => s.requestTask);
  const refreshMe = useOnboarding((s) => s.refreshMe);
  const connectLive = useOnboarding((s) => s.connectLive);
  const createdAt = useOnboarding((s) => s.createdAt);
  const user = useOnboarding((s) => s.user);
  const resolvedCreatedAt = (user as unknown as { createdAt?: string | null })?.createdAt ?? createdAt ?? null;

  const [open, setOpen] = useState<DocKind | null>(null);

  // Wi-Fi MAC + пароль
  const [mac, setMac] = useState('');
  const [macSent, setMacSent] = useState(false);
  const [macError, setMacError] = useState<string | null>(null);
  const [wifiPass, setWifiPass] = useState('');
  const [wifiMsg, setWifiMsg] = useState<string | null>(null);

  // MPulse code
  const [mpulseCode, setMpulseCode] = useState('');
  const [mpulseVerifying, setMpulseVerifying] = useState(false);
  const [mpulseMsg, setMpulseMsg] = useState<string | null>(null);

  // Confluence: 5 обязательных ссылок + видимые 120с (таймер стоит на паузе когда вкладка скрыта)
  const CONF_MIN_SECONDS = 120;
  const CONF_LINKS = [
    { pageId: '51479172', title: 'Корпоративная культура', url: 'https://confluence.mdigital.kg/pages/viewpage.action?pageId=51479172' },
    { pageId: '15370476', title: 'Система грейдов в компании', url: 'https://confluence.mdigital.kg/pages/viewpage.action?pageId=15370476' },
    { pageId: '86868582', title: 'О компании и структура', url: 'https://confluence.mdigital.kg/pages/viewpage.action?pageId=86868582' },
    { pageId: '86868604', title: 'Команды и роли', url: 'https://confluence.mdigital.kg/pages/viewpage.action?pageId=86868604' },
    { pageId: '51478978', title: 'Общие принципы разработки', url: 'https://confluence.mdigital.kg/pages/viewpage.action?pageId=51478978' },
  ];
  // localStorage: прогресс чтения переживает перезагрузку (ключ на пользователя)
  const cfKey = `cf-progress-${user?.email ?? 'anon'}`;
  const loadCf = (): { openedAt: string | null; clicked: Record<string, string>; visibleSec: number } => {
    try {
      const raw = localStorage.getItem(cfKey);
      if (raw) {
        const d = JSON.parse(raw) as { openedAt?: string; clicked?: Record<string, string>; visibleSec?: number };
        return { openedAt: d.openedAt ?? null, clicked: d.clicked ?? {}, visibleSec: d.visibleSec ?? 0 };
      }
    } catch { /* ignore */ }
    return { openedAt: null, clicked: {}, visibleSec: 0 };
  };
  const [confOpenedAt, setConfOpenedAt] = useState<string | null>(() => loadCf().openedAt);
  const [confClicked, setConfClicked] = useState<Record<string, string>>(() => loadCf().clicked);
  const [confVisibleSec, setConfVisibleSec] = useState<number>(() => loadCf().visibleSec);
  useEffect(() => {
    try {
      localStorage.setItem(cfKey, JSON.stringify({ openedAt: confOpenedAt, clicked: confClicked, visibleSec: confVisibleSec }));
    } catch { /* ignore */ }
  }, [cfKey, confOpenedAt, confClicked, confVisibleSec]);
  const [confConfirming, setConfConfirming] = useState(false);
  const [confMsg, setConfMsg] = useState<string | null>(null);
  const confClickedCount = Object.keys(confClicked).length;
  const confRemain = Math.max(0, Math.ceil(CONF_MIN_SECONDS - confVisibleSec));
  const confReady = confClickedCount >= CONF_LINKS.length && confRemain <= 0;

  const isDone = (k: DocKey) => done.includes(docToTask[k]);
  const isTaskDone = (taskId: string) => done.includes(taskId);
  const isPending = (k: DocKey) => pending.includes(docToTask[k]);
  const [reqMsg, setReqMsg] = useState<string | null>(null);

  // Шаг 1: пакет документов целиком (физическая верификация HR, одна кнопка)
  const DOC_IDS = ['1-dogovor', '1-nda', '1-pdp', '1-ip', '1-sn'];
  const DOCS_PACKAGE = [
    { id: '1-dogovor', title: 'Договор об оказании услуг', sub: '2 экземпляра · подписать оба, один остаётся у вас',
      detail: 'Распечатайте или получите бланк у HR. Проверьте паспортные данные и банковские реквизиты, подпишите оба экземпляра. Один остаётся у вас, второй передаётся компании.', Icon: FileText },
    { id: '1-nda', title: 'NDA — о неразглашении', sub: '2 экземпляра · строгий режим, действует 3 года',
      detail: 'Устанавливает строгий режим конфиденциальности в отношении разработок, клиентов и партнёров. Действует 3 года после завершения сотрудничества. Подпишите оба экземпляра.', Icon: ShieldCheck },
    { id: '1-pdp', title: 'Соглашение о персональных данных', sub: 'Обязательный документ',
      detail: 'Разрешение на обработку персональных данных для кадрового учёта и безопасности. Подписывается при старте онбординга, данные хранятся по закону.', Icon: FileCheck },
    { id: '1-ip', title: 'Свидетельство ИП', sub: 'Копия / выписка + реквизиты',
      detail: 'Предоставьте копию свидетельства или выписку из реестра плюс банковские реквизиты — файлом или бумажной копией бухгалтеру / HR для взаиморасчётов.', Icon: IdCard },
    { id: '1-sn', title: 'Справка о несудимости', sub: 'Актуальный документ',
      detail: 'Электронная справка с Госуслуг / ЦОН или бумажный оригинал. Подтверждает соответствие требованиям безопасности для доступа к проектам клиентов.', Icon: BadgeCheck },
  ];
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const rejected = useOnboarding((s) => s.rejected);
  const lastVerifiedAt = useOnboarding((s) => s.lastVerifiedAt);
  const lastVerifiedTask = useOnboarding((s) => s.lastVerifiedTask);
  const pendingDocs = DOC_IDS.filter((id) => pending.includes(id));
  const rejectedDocs = rejected.filter((r) => DOC_IDS.includes(r.task_id));
  const [sendingDocs, setSendingDocs] = useState(false);
  const submitDocs = async () => {
    setSendingDocs(true);
    setReqMsg(null);
    try {
      await api.post('/api/progress/request-batch', { task_ids: DOC_IDS });
      await refreshMe();
    } catch (e) {
      setReqMsg(e instanceof Error ? e.message : 'Не удалось отправить пакет');
    } finally {
      setSendingDocs(false);
    }
  };

  // live-лента: HR подтвердил → прогресс обновится сам
  useEffect(() => { connectLive(); }, [connectLive]);

  const handleConfirm = (k: DocKey) => {
    // Модалка: "передал HR" = запрос на верификацию, НЕ свободная галочка (CON-04).
    if (isDone(k) || isPending(k)) return;
    setReqMsg(null);
    requestTask(docToTask[k]).catch((e) => {
      setReqMsg(e instanceof Error ? e.message : 'Не удалось отправить запрос');
    });
  };

  // SLA: 1 неделя с момента старта онбординга (created_at)
  const sla = useMemo(() => {
    if (!resolvedCreatedAt) return { overdue: false, daysLeft: null as number | null, label: 'SLA: 1 неделя с момента старта' };
    const start = new Date(resolvedCreatedAt).getTime();
    if (Number.isNaN(start)) return { overdue: false, daysLeft: null, label: 'SLA: 1 неделя с момента старта' };
    const now = Date.now();
    const diffDays = (now - start) / (1000 * 60 * 60 * 24);
    const overdue = diffDays > 7;
    const daysLeft = Math.max(0, Math.ceil(7 - diffDays));
    return { overdue, daysLeft, label: overdue ? `Просрочено: ${Math.floor(diffDays)} дн. с регистрации` : `Осталось ${daysLeft} дн. из 7` };
  }, [resolvedCreatedAt]);

  const step1Done = ['1-dogovor','1-nda','1-pdp','1-ip','1-sn'].every(id => done.includes(id));
  const step2Done = ['1-mbusiness','1-accountant','1-wifi','1-proxy','1-telegram'].every(id => done.includes(id));
  const step3Done = ['1-mpulse','1-mpulse-schedule','1-mpulse-checkin','1-mpulse-code','1-mpulse-news'].every(id => done.includes(id));
  // at least the explicit confluence tasks count as step 4 (user must click "Я ознакомился")
  const step4ExplicitDone = isTaskDone('1-confluence-read');

  // mobile accordion: auto-open first incomplete step, manual override sticks
  const [openStep, setOpenStep] = useState<number | null>(null);
  const effectiveOpen = openStep ?? (step1Done ? (step2Done ? (step3Done ? (step4ExplicitDone ? null : 4) : 3) : 2) : 1);
  const autoTimer = useRef<number | null>(null);
  const toggleStep = (n: number) => {
    // ручное переключение отменяет отложенный авто-переход
    if (autoTimer.current) { window.clearTimeout(autoTimer.current); autoTimer.current = null; }
    setOpenStep((cur) => {
      const eff = cur ?? (step1Done ? (step2Done ? (step3Done ? (step4ExplicitDone ? null : 4) : 3) : 2) : 1);
      return eff === n ? null : n;
    });
  };
  useEffect(() => () => { if (autoTimer.current) window.clearTimeout(autoTimer.current); }, []);

  // HR подтвердил пакет: тост +5 (2.5с) + конфетти.
  // Срабатывает только на свежее WS-событие (не для давно завершённого шага).
  const [doneToast, setDoneToast] = useState(false);
  const handledVerify = useRef<number | null>(null);
  const lastBurst = useRef(0);
  useEffect(() => {
    if (lastVerifiedAt === null || lastVerifiedTask === null) return;
    if (!DOC_IDS.includes(lastVerifiedTask)) return;
    if (handledVerify.current === lastVerifiedAt) return;
    handledVerify.current = lastVerifiedAt;
    setDoneToast(true);
    // batch даёт 5 событий подряд — конфетти один раз в 3с окно
    if (Date.now() - lastBurst.current > 3000) {
      lastBurst.current = Date.now();
      try {
        confetti({ particleCount: 45, spread: 70, origin: { y: 0.6 }, colors: ['#22C55E', '#3B82F6', '#FBBF24'], ticks: 120 });
      } catch { /* ignore */ }
    }
    window.setTimeout(() => setDoneToast(false), 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastVerifiedAt]);
  // Шаг 1 только что закрыт свежим HR-подтверждением — через 2с плавно уходим на шаг 2.
  // Ручной тап отменяет таймер (см. toggleStep).
  const prevStep1Done = useRef(step1Done);
  useEffect(() => {
    if (!prevStep1Done.current && step1Done && lastVerifiedAt !== null
        && Date.now() - lastVerifiedAt < 15000) {
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
      autoTimer.current = window.setTimeout(() => { setOpenStep(2); autoTimer.current = null; }, 2000);
    }
    prevStep1Done.current = step1Done;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step1Done]);

  // Confluence: считаем только видимые секунды после первого клика; стоп после подтверждения
  useEffect(() => {
    if (!confOpenedAt || step4ExplicitDone) return;
    const id = setInterval(() => {
      if (!document.hidden) setConfVisibleSec((v) => v + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [confOpenedAt, step4ExplicitDone]);

  // MAC отправлен? (сервер; отправка ≠ верификация — 1-wifi отмечает staff)
  useEffect(() => {
    api.get<{ mac_sent: boolean }>('/api/wifi-status')
      .then((s) => setMacSent(s.mac_sent))
      .catch(() => { /* не критично */ });
  }, []);

  const handleWifiSubmit = async () => {
    const v = mac.trim().toUpperCase();
    const re = /^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/;
    if (!re.test(v)) { setMacError('Введите MAC в формате AA:BB:CC:DD:EE:FF'); return; }
    setMacError(null);
    try {
      await api.post('/api/wifi-mac', { mac: v });
      setMacSent(true);
    } catch (e) {
      setMacError(e instanceof Error ? e.message : 'Ошибка отправки MAC');
    }
  };

  const handleWifiPassword = async () => {
    const p = wifiPass.trim();
    if (!p) { setWifiMsg('Введите пароль Wi-Fi от сетевиков'); return; }
    setWifiMsg(null);
    try {
      await api.post('/api/wifi-verify', { password: p });
      setWifiMsg('Пароль принят ✓ Wi-Fi подтверждён');
      await refreshMe();
    } catch (e) {
      setWifiMsg(e instanceof Error ? e.message : 'Неверный пароль');
    }
  };

  const handleMpulseVerify = async () => {
    const code = mpulseCode.trim();
    if (!code) { setMpulseMsg('Введите проверочный код из MPulse'); return; }
    setMpulseVerifying(true);
    setMpulseMsg(null);
    try {
      await api.post('/api/verify-mpulse-code', { code });
      setMpulseMsg('Код принят ✓ Доступ к MPulse подтверждён');
      await refreshMe();
    } catch (e) {
      setMpulseMsg(e instanceof Error ? e.message : 'Неверный код');
    } finally {
      setMpulseVerifying(false);
    }
  };

  const handleConfluenceLink = (pageId: string) => {
    const now = new Date().toISOString();
    if (!confOpenedAt) setConfOpenedAt(now);
    setConfClicked((prev) => (prev[pageId] ? prev : { ...prev, [pageId]: now }));
  };

  const handleConfluenceConfirm = async () => {
    if (confClickedCount < CONF_LINKS.length) { setConfMsg(`Откройте все ${CONF_LINKS.length} страниц (открыто ${confClickedCount})`); return; }
    if (!confOpenedAt) { setConfMsg('Сначала откройте страницы по ссылкам выше'); return; }
    setConfConfirming(true);
    setConfMsg(null);
    try {
      await api.post('/api/confirm-confluence', { opened_at: confOpenedAt, links_clicked: confClicked });
      try { localStorage.removeItem(cfKey); } catch { /* ignore */ }
      await refreshMe();
    } catch (e) {
      setConfMsg(e instanceof Error ? e.message : 'Подтвердить пока нельзя');
    } finally { setConfConfirming(false); }
  };

  return (
    <div className="stage-content s1-steps">
      {/* SLA banner */}
      <div className={`sla-banner ${sla.overdue && !step1Done && !step2Done ? 'overdue' : ''}`}>
        <span className="sla-icon">{sla.overdue ? <XCircle size={15} /> : <Clock size={15} />}</span>
        <span className="sla-text">
          {sla.overdue && (!step1Done || !step2Done || !step3Done || !step4ExplicitDone)
            ? 'SLA превышен: этап не выполнен в течение 1 недели с момента регистрации'
            : `SLA: 1 неделя с момента старта онбординга — ${sla.label}`}
        </span>
        {resolvedCreatedAt && <span className="sla-date">Старт: {new Date(resolvedCreatedAt).toLocaleDateString('ru-RU')}</span>}
      </div>

      {/* ── Шаг 1. Подписание документов — пакет целиком, физическая верификация HR ── */}
      <section className={`s1-step ${effectiveOpen === 1 ? 'open' : ''}`}>
        <StepHeader n={1} title="Подписание документов" reward="5 баллов" desc="HR выдала пакет офлайн · соберите всё и отправьте одной кнопкой" open={effectiveOpen === 1} done={step1Done} onToggle={() => toggleStep(1)} />
        {doneToast && (
          <div className="pkg-toast" role="status">
            <CheckCircle2 size={18} />
            <div>
              <b>HR подтвердил пакет документов</b>
              <span><Award size={12} style={{ verticalAlign: '-2px' }} /> +5 баллов начислено · переходим к шагу 2…</span>
            </div>
          </div>
        )}
        <div className="s1-step-body">
        <div className="pkg-card">
          <div className="pkg-head">
            <span className="pkg-ico"><FolderCheck size={20} /></span>
            <div>
              <div className="pkg-title">Пакет документов</div>
              <div className="pkg-sub">Подпишите всё из списка и отправьте на проверку одной кнопкой</div>
            </div>
          </div>
          <ul className="pkg-list">
            {DOCS_PACKAGE.map((d, i) => {
              const st = done.includes(d.id) ? 'done' : pending.includes(d.id) ? 'pending' : 'todo';
              const expanded = openDoc === d.id;
              return (
                <li key={d.id} className={`pkg-item ${st} ${expanded ? 'open' : ''}`}>
                  <button
                    type="button" className="pkg-item-row"
                    onClick={() => setOpenDoc(expanded ? null : d.id)}
                    aria-expanded={expanded} aria-label={`${d.title} — подробнее`}
                  >
                    <span className="pkg-item-ico"><d.Icon size={15} /></span>
                    <span className="pkg-item-body">
                      <b>{i + 1}. {d.title}</b>
                      <span>{d.sub}</span>
                    </span>
                    <span className="pkg-item-st">
                      {st === 'done' ? <CheckCircle2 size={16} /> : st === 'pending' ? <Clock size={15} /> : <span className="pkg-dot" />}
                    </span>
                    <ChevronDown size={15} className={`pkg-chev ${expanded ? 'open' : ''}`} />
                  </button>
                  {expanded && <div className="pkg-detail">{d.detail}</div>}
                </li>
              );
            })}
          </ul>
          {/* статус-сегмент */}
          {step1Done ? (
            <div className="pkg-status done">
              <CheckCircle2 size={20} />
              <div>
                <b>Выполнено — шаг 1 пройден</b>
                <span>Подтверждено HR · <Award size={12} style={{ verticalAlign: '-2px' }} /> +5 баллов начислено</span>
              </div>
            </div>
          ) : rejectedDocs.length ? (
            <div className="pkg-status rejected">
              <XCircle size={20} />
              <div>
                <b>HR отклонил(а) — нужно доделать</b>
                <span>Причина: {rejectedDocs[0].note}</span>
              </div>
              <button type="button" className="pkg-submit" onClick={submitDocs} disabled={sendingDocs}>
                <RotateCcw size={14} /> {sendingDocs ? 'Отправляем…' : 'Исправить и отправить снова'}
              </button>
            </div>
          ) : pendingDocs.length ? (
            <div className="pkg-status pending">
              <Hourglass size={20} className="spin-slow" />
              <div>
                <b>Ожидает проверки HR</b>
                <span>Пакет ({pendingDocs.length}/5) у HR на проверке — физически передайте документы, если ещё не передали</span>
              </div>
            </div>
          ) : (
            <button type="button" className="pkg-submit" onClick={submitDocs} disabled={sendingDocs}>
              <Send size={14} /> {sendingDocs ? 'Отправляем…' : 'Подписал документы, отправить на проверку HR'}
            </button>
          )}
          {reqMsg && <div className="wifi-err">{reqMsg}</div>}
        </div>
        </div>
      </section>

      {/* ── Шаг 2. Получение доступов ── */}
      <section className={`s1-step ${effectiveOpen === 2 ? 'open' : ''}`}>
        <StepHeader n={2} title="Получение доступов" reward="0 баллов" desc="Подтверждение staff (HR/лид/сисадмин) — сотрудник отмечает, staff верифицирует" open={effectiveOpen === 2} done={step2Done} onToggle={() => toggleStep(2)} />
        <div className="s1-step-body">
        <div className="step-grid">
          <DocCard k="mbusiness" doneFlag={isDone('mbusiness')} pendingFlag={isPending('mbusiness')} icon={<img src="/mbusiness-logo.png" alt="MBusiness" width={28} height={28} loading="lazy" decoding="async" style={{ objectFit: 'contain' }} />} title="MBusiness — открытие" sub="Выплаты 1–10 числа · поможет HR" onOpen={setOpen} />
          <DocCard k="accountant" doneFlag={isDone('accountant')} pendingFlag={isPending('accountant')} icon={<ClipboardCheck size={17} />} title="Доступ бухгалтеру" sub="Инструкция · как предоставить доступ" onOpen={setOpen} />
          <DocCard k="proxy" doneFlag={isDone('proxy')} pendingFlag={isPending('proxy')} icon={<KeyRound size={17} />} title="Прокси-карта и Face ID" sub="Пропуск на 1 этаж · коворкинг · Технопарк / MSpace · через лида/PM" onOpen={setOpen} />
          <DocCard k="telegram" doneFlag={isDone('telegram')} pendingFlag={isPending('telegram')} icon={<Send size={17} />} title="Доступ в Telegram-группы" sub="Авто-добавление · представьтесь команде" onOpen={setOpen} />
          <div className="doc-card wifi-card">
            <div className={`dc-icon ${isTaskDone('1-wifi') ? 'dc-done' : ''}`}>{isTaskDone('1-wifi') ? <CheckCircle2 size={16} /> : <Wifi size={16} />}</div>
            <div className="dc-body" style={{ flex: 1 }}>
              <div className="dc-title">Доступ к Wi-Fi (Закрытая сеть) {isTaskDone('1-wifi') && <span className="dc-badge">готово</span>}</div>
              <div className="dc-sub">Введите MAC-адрес ноутбука — отправим сетевикам, выдадим пароль</div>
              <div className="wifi-inline" onClick={e => e.stopPropagation()}>
                <input
                  className="wifi-input"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  value={mac}
                  onChange={e => setMac(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleWifiSubmit(); }}
                  aria-label="MAC-адрес"
                />
                <button type="button" className="wifi-btn" onClick={handleWifiSubmit} disabled={macSent}>
                  {macSent ? 'Отправлено ✓' : 'Отправить'}
                </button>
              </div>
              {macError && <div className="wifi-err">{macError}</div>}
              {macSent && !isTaskDone('1-wifi') && !macError && <div className="wifi-ok">MAC принят — ожидайте подтверждения staff, либо введите пароль ниже</div>}
              {isTaskDone('1-wifi') && !macError && <div className="wifi-ok">Wi-Fi подтверждён ✓</div>}
              <div className="wifi-inline" onClick={e => e.stopPropagation()}>
                <input
                  className="wifi-input"
                  placeholder="Пароль Wi-Fi"
                  type="password"
                  value={wifiPass}
                  onChange={e => setWifiPass(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleWifiPassword(); }}
                  aria-label="Пароль Wi-Fi"
                />
                <button type="button" className="wifi-btn" onClick={handleWifiPassword}>Проверить</button>
              </div>
              {wifiMsg && <div className={wifiMsg.includes('✓') ? 'wifi-ok' : 'wifi-err'}>{wifiMsg}</div>}
              <button type="button" className="wifi-help-link" onClick={() => setOpen('wifi')}>Подробнее <ChevronRight size={12} style={{ verticalAlign: '-2px' }} /></button>
            </div>
          </div>
        </div>
        </div>
        {step2Done && <div className="step-done-badge">Шаг 2 выполнен ✓ (0 баллов)</div>}
      </section>

      {/* ── Шаг 3. Корпоративное приложение MPulse ── */}
      <section className={`s1-step mpulse-step ${effectiveOpen === 3 ? 'open' : ''}`}>
        <StepHeader n={3} title="Корпоративное приложение MPulse" reward="5 баллов" desc="AD · выбор графика · check-in/out · формат работы · новости" open={effectiveOpen === 3} done={step3Done} onToggle={() => toggleStep(3)} />
        <div className="s1-step-body">
        <div className="mpulse-card">
          <div className="mpulse-head">
            <img src="/mpulse-logo.png" alt="MPulse" loading="lazy" decoding="async" className="mpulse-icon-img" />
            <div>
              <div className="mpulse-title">MPulse — корпоративное приложение</div>
              <div className="mpulse-sub">Авторизация через корпоративный Active Directory (AD) · обязательный выбор рабочего графика (согласованного с руководителем)</div>
            </div>
          </div>
          <ul className="mpulse-list">
            <li>Ежедневный <b>check-in / check-out</b></li>
            <li>Выбор формата работы</li>
            <li>Корпоративные новости и уведомления</li>
          </ul>
          <div className="mpulse-links">
            <a href="https://play.google.com/store/search?q=MPulse&c=apps" target="_blank" rel="noopener noreferrer" className="mpulse-dl google">Google Play — Скачать MPulse</a>
            <a href="https://apps.apple.com/search?term=MPulse" target="_blank" rel="noopener noreferrer" className="mpulse-dl apple">App Store — Скачать MPulse</a>
          </div>
          <div className="mpulse-verify">
            <div className="mpulse-verify-title">Верификация — введите проверочный код из MPulse</div>
            <div className="mpulse-verify-sub">После регистрации в MPulse вы увидите специальный код (одинаковый для всех). Введите его здесь, чтобы система зачла выполнение.</div>
            <div className="mpulse-row">
              <input
                className="mpulse-input"
                placeholder="Например: MPULSE-2026"
                value={mpulseCode}
                onChange={e => setMpulseCode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleMpulseVerify(); }}
                aria-label="Проверочный код MPulse"
              />
              <button type="button" className="mpulse-btn" onClick={handleMpulseVerify} disabled={mpulseVerifying}>
                {mpulseVerifying ? 'Проверка…' : isTaskDone('1-mpulse-code') ? 'Подтверждено ✓' : 'Подтвердить код'}
              </button>
            </div>
            {mpulseMsg && <div className={`mpulse-msg ${mpulseMsg.includes('✓') ? 'ok' : 'err'}`}>{mpulseMsg}</div>}
            <div className="mpulse-tasks">
              {[
                { id: '1-mpulse', label: 'Установка и авторизация через AD' },
                { id: '1-mpulse-schedule', label: 'Выбор рабочего графика' },
                { id: '1-mpulse-checkin', label: 'Daily check-in / check-out' },
                { id: '1-mpulse-code', label: 'Ввод проверочного кода' },
                { id: '1-mpulse-news', label: 'Новости и уведомления' },
              ].map(t => (
                <label key={t.id} className={`mtask ro ${isTaskDone(t.id) ? 'done' : ''}`} title="Закрывается кодом MPulse, не галочкой">
                  <input type="checkbox" checked={isTaskDone(t.id)} readOnly />
                  <span className="mtask-box">{isTaskDone(t.id) ? '✓' : ''}</span>
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        </div>
        {step3Done && <div className="step-done-badge">Шаг 3 выполнен ✓ +5 баллов</div>}
      </section>

      {/* ── Шаг 4. База знаний Confluence ── */}
      <section className={`s1-step ${effectiveOpen === 4 ? 'open' : ''}`}>
        <StepHeader n={4} title="База знаний Confluence" reward="10 баллов" desc="Откройте все 5 страниц · читайте 2 мин с открытой вкладкой · нажмите «Я ознакомился(-ась)»" open={effectiveOpen === 4} done={step4ExplicitDone} onToggle={() => toggleStep(4)} />
        <div className="s1-step-body">
        <div className="cf-links">
          {CONF_LINKS.map((l) => {
            const seen = Boolean(confClicked[l.pageId]);
            return (
              <a key={l.pageId} href={l.url} target="_blank" rel="noopener noreferrer" className={`confluence-link ${seen ? 'seen' : ''}`} onClick={() => handleConfluenceLink(l.pageId)}>
                <span className="cf-icon">{seen ? '✓' : 'CF'}</span>
                <span className="cf-body">
                  <span className="cf-title">{l.title}</span>
                  <span className="cf-sub">confluence.mdigital.kg · {seen ? 'открыта ✓' : 'нажмите чтобы открыть'}</span>
                </span>
            <span className="cf-arrow"><ChevronRight size={18} /></span>
          </a>
            );
          })}
        </div>
        <div className="cf-progress">Открыто {confClickedCount}/{CONF_LINKS.length} · видимое чтение {Math.floor(confVisibleSec / 60)}:{String(confVisibleSec % 60).padStart(2, '0')} / 2:00</div>
        <button type="button" className={`cf-confirm ${step4ExplicitDone ? 'done' : ''}`} onClick={handleConfluenceConfirm} disabled={confConfirming || step4ExplicitDone || !confReady}>
          {confConfirming ? 'Фиксируем…' : step4ExplicitDone ? 'Ознакомление зафиксировано ✓' : confReady ? 'Я ознакомился(-ась)' : `Откройте все страницы и читайте (${confClickedCount}/${CONF_LINKS.length}, ${Math.floor(confRemain / 60)}:${String(confRemain % 60).padStart(2, '0')})`}
        </button>
        {confMsg && <div className="wifi-err">{confMsg}</div>}
        <div className="cf-hint">Таймер идёт только пока вкладка открыта — свернули, поставили на паузу</div>
        </div>
        {step4ExplicitDone && <div className="step-done-badge">Шаг 4 выполнен ✓ +10 баллов</div>}
      </section>

      <div className="doc-hint font-orbitron">Открой каждый документ и пролистай до конца — иначе не подтвердится. HR верификация шага 1 обязательна.</div>

      {/* modals (документы шага 1 убраны — пакет отправляется одной кнопкой, без модалок) */}
      <DocumentModal kind="mbusiness" open={open === 'mbusiness'} onClose={() => setOpen(null)} alreadyDone={isDone('mbusiness')} onConfirm={() => handleConfirm('mbusiness')} />
      <DocumentModal kind="accountant" open={open === 'accountant'} onClose={() => setOpen(null)} alreadyDone={isDone('accountant')} onConfirm={() => handleConfirm('accountant')} />
      <DocumentModal kind="wifi" open={open === 'wifi'} onClose={() => setOpen(null)} alreadyDone={isDone('wifi')} onConfirm={() => handleConfirm('wifi')} />
      <DocumentModal kind="proxy" open={open === 'proxy'} onClose={() => setOpen(null)} alreadyDone={isDone('proxy')} onConfirm={() => handleConfirm('proxy')} />
      <DocumentModal kind="telegram" open={open === 'telegram'} onClose={() => setOpen(null)} alreadyDone={isDone('telegram')} onConfirm={() => handleConfirm('telegram')} />

      <style>{`
        .stage-content.s1-steps{ display:flex; flex-direction:column; gap:16px; margin-bottom:6px; font-family:'Open Sans',sans-serif }
        .stage-content .font-orbitron{ font-family:'Open Sans',sans-serif !important }
        .sla-banner{ display:flex; align-items:center; gap:8px; padding:10px 12px; border-radius:10px; font-size:11.5px; line-height:1.4; border:1px solid rgba(96,165,250,.22); background:rgba(59,130,246,.08); color:#BFDBFE; flex-wrap:wrap }
        .sla-banner.overdue{ background:rgba(239,68,68,.10); border-color:rgba(239,68,68,.35); color:#FECACA; animation:slaPulse 1.6s ease-in-out infinite }
        @keyframes slaPulse{ 0%,100%{ box-shadow:0 0 0 0 rgba(239,68,68,.18)} 50%{ box-shadow:0 0 0 6px rgba(239,68,68,0)} }
        .sla-icon{ font-size:14px }
        .sla-date{ margin-left:auto; font-size:10.5px; opacity:.85; color:var(--muted) }
        .s1-step{ display:flex; flex-direction:column; gap:10px; padding:14px 12px; border-radius:14px; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.06) }
        .s1-step-body{ display:flex; flex-direction:column; gap:10px; }
        .step-head.clickable{ cursor:pointer; }
        /* пакет документов шага 1 */
        .pkg-card{ display:flex; flex-direction:column; gap:12px; padding:14px; border-radius:12px; background:rgba(37,99,235,.05); border:1px solid rgba(59,130,246,.18); }
        .pkg-head{ display:flex; gap:12px; align-items:flex-start; }
        .pkg-ico{ width:44px; height:44px; border-radius:11px; display:grid; place-items:center; flex-shrink:0; color:#fff; background:linear-gradient(135deg,#1E3A8A,#2563EB); }
        .pkg-title{ font-size:13.5px; font-weight:800; color:var(--text); }
        .pkg-sub{ font-size:11.5px; color:var(--muted); margin-top:4px; line-height:1.45; }
        .pkg-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:7px; }
        .pkg-item{ display:flex; flex-direction:column; gap:0; padding:0; border-radius:9px; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.06); overflow:hidden; }
        .pkg-item-row{ display:flex; align-items:center; gap:10px; width:100%; padding:9px 11px; background:none; border:none; color:inherit; cursor:pointer; text-align:left; font:inherit; }
        .pkg-detail{ font-size:11px; color:var(--muted); line-height:1.6; padding:2px 11px 10px 51px; border-top:1px dashed rgba(255,255,255,.07); margin-top:2px; padding-top:8px; }
        .pkg-chev{ color:#60A5FA; transition:transform .2s ease; flex-shrink:0; }
        .pkg-chev.open{ transform:rotate(180deg); }
        .pkg-item.done{ border-color:rgba(34,197,94,.3); }
        .pkg-item.pending{ border-style:dashed; border-color:rgba(251,191,36,.35); }
        .pkg-item-ico{ width:30px; height:30px; border-radius:8px; display:grid; place-items:center; flex-shrink:0; background:rgba(59,130,246,.1); border:1px solid rgba(59,130,246,.25); color:#93C5FD; }
        .pkg-item.done .pkg-item-ico{ background:rgba(34,197,94,.14); border-color:rgba(34,197,94,.35); color:#86EFAC; }
        .pkg-item-body{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
        .pkg-item-body b{ font-size:12.5px; color:var(--text); }
        .pkg-item-body span{ font-size:11px; color:var(--muted); }
        .pkg-item-st{ color:#86EFAC; display:grid; place-items:center; flex-shrink:0; }
        .pkg-item.pending .pkg-item-st{ color:#FBBF24; }
        .pkg-dot{ width:9px; height:9px; border-radius:50%; border:1.5px solid rgba(147,197,253,.45); }
        .pkg-status{ display:flex; gap:10px; align-items:flex-start; padding:11px 12px; border-radius:10px; font-size:12px; line-height:1.5; }
        .pkg-status b{ display:block; font-size:12.5px; }
        .pkg-status span{ color:var(--muted); font-size:11.5px; }
        .pkg-status.done{ background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.3); color:#86EFAC; }
        .pkg-status.done span{ color:#86EFAC; opacity:.85; }
        .pkg-status.pending{ background:rgba(251,191,36,.07); border:1px dashed rgba(251,191,36,.35); color:#FDE68A; }
        .pkg-status.pending span{ color:#FDE68A; opacity:.85; }
        .pkg-status.rejected{ background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.35); color:#FCA5A5; flex-wrap:wrap; }
        .pkg-status.rejected span{ color:#FCA5A5; opacity:.9; }
        .pkg-submit{ display:inline-flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:12px 16px; border-radius:10px; border:none; cursor:pointer; font-size:12px; font-weight:800; letter-spacing:.04em; font-family:'Open Sans',sans-serif; background:linear-gradient(90deg,#1E3A8A,#2563EB); color:#fff; }
        .pkg-submit:hover:not(:disabled){ filter:brightness(1.08); }
        .pkg-submit:disabled{ opacity:.6; cursor:wait; }
        .pkg-status.rejected .pkg-submit{ margin-top:4px; }
        .spin-slow{ animation:spinSlow 2.4s linear infinite; }
        @keyframes spinSlow{ to{ transform:rotate(360deg) } }
        .sh-chevron{ margin-left:auto; color:#60A5FA; font-size:16px; line-height:1; transition:transform .2s ease; flex-shrink:0; display:none; }
        /* mobile accordion ≤640px: плавное раскрытие вместо резкого open/close */
        @media (max-width:640px){
          .s1-step-body{ display:none; }
          .s1-step.open .s1-step-body{ display:flex; animation:stepIn .32s cubic-bezier(.16,1,.3,1); }
          .sh-chevron{ display:block; transition:transform .35s cubic-bezier(.16,1,.3,1); transform-origin:center; }
          .s1-step.open .sh-chevron{ transform:rotate(180deg); }
          .s1-step{ padding:12px 10px; }
        }
        @keyframes stepIn{ from{ opacity:0; transform:translateY(-8px); } to{ opacity:1; transform:none; } }
        /* тост завершения шага */
        .pkg-toast{
          display:flex; gap:10px; align-items:flex-start; padding:11px 12px; border-radius:10px;
          background:rgba(34,197,94,.12); border:1px solid rgba(34,197,94,.4); color:#86EFAC;
          animation:stepIn .3s cubic-bezier(.16,1,.3,1);
        }
        .pkg-toast b{ display:block; font-size:12.5px; color:#fff; }
        .pkg-toast span{ font-size:11.5px; opacity:.9; }
        @media (min-width:641px){
          .s1-step-body{ display:flex !important; }
        }
        /* 320px: инпуты в столбик, не сжимаются */
        @media (max-width:360px){
          .wifi-inline, .mpulse-row{ flex-wrap:wrap; }
          .wifi-input, .mpulse-input{ flex:1 1 100%; }
          .wifi-btn, .mpulse-btn{ flex:1 1 100%; }
          .s1-step{ padding:10px 8px; }
        }
        .step-head{ display:flex; gap:10px; align-items:flex-start }
        .sh-num{ width:32px; height:32px; border-radius:9px; display:grid; place-items:center; flex-shrink:0; font-size:13px; font-weight:800; color:#fff; background:linear-gradient(135deg,#1E3A8A,#2563EB); box-shadow:0 4px 14px rgba(37,99,235,.35) }
        .sh-title{ font-size:13.5px; font-weight:800; color:var(--text); display:flex; align-items:center; gap:8px; flex-wrap:wrap }
        .sh-reward{ font-size:10px; letter-spacing:.10em; text-transform:uppercase; padding:2px 7px; border-radius:999px; background:rgba(251,191,36,.12); border:1px solid rgba(251,191,36,.28); color:#FBBF24 }
        .sh-desc{ font-size:11.5px; color:var(--muted); margin-top:4px; line-height:1.45 }
        .hr-note{ display:flex; gap:8px; padding:9px 11px; border-radius:10px; background:rgba(245,158,11,.08); border:1px dashed rgba(245,158,11,.30); color:#FDE68A; font-size:11.5px; line-height:1.5 }
        .hr-dot{ width:7px; height:7px; border-radius:50%; background:#F59E0B; margin-top:6px; flex-shrink:0; box-shadow:0 0 8px rgba(245,158,11,.6) }
        .step-grid{ display:flex; flex-direction:column; gap:9px }
        .legacy-row{ display:flex; flex-direction:column; gap:9px; margin-top:2px; padding-top:10px; border-top:1px dashed rgba(255,255,255,.07) }
        .doc-card{ display:flex; align-items:center; gap:12px; padding:11px 13px; width:100%; text-align:left; background:rgba(255,255,255,.02); border:1px solid var(--border); border-radius:11px; cursor:pointer; transition:background .15s, border-color .15s, transform .12s }
        .doc-card:hover{ background:rgba(59,130,246,.06); border-color:rgba(59,130,246,.28); transform:translateY(-1px) }
        .doc-card.done{ background:rgba(96,165,250,.06); border-color:rgba(96,165,250,.24) }
        .dc-icon, .dc-avatar{ width:36px; height:36px; border-radius:9px; background:rgba(59,130,246,.08); border:1px solid rgba(59,130,246,.25); display:grid; place-items:center; font-size:15px; flex-shrink:0 }
        .dc-icon.mplus{ background:linear-gradient(135deg,#2563EB,#2563EB); color:#fff; font-family:'Open Sans',sans-serif; font-size:12px; font-weight:700; border:none }
        .dc-icon.dc-done{ background:rgba(96,165,250,.18); border-color:rgba(96,165,250,.35); color:#60A5FA }
        .dc-body{ flex:1; min-width:0 }
        .dc-title{ font-family:'Open Sans',sans-serif; font-size:13.5px; color:var(--text); font-weight:700; display:flex; align-items:center; gap:8px; flex-wrap:wrap }
        .dc-badge{ font-size:9px; letter-spacing:.14em; padding:2px 6px; border-radius:999px; background:rgba(96,165,250,.14); border:1px solid rgba(96,165,250,.3); color:#60A5FA; font-family:'Open Sans',sans-serif; text-transform:uppercase }
        .dc-badge.pending{ background:rgba(251,191,36,.12); border-color:rgba(251,191,36,.35); color:#FBBF24; }
        .doc-card.pending{ border-style:dashed; border-color:rgba(251,191,36,.3); }
        .mtask.ro{ cursor:default; }
        .dc-sub{ font-family:'Open Sans',sans-serif; font-size:11.5px; color:var(--muted); margin-top:2px; line-height:1.4 }
        .dc-chevron{ width:18px; height:18px; display:grid; place-items:center; flex-shrink:0; color:rgba(96,165,250,.72); transition: transform .18s ease, color .18s ease, filter .18s ease, opacity .18s ease }
        .dc-chevron svg{ width:14px; height:14px }
        .doc-card:hover .dc-chevron{ color:#DBEAFE; transform:translateX(2px); filter:drop-shadow(0 0 6px rgba(37,99,235,.45)) }
        .doc-card.done .dc-chevron{ opacity:.42 }
        .wifi-card{ cursor:default }
        .wifi-card:hover{ transform:none }
        .wifi-inline{ display:flex; gap:8px; margin-top:8px; align-items:center }
        .wifi-input, .mpulse-input{ flex:1; min-width:0; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,.10); background:rgba(0,0,0,.22); color:var(--text); font-size:12.5px; font-family:'Open Sans',sans-serif; outline:none }
        .wifi-input:focus, .mpulse-input:focus{ border-color:rgba(59,130,246,.45); box-shadow:0 0 0 3px rgba(59,130,246,.18) }
        .wifi-btn, .mpulse-btn, .cf-confirm{ padding:8px 14px; border-radius:8px; border:none; cursor:pointer; font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; font-family:'Open Sans',sans-serif; background:linear-gradient(90deg,#1E3A8A,#2563EB); color:#fff; flex-shrink:0; transition:filter .15s, opacity .15s }
        .wifi-btn:hover, .mpulse-btn:hover, .cf-confirm:hover{ filter:brightness(1.08) }
        .wifi-btn:disabled, .mpulse-btn:disabled, .cf-confirm:disabled{ opacity:.55; cursor:not-allowed }
        .wifi-err{ margin-top:6px; font-size:11px; color:#FCA5A5 }
        .wifi-ok{ margin-top:6px; font-size:11px; color:#86EFAC }
        .wifi-help-link{ margin-top:6px; background:none; border:none; color:#60A5FA; font-size:11px; cursor:pointer; padding:0; text-decoration:underline; text-underline-offset:2px }
        .mpulse-step .mpulse-card{ display:flex; flex-direction:column; gap:12px; padding:14px; border-radius:12px; background:rgba(37,99,235,.06); border:1px solid rgba(59,130,246,.18) }
        .mpulse-head{ display:flex; gap:12px; align-items:flex-start }
        .mpulse-icon{ width:44px; height:44px; border-radius:11px; display:grid; place-items:center; flex-shrink:0; font-size:14px; font-weight:800; color:#fff; background:linear-gradient(135deg,#1E3A8A,#2563EB) }
        .mpulse-icon-img{ width:44px; height:44px; border-radius:11px; object-fit:contain; flex-shrink:0; background:rgba(255,255,255,.06); border:1px solid rgba(59,130,246,.18) }
        .mpulse-title{ font-size:13.5px; font-weight:800; color:var(--text) }
        .mpulse-sub{ font-size:11.5px; color:var(--muted); margin-top:4px; line-height:1.45 }
        .mpulse-list{ margin:0; padding-left:18px; font-size:12px; color:var(--muted); line-height:1.6 }
        .mpulse-list b{ color:var(--text) }
        .mpulse-links{ display:flex; gap:8px; flex-wrap:wrap }
        .mpulse-dl{ display:inline-flex; align-items:center; gap:6px; padding:9px 14px; border-radius:999px; font-size:11px; font-weight:700; text-decoration:none; color:#fff }
        .mpulse-dl.google{ background:#01875f } .mpulse-dl.apple{ background:#000 }
        .mpulse-verify{ padding:12px; border-radius:10px; background:rgba(0,0,0,.18); border:1px solid rgba(255,255,255,.06); display:flex; flex-direction:column; gap:8px }
        .mpulse-verify-title{ font-size:12px; font-weight:800; color:var(--text) }
        .mpulse-verify-sub{ font-size:11.5px; color:var(--muted); line-height:1.45 }
        .mpulse-row{ display:flex; gap:8px; align-items:center }
        .mpulse-msg{ font-size:11.5px; padding:7px 10px; border-radius:8px }
        .mpulse-msg.ok{ background:rgba(34,197,94,.10); border:1px solid rgba(34,197,94,.25); color:#86EFAC }
        .mpulse-msg.err{ background:rgba(239,68,68,.10); border:1px solid rgba(239,68,68,.25); color:#FCA5A5 }
        .mtask{ display:flex; align-items:center; gap:9px; padding:7px 10px; border-radius:8px; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.06); font-size:12.5px; color:var(--text); cursor:pointer }
        .mtask.done{ color:var(--muted); border-color:rgba(96,165,250,.18) }
        .mtask input{ display:none }
        .mtask-box{ width:18px; height:18px; border-radius:5px; border:1.5px solid rgba(147,197,253,.45); display:grid; place-items:center; font-size:11px; color:#fff; flex-shrink:0 }
        .mtask.done .mtask-box{ background:#2563EB; border-color:#2563EB }
        .mpulse-tasks, .cf-tasks{ display:flex; flex-direction:column; gap:7px; margin-top:6px }
        .confluence-link{ display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:11px; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.08); text-decoration:none; color:inherit; transition:background .15s, border-color .15s }
        .confluence-link:hover{ background:rgba(59,130,246,.06); border-color:rgba(59,130,246,.22) }
        .cf-links{ display:flex; flex-direction:column; gap:8px; }
        .confluence-link.seen{ border-color:rgba(34,197,94,.3); }
        .confluence-link.seen .cf-icon{ background:rgba(34,197,94,.14); border-color:rgba(34,197,94,.35); color:#86EFAC; }
        .cf-progress{ font-size:11px; color:var(--muted); font-variant-numeric:tabular-nums; }
        .cf-icon{ width:36px; height:36px; border-radius:9px; display:grid; place-items:center; font-size:11px; font-weight:800; background:rgba(59,130,246,.12); border:1px solid rgba(59,130,246,.25); color:#60A5FA }
        .cf-title{ font-size:13.5px; font-weight:800; color:var(--text) }
        .cf-sub{ font-size:11.5px; color:var(--muted) }
        .cf-arrow{ margin-left:auto; color:#60A5FA; font-size:16px }
        .cf-list{ margin:8px 0 0; padding-left:18px; font-size:12px; color:var(--muted); line-height:1.6 }
        .cf-confirm{ width:100%; padding:11px 16px; border-radius:10px; margin-top:10px; font-size:12px }
        .cf-confirm.done{ background:rgba(34,197,94,.18); border:1px solid rgba(34,197,94,.35); color:#86EFAC }
        .cf-hint{ font-size:10.5px; color:var(--dim); text-align:center; margin-top:6px }
        .step-done-badge{ padding:8px 12px; border-radius:999px; text-align:center; font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; background:rgba(34,197,94,.12); border:1px solid rgba(34,197,94,.28); color:#86EFAC }
        .doc-hint{ font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--dim); text-align:center; padding:8px 10px; border:1px dashed rgba(255,255,255,.08); border-radius:8px; margin-top:2px }
      `}</style>
    </div>
  );
}

