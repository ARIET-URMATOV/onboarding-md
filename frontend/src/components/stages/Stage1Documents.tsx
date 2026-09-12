import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, BadgeCheck, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Clock, FileCheck,
  FileText, FolderCheck, Hourglass, IdCard, KeyRound, RotateCcw, Send, ShieldCheck, Wifi, XCircle,
  Link as LinkIcon, Smartphone, Apple, BookOpen, Globe, Lock, MessageSquare, ExternalLink, Download,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { StageId } from '../../data/stages';
import { useOnboarding } from '../../store/useOnboarding';
import { DocumentModal, type DocKind } from './DocumentModal';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../api/client';
import { useServices } from '../../hooks/useServices';
import { ServiceModal } from './ServiceModal';

interface Props { stageId: StageId }

type DocKey = Exclude<DocKind, 'docs' | 'lead' | 'mplus' | 'jira' | 'confluence'>;
const docToTask: Record<DocKey, string> = {
  dogovor: '1-dogovor', nda: '1-nda', pdp: '1-pdp', ip: '1-ip', sn: '1-sn',
  mbusiness: '1-mbusiness', accountant: '1-accountant', wifi: '1-wifi', proxy: '1-proxy', telegram: '1-telegram',
};

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

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Link: LinkIcon, ClipboardCheck, KeyRound, Send, Smartphone, Apple,
  BookOpen, Globe, Lock, Wifi, FileText, Users: () => null,
  Hash: () => null, MessageSquare, ExternalLink, Download,
};
function ServiceIcon({ icon_key, size = 16 }: { icon_key: string; size?: number }) {
  const Ico = ICON_MAP[icon_key] ?? LinkIcon;
  return <Ico size={size} />;
}

export function Stage1Documents({ stageId }: Props) {
  const done = useOnboarding((s) => s.doneTasks[stageId] || []);
  const pending = useOnboarding((s) => s.pending);
  const requestTask = useOnboarding((s) => s.requestTask);
  const refreshMe = useOnboarding((s) => s.refreshMe);
  const connectLive = useOnboarding((s) => s.connectLive);
  const createdAt = useOnboarding((s) => s.createdAt);
  const user = useOnboarding((s) => s.user);
  const myRole = useOnboarding((s) => s.role);
  const resolvedCreatedAt = (user as unknown as { createdAt?: string | null })?.createdAt ?? createdAt ?? null;
  const toast = useToast();

  const [open, setOpen] = useState<DocKind | null>(null);
  const [openInfo, setOpenInfo] = useState<{ title: string; sub?: string; body: string } | null>(null);

  // Services from DB
  const { services } = useServices();
  const accessServices = useMemo(() => services.filter((s) => s.category === 'access'), [services]);
  const mpulseServices = useMemo(() => services.filter((s) => s.category === 'mpulse'), [services]);
  const knowledgeServices = useMemo(() => services.filter((s) => s.category === 'knowledge'), [services]);
  const confluencePageIds = useMemo(() =>
    knowledgeServices.map((s) => s.extra.pageId).filter(Boolean),
    [knowledgeServices],
  );
  const confTotal = confluencePageIds.length;

  // Wi-Fi
  const [mac, setMac] = useState('');
  const [macSent, setMacSent] = useState(false);
  const [macError, setMacError] = useState<string | null>(null);
  const [wifiMsg, setWifiMsg] = useState<string | null>(null);
  const [wifiShownPw, setWifiShownPw] = useState<string | null>(null);
  const [wifiShowPw, setWifiShowPw] = useState(false);

  // MPulse code
  const [mpulseCode, setMpulseCode] = useState('');
  const [mpulseVerifying, setMpulseVerifying] = useState(false);
  const [mpulseMsg, setMpulseMsg] = useState<string | null>(null);

  // Confluence: dynamic from DB
  const CONF_MIN_SECONDS = 120;
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
  const confReady = confClickedCount >= confTotal && confRemain <= 0;

  const isDone = (k: DocKey) => done.includes(docToTask[k]);
  const isTaskDone = (taskId: string) => done.includes(taskId);
  const rejNote = (taskId: string) => rejected.find((r) => r.task_id === taskId)?.note ?? null;
  const [reqMsg, setReqMsg] = useState<string | null>(null);

  // Step 1
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

  useEffect(() => { connectLive(); }, [connectLive]);

  const prevRejectedCount = useRef(rejected.length);
  useEffect(() => {
    if (rejected.length > prevRejectedCount.current) {
      const fresh = rejected[rejected.length - 1];
      if (fresh) toast.error(`HR отклонил: ${fresh.task_id}`, fresh.note || 'Доделайте и отправьте снова');
    }
    prevRejectedCount.current = rejected.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejected]);

  const handleConfirm = (k: DocKey) => {
    if (isDone(k) || pending.includes(docToTask[k])) return;
    setReqMsg(null);
    requestTask(docToTask[k]).catch((e) => {
      setReqMsg(e instanceof Error ? e.message : 'Не удалось отправить запрос');
    });
  };

  // SLA
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
  const STEP2_IDS = ['1-mbusiness','1-accountant','1-wifi','1-proxy','1-telegram','1-jira','1-figma','1-gitlab'];
  const step2Done = STEP2_IDS.every(id => done.includes(id));
  const step3Done = ['1-mpulse','1-mpulse-schedule','1-mpulse-checkin','1-mpulse-code','1-mpulse-news'].every(id => done.includes(id));
  const step4ExplicitDone = isTaskDone('1-confluence-read');

  const [openStep, setOpenStep] = useState<number | null>(null);
  const effectiveOpen = openStep ?? (step1Done ? (step2Done ? (step3Done ? (step4ExplicitDone ? null : 4) : 3) : 2) : 1);
  const autoTimer = useRef<number | null>(null);
  const toggleStep = (n: number) => {
    if (autoTimer.current) { window.clearTimeout(autoTimer.current); autoTimer.current = null; }
    setOpenStep((cur) => {
      const eff = cur ?? (step1Done ? (step2Done ? (step3Done ? (step4ExplicitDone ? null : 4) : 3) : 2) : 1);
      return eff === n ? null : n;
    });
  };
  useEffect(() => () => { if (autoTimer.current) window.clearTimeout(autoTimer.current); }, []);

  const consumeVerified = useOnboarding((s) => s.consumeVerified);
  const lastBurst = useRef(0);
  useEffect(() => {
    if (lastVerifiedAt === null || lastVerifiedTask === null) return;
    if (!DOC_IDS.includes(lastVerifiedTask)) return;
    if (Date.now() - lastVerifiedAt > 10000) { consumeVerified(); return; }
    consumeVerified();
    toast.success('HR подтвердил пакет документов', '+5 баллов начислено');
    if (Date.now() - lastBurst.current > 3000) {
      lastBurst.current = Date.now();
      try { confetti({ particleCount: 45, spread: 70, origin: { y: 0.6 }, colors: ['#22C55E', '#3B82F6', '#FBBF24'], ticks: 120 }); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastVerifiedAt]);
  const prevStep1Done = useRef(step1Done);
  useEffect(() => {
    if (!prevStep1Done.current && step1Done && lastVerifiedAt !== null && Date.now() - lastVerifiedAt < 15000) {
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
      autoTimer.current = window.setTimeout(() => { setOpenStep(2); autoTimer.current = null; }, 2000);
    }
    prevStep1Done.current = step1Done;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step1Done]);

  useEffect(() => {
    if (!confOpenedAt || step4ExplicitDone) return;
    const id = setInterval(() => { if (!document.hidden) setConfVisibleSec((v) => v + 1); }, 1000);
    return () => clearInterval(id);
  }, [confOpenedAt, step4ExplicitDone]);

  useEffect(() => {
    api.get<{ mac_sent: boolean }>('/api/wifi-status')
      .then((s) => setMacSent(s.mac_sent))
      .catch(() => { /* ignore */ });
    api.get<{ password: string | null }>('/api/wifi-password')
      .then((r) => { if (r.password) { setWifiShownPw(r.password); setMacSent(true); } })
      .catch(() => { /* ignore */ });
  }, []);

  // Telegram
  const userName = user?.name ?? '';
  const [tgHandle, setTgHandle] = useState('');
  const [tgHandleError, setTgHandleError] = useState<string | null>(null);
  const [tgGroups, setTgGroups] = useState<{ title: string; chat_id: string }[]>([]);
  const [tgAdded, setTgAdded] = useState<string[]>([]);
  const [tgFailed, setTgFailed] = useState<Record<string, string>>({});
  const [tgAdding, setTgAdding] = useState(false);
  const [tgGreet, setTgGreet] = useState('');
  const [tgMsg, setTgMsg] = useState<string | null>(null);
  const [tgInvites, setTgInvites] = useState<{ title: string; url: string }[]>([]);
  const loadTgGroups = () => {
    api.get<{ groups: { title: string; chat_id: string }[] }>('/api/integrations/telegram-groups')
      .then((r) => setTgGroups(r.groups))
      .catch(() => { /* ignore */ });
  };
  useEffect(() => {
    api.get<{ telegram_username?: string }>('/api/me')
      .then((me: unknown) => {
        const u = (me as { user?: { telegram_username?: string; name?: string } }).user;
        if (u?.telegram_username) setTgHandle(u.telegram_username);
      })
      .catch(() => { /* ignore */ });
    loadTgGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRole, user?.email]);
  useEffect(() => {
    if (!tgGreet) setTgGreet(`Привет! Я ${userName || 'новый сотрудник'}. Присоединился к команде. Рад познакомиться!`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]);

  const handleTgAutoAdd = async () => {
    const v = tgHandle.trim();
    if (!/^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v)) { setTgHandleError('Формат: @ivan_99 (латиница, 5–32 символа)'); return; }
    setTgHandleError(null);
    setTgAdding(true);
    setTgMsg(null);
    try {
      await api.patch('/api/profile', { telegram_username: v });
      const r = await api.post<{ added: string[]; failed: { title: string; reason: string }[]; invite_links?: { title: string; url: string }[]; verified?: boolean }>('/api/integrations/telegram-auto-add');
      setTgAdded(r.added);
      const f: Record<string, string> = {};
      for (const x of r.failed) f[x.title] = x.reason;
      setTgFailed(f);
      setTgInvites(r.invite_links ?? []);
      await refreshMe();
      loadTgGroups();
      if (r.failed.length === 0) {
        setTgMsg(`Вы добавлены в группы ✓ (${r.added.length}) — не забудьте представиться команде`);
        toast.success('Telegram: вы добавлены в группы', 'Этап зачтён автоматически');
      } else {
        setTgMsg(`Добавлен: ${r.added.length}, не вышло: ${r.failed.length} — см. причины выше`);
      }
    } catch (e) {
      setTgMsg(e instanceof Error ? e.message : 'Не удалось добавить');
    } finally {
      setTgAdding(false);
    }
  };

  const handleTgCopy = async () => {
    try {
      await navigator.clipboard.writeText(tgGreet);
      setTgMsg('Шаблон скопирован — вставьте в группу ✓');
    } catch {
      setTgMsg('Не удалось скопировать — выделите текст вручную');
    }
  };

  const handleWifiSubmit = async () => {
    const v = mac.trim().toUpperCase();
    const re = /^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/;
    if (!re.test(v)) { setMacError('Введите MAC в формате AA:BB:CC:DD:EE:FF'); return; }
    setMacError(null);
    try {
      await api.post('/api/wifi-mac', { mac: v });
      setMacSent(true);
      await refreshMe();
    } catch (e) {
      setMacError(e instanceof Error ? e.message : 'Ошибка отправки MAC');
    }
  };

  const handleWifiCopy = async () => {
    if (!wifiShownPw) return;
    try {
      await navigator.clipboard.writeText(wifiShownPw);
      setWifiMsg('Пароль скопирован ✓');
    } catch {
      setWifiMsg('Выделите пароль вручную');
    }
  };

  const handleSelfLink = async (taskId: string) => {
    if (isTaskDone(taskId)) return;
    try {
      await api.post('/api/progress/self-link', { stage_id: 1, task_id: taskId });
      await refreshMe();
    } catch { /* best-effort */ }
  };

  const requestAccess = async (taskId: string, setMsgFn: (m: string | null) => void, okText: string) => {
    setMsgFn(null);
    try {
      await requestTask(taskId);
      setMsgFn(okText);
    } catch (e) {
      setMsgFn(e instanceof Error ? e.message : 'Не удалось отправить запрос');
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
      toast.success('MPulse подтверждён', '+5 баллов начислено');
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
    if (confClickedCount < confTotal) { setConfMsg(`Откройте все ${confTotal} страниц (открыто ${confClickedCount})`); return; }
    if (!confOpenedAt) { setConfMsg('Сначала откройте страницы по ссылкам выше'); return; }
    setConfConfirming(true);
    setConfMsg(null);
    try {
      await api.post('/api/confirm-confluence', { opened_at: confOpenedAt, links_clicked: confClicked });
      try { localStorage.removeItem(cfKey); } catch { /* ignore */ }
      toast.success('Confluence: ознакомление зафиксировано', '+10 баллов начислено');
      await refreshMe();
    } catch (e) {
      setConfMsg(e instanceof Error ? e.message : 'Подтвердить пока нельзя');
    } finally { setConfConfirming(false); }
  };

  const [accMsg, setAccMsg] = useState<string | null>(null);
  const [mbMsg, setMbMsg] = useState<string | null>(null);
  const [proxyMsg, setProxyMsg] = useState<string | null>(null);
  const [acctInstruction, setAcctInstruction] = useState('');

  const DEFAULT_ACCOUNTANT_TEXT = 'Передайте бухгалтеру реквизиты для выплат: копию свидетельства ИП (или выписку из реестра), БИН/ИИН, банковские реквизиты (БИК, IBAN, наименование банка). Выплаты — с 1 по 10 число. По вопросам начислений пишите бухгалтеру (контакт — у HR).';

  useEffect(() => {
    api.get<{ instruction_accountant?: string }>('/api/integrations/links')
      .then((l) => setAcctInstruction(l.instruction_accountant || ''))
      .catch(() => { /* не критично */ });
  }, []);

  const INFO_MODALS: Record<string, { title: string; sub?: string; body: string }> = {
    mbusiness: {
      title: 'MBusiness — открытие счёта',
      sub: 'Необходим для получения зарплаты',
      body: 'MBusiness нужен для того, чтобы вы своевременно получали выплаты за работу. Деньги поступают раз в месяц с 1 по 10 число.\n\nПомощь: При возникновении вопросов на этапе открытия счёта вам оперативно поможет ваш HR-менеджер.',
    },
    accountant: {
      title: 'Доступ бухгалтеру',
      sub: 'Предоставление реквизитов бухгалтерской службе',
      body: acctInstruction || DEFAULT_ACCOUNTANT_TEXT,
    },
    proxy: {
      title: 'Прокси-карта и Face ID (Транспортный доступ)',
      sub: 'Доступ в коворкинг, Технопарк и MSpace',
      body: 'Для получения физического пропуска/Face ID на первый этаж, в коворкинг, Технопарк или MSpace.\n\nЗапрос оформляется через вашего Team Lead или PM. Свяжитесь с руководителем для подачи заявки.',
    },
    wifi: {
      title: 'Доступ к Wi-Fi (Закрытая сеть)',
      sub: 'Подключение к корпоративной сети',
      body: 'Для подключения ноутбука к закрытой корпоративной сети передайте ваш MAC-адрес сетевым администраторам.\n\nПосле обработки запроса вы получите персональный пароль от закрытой сети Wi-Fi.',
    },
    telegram: {
      title: 'Доступ в Telegram-группы',
      sub: 'Рабочие чаты команды',
      body: 'Добавление в рабочие чаты команды происходит автоматически по пригласительным ссылкам.\n\nОбязательное условие: после вступления напишите краткое представление себя (кто вы, ваша роль, интересы) в главный чат команды!',
    },
    mpulse: {
      title: 'MPulse — корпоративное приложение',
      sub: 'AD · check-in/out · новости',
      body: 'Авторизация через корпоративный Active Directory (AD).\n\nОбязательный выбор рабочего графика (согласованного с руководителем).\n\nЕжедневный check-in / check-out, формат работы, корпоративные новости и уведомления.',
    },
  };

  return (
    <div className="stage-content s1-steps">
      <div className={`sla-banner ${sla.overdue && !step1Done && !step2Done ? 'overdue' : ''}`}>
        <span className="sla-icon">{sla.overdue ? <XCircle size={15} /> : <Clock size={15} />}</span>
        <span className="sla-text">
          {sla.overdue && (!step1Done || !step2Done || !step3Done || !step4ExplicitDone)
            ? 'SLA превышен: этап не выполнен в течение 1 недели с момента регистрации'
            : `SLA: 1 неделя с момента старта онбординга — ${sla.label}`}
        </span>
        {resolvedCreatedAt && <span className="sla-date">Старт: {new Date(resolvedCreatedAt).toLocaleDateString('ru-RU')}</span>}
      </div>

      {/* ── Шаг 1 ── */}
      <section className={`s1-step ${effectiveOpen === 1 ? 'open' : ''}`}>
        <StepHeader n={1} title="Подписание документов" reward="5 баллов" desc="HR выдала пакет офлайн · соберите всё и отправьте одной кнопкой" open={effectiveOpen === 1} done={step1Done} onToggle={() => toggleStep(1)} />
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
                  <button type="button" className="pkg-item-row" onClick={() => setOpenDoc(expanded ? null : d.id)} aria-expanded={expanded}>
                    <span className="pkg-item-ico"><d.Icon size={15} /></span>
                    <span className="pkg-item-body"><b>{i + 1}. {d.title}</b><span>{d.sub}</span></span>
                    <span className="pkg-item-st">{st === 'done' ? <CheckCircle2 size={16} /> : st === 'pending' ? <Clock size={15} /> : <span className="pkg-dot" />}</span>
                    <ChevronDown size={15} className={`pkg-chev ${expanded ? 'open' : ''}`} />
                  </button>
                  {expanded && <div className="pkg-detail">{d.detail}</div>}
                </li>
              );
            })}
          </ul>
          {step1Done ? (
            <div className="pkg-status done"><CheckCircle2 size={20} /><div><b>Выполнено — шаг 1 пройден</b><span>Подтверждено HR · <Award size={12} style={{ verticalAlign: '-2px' }} /> +5 баллов начислено</span></div></div>
          ) : rejectedDocs.length ? (
            <div className="pkg-status rejected"><XCircle size={20} /><div><b>HR отклонил(а) — нужно доделать</b><span>Причина: {rejectedDocs[0].note}</span></div>
              <button type="button" className="pkg-submit" onClick={submitDocs} disabled={sendingDocs}><RotateCcw size={14} /> {sendingDocs ? 'Отправляем…' : 'Исправить и отправить снова'}</button>
            </div>
          ) : pendingDocs.length ? (
            <div className="pkg-status pending"><Hourglass size={20} className="spin-slow" /><div><b>Ожидает проверки HR</b><span>Пакет ({pendingDocs.length}/5) у HR на проверке</span></div></div>
          ) : (
            <button type="button" className="pkg-submit" onClick={submitDocs} disabled={sendingDocs}><Send size={14} /> {sendingDocs ? 'Отправляем…' : 'Подписал документы, отправить на проверку HR'}</button>
          )}
          {reqMsg && <div className="wifi-err">{reqMsg}</div>}
        </div>
        </div>
      </section>

      {/* ── Шаг 2 ── */}
      <section className={`s1-step ${effectiveOpen === 2 ? 'open' : ''}`}>
        <StepHeader n={2} title="Получение доступов" reward="0 баллов" desc="Подтверждение staff (HR/лид/сисадмин) — сотрудник отмечает, staff верифицирует" open={effectiveOpen === 2} done={step2Done} onToggle={() => toggleStep(2)} />
        <div className="s1-step-body">
        <div className="step-grid">
          <div className="doc-card svc-card">
            <div className="dc-icon"><img src="/mbusiness-logo.png" alt="MBusiness" width={28} height={28} loading="lazy" decoding="async" style={{ objectFit: 'contain' }} /></div>
            <div className="dc-body" style={{ flex: 1 }}>
              <div className="dc-title">MBusiness — открытие {isTaskDone('1-mbusiness') && <span className="dc-badge">выполнено</span>}{!isTaskDone('1-mbusiness') && pending.includes('1-mbusiness') && <span className="dc-badge pending">ожидает HR</span>}</div>
              <div className="dc-sub">MBusiness нужен для получения зарплаты (1–10 число). HR поможет с открытием.</div>
              {!isTaskDone('1-mbusiness') && !pending.includes('1-mbusiness') && (
                <button type="button" className="wifi-btn" style={{ marginTop: 8 }} onClick={() => requestAccess('1-mbusiness', setMbMsg, 'Запрос отправлен HR ✓')}>Запросить открытие MBusiness</button>
              )}
              {pending.includes('1-mbusiness') && !isTaskDone('1-mbusiness') && <div className="wifi-ok">Ожидает подтверждения HR…</div>}
              {rejNote('1-mbusiness') && <div className="wifi-err">HR: {rejNote('1-mbusiness')}</div>}
              {mbMsg && <div className="wifi-ok">{mbMsg}</div>}
              <button type="button" className="wifi-help-link" onClick={() => setOpenInfo(INFO_MODALS.mbusiness)}>Подробнее <ChevronRight size={12} style={{ verticalAlign: '-2px' }} /></button>
            </div>
          </div>
          <div className="doc-card svc-card">
            <div className="dc-icon"><ClipboardCheck size={16} /></div>
            <div className="dc-body" style={{ flex: 1 }}>
              <div className="dc-title">Доступ бухгалтеру {isTaskDone('1-accountant') && <span className="dc-badge">выполнено</span>}{!isTaskDone('1-accountant') && pending.includes('1-accountant') && <span className="dc-badge pending">ожидает бухгалтера</span>}</div>
              <div className="dc-sub">{acctInstruction || DEFAULT_ACCOUNTANT_TEXT}</div>
              {!isTaskDone('1-accountant') && !pending.includes('1-accountant') && (
                <button type="button" className="wifi-btn" style={{ marginTop: 8 }} onClick={() => requestAccess('1-accountant', setAccMsg, 'Отмечено — бухгалтер проверит ✓')}>Я выполнил инструкцию</button>
              )}
              {pending.includes('1-accountant') && !isTaskDone('1-accountant') && <div className="wifi-ok">Ожидает подтверждения бухгалтера…</div>}
              {rejNote('1-accountant') && <div className="wifi-err">Бухгалтер: {rejNote('1-accountant')}</div>}
              {accMsg && <div className="wifi-ok">{accMsg}</div>}
              <button type="button" className="wifi-help-link" onClick={() => setOpenInfo(INFO_MODALS.accountant)}>Подробнее <ChevronRight size={12} style={{ verticalAlign: '-2px' }} /></button>
            </div>
          </div>
          <div className="doc-card svc-card">
            <div className="dc-icon"><KeyRound size={16} /></div>
            <div className="dc-body" style={{ flex: 1 }}>
              <div className="dc-title">Прокси-карта и Face ID {isTaskDone('1-proxy') && <span className="dc-badge">выполнено</span>}{!isTaskDone('1-proxy') && pending.includes('1-proxy') && <span className="dc-badge pending">ожидает выдачи</span>}</div>
              <div className="dc-sub">Пропуск на 1 этаж · коворкинг · Технопарк / MSpace. Запрос уходит вашему Лиду/PM.</div>
              {!isTaskDone('1-proxy') && !pending.includes('1-proxy') && (
                <button type="button" className="wifi-btn" style={{ marginTop: 8 }} onClick={() => requestAccess('1-proxy', setProxyMsg, 'Запрос отправлен Лиду/PM ✓')}>Запросить пропуск у Лида/PM</button>
              )}
              {pending.includes('1-proxy') && !isTaskDone('1-proxy') && <div className="wifi-ok">Ожидает выдачи…</div>}
              {rejNote('1-proxy') && <div className="wifi-err">Лид: {rejNote('1-proxy')}</div>}
              {proxyMsg && <div className="wifi-ok">{proxyMsg}</div>}
              <button type="button" className="wifi-help-link" onClick={() => setOpenInfo(INFO_MODALS.proxy)}>Подробнее <ChevronRight size={12} style={{ verticalAlign: '-2px' }} /></button>
            </div>
          </div>
          <div className="doc-card tg-card">
            <div className={`dc-icon ${isTaskDone('1-telegram') ? 'dc-done' : ''}`}>{isTaskDone('1-telegram') ? <CheckCircle2 size={16} /> : <Send size={16} />}</div>
            <div className="dc-body" style={{ flex: 1 }}>
              <div className="dc-title">Доступ в Telegram-группы {isTaskDone('1-telegram') && <span className="dc-badge">готово</span>}{!isTaskDone('1-telegram') && pending.includes('1-telegram') && <span className="dc-badge pending">ожидает HR</span>}{user?.email === 'demo@mdigital.kg' ? <span className="dc-badge">демо: все группы</span> : myRole ? <span className="dc-badge">{myRole}</span> : null}</div>
              {isTaskDone('1-telegram') ? (
                <>
                  <div className="dc-sub">✅ Вы добавлены в группы:</div>
                  <div className="tg-groups">{(tgAdded.length ? tgAdded : tgGroups.map((g) => g.title)).map((t) => (<div key={t} className="tg-group-row"><span>• {t}</span></div>))}</div>
                  <div className="dc-sub">Не забудьте представиться команде! Шаблон приветствия:</div>
                </>
              ) : (
                <>
                  <div className="dc-sub">1. Напишите нашему боту команду /start:</div>
                  <div className="wifi-inline" onClick={e => e.stopPropagation()}><a href="https://t.me/onboarding_admin_bot?start=onboarding" target="_blank" rel="noopener noreferrer" className="wifi-btn" style={{ textDecoration: 'none' }}>Открыть бота →</a></div>
                  <div className="dc-sub">2. Укажите ваш @username в Telegram:</div>
                  <div className="wifi-inline" onClick={e => e.stopPropagation()}>
                    <input className="wifi-input" placeholder="@ivan_99" value={tgHandle} onChange={e => setTgHandle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleTgAutoAdd(); }} aria-label="Telegram username" />
                  </div>
                  {tgHandleError && <div className="wifi-err">{tgHandleError}</div>}
                  {tgGroups.length > 0 ? (
                    <div className="tg-groups">
                      {tgGroups.map((g) => (<div key={g.chat_id} className="tg-group-row"><span>{g.title}</span>{tgAdded.includes(g.title) ? <span className="wifi-ok">добавлен ✓</span> : tgFailed[g.title] ? <span className="wifi-err">{tgFailed[g.title]}</span> : <span className="tg-pending">—</span>}</div>))}
                      <button type="button" className="wifi-btn" onClick={handleTgAutoAdd} disabled={tgAdding}>{tgAdding ? 'Добавляем…' : 'Добавить меня в группы'}</button>
                    </div>
                  ) : <div className="wifi-err">Групп для вашей роли ({myRole || '—'}) пока нет — обратитесь к HR</div>}
                </>
              )}
              <div className="tg-greet">
                <div className="tg-greet-title">Шаблон приветствия (можно править):</div>
                <textarea className="wifi-input tg-textarea" rows={3} value={tgGreet} onChange={e => setTgGreet(e.target.value)} onClick={e => e.stopPropagation()} aria-label="Текст приветствия" />
                <div className="wifi-inline" onClick={e => e.stopPropagation()}><button type="button" className="wifi-btn" onClick={handleTgCopy}>Скопировать шаблон</button></div>
              </div>
              {tgInvites.length > 0 && (
                <div className="tg-groups">
                  <div className="tg-greet-title">Не вышло автоматически — вступите по ссылкам:</div>
                  {tgInvites.map((l) => (<div key={l.title} className="tg-group-row"><span>{l.title}</span><a href={l.url} target="_blank" rel="noopener noreferrer" className="wifi-btn" style={{ textDecoration: 'none' }}>Открыть приглашение</a></div>))}
                </div>
              )}
              {tgMsg && <div className={tgMsg.includes('✓') ? 'wifi-ok' : 'wifi-err'}>{tgMsg}</div>}
              {rejNote('1-telegram') && <div className="wifi-err">Тимлид: {rejNote('1-telegram')}</div>}
              <button type="button" className="wifi-help-link" onClick={() => setOpenInfo(INFO_MODALS.telegram)}>Подробнее <ChevronRight size={12} style={{ verticalAlign: '-2px' }} /></button>
            </div>
          </div>
          {/* Access services from DB */}
          {accessServices.map((s) => (
            <div key={s.key} className="doc-card svc-card">
              <div className="dc-icon"><ServiceIcon icon_key={s.icon_key} /></div>
              <div className="dc-body" style={{ flex: 1 }}>
                <div className="dc-title">{s.title} {s.task_id && isTaskDone(s.task_id) && <span className="dc-badge">выполнено</span>}</div>
                <div className="dc-sub">{s.subtitle}</div>
                {s.url ? (
                  s.task_id
                    ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="wifi-help-link" onClick={() => handleSelfLink(s.task_id!)}>{s.title} →</a>
                    : <a href={s.url} target="_blank" rel="noopener noreferrer" className="wifi-help-link">{s.title} →</a>
                ) : <span className="wifi-err">Ссылка не настроена</span>}
                {s.details && <button type="button" className="wifi-help-link" onClick={() => setOpenInfo({ title: s.title, sub: s.subtitle, body: s.details })}>Подробнее <ChevronRight size={12} style={{ verticalAlign: '-2px' }} /></button>}
              </div>
            </div>
          ))}
          <div className="doc-card wifi-card">
            <div className={`dc-icon ${isTaskDone('1-wifi') ? 'dc-done' : ''}`}>{isTaskDone('1-wifi') ? <CheckCircle2 size={16} /> : <Wifi size={16} />}</div>
            <div className="dc-body" style={{ flex: 1 }}>
              <div className="dc-title">Доступ к Wi-Fi (Закрытая сеть) {isTaskDone('1-wifi') && <span className="dc-badge">готово</span>}</div>
              <div className="dc-sub">Введите MAC-адрес ноутбука — сетевик выдаст пароль</div>
              <div className="wifi-inline" onClick={e => e.stopPropagation()}>
                <input className="wifi-input" placeholder="AA:BB:CC:DD:EE:FF" value={mac} onChange={e => setMac(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleWifiSubmit(); }} aria-label="MAC-адрес" />
                <button type="button" className="wifi-btn" onClick={handleWifiSubmit} disabled={macSent}>{macSent ? 'Отправлено ✓' : 'Отправить'}</button>
              </div>
              {macError && <div className="wifi-err">{macError}</div>}
              {macSent && !isTaskDone('1-wifi') && !wifiShownPw && !macError && <div className="wifi-ok">⏳ Ожидаем пароль от сетевика…</div>}
              {isTaskDone('1-wifi') && !macError && <div className="wifi-ok">Wi-Fi подтверждён ✓</div>}
              {wifiShownPw && (
                <div className="wifi-shown">
                  <div className="wifi-inline" onClick={e => e.stopPropagation()}>
                    <input className="wifi-input" type={wifiShowPw ? 'text' : 'password'} value={wifiShownPw} readOnly aria-label="Пароль Wi-Fi" />
                    <button type="button" className="wifi-btn" onClick={() => setWifiShowPw(!wifiShowPw)}>{wifiShowPw ? 'Скрыть' : 'Показать'}</button>
                    <button type="button" className="wifi-btn" onClick={handleWifiCopy}>Копировать</button>
                  </div>
                </div>
              )}
              {wifiMsg && <div className={wifiMsg.includes('✓') ? 'wifi-ok' : 'wifi-err'}>{wifiMsg}</div>}
              <button type="button" className="wifi-help-link" onClick={() => setOpenInfo(INFO_MODALS.wifi)}>Подробнее <ChevronRight size={12} style={{ verticalAlign: '-2px' }} /></button>
            </div>
          </div>
        </div>
        </div>
        {step2Done && <div className="step-done-badge">Шаг 2 выполнен ✓ (0 баллов)</div>}
      </section>

      {/* ── Шаг 3: MPulse ── */}
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
            {mpulseServices.map((s) => (
              <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className={`mpulse-dl ${s.icon_key === 'Apple' ? 'apple' : 'google'}`}>{s.title}</a>
            ))}
          </div>
          <div className="mpulse-verify">
            <div className="mpulse-verify-title">
              <span className="mpulse-verify-ico">🔑</span>
              Верификация — введите проверочный код из MPulse
            </div>
            <div className="mpulse-verify-sub">После входа в приложение вы увидите код. Введите его здесь, чтобы система зачла выполнение.</div>
            {isTaskDone('1-mpulse-code') ? (
              <div className="mpulse-verify-done">
                <CheckCircle2 size={18} />
                <span>Код подтверждён ✓</span>
              </div>
            ) : (
              <div className="mpulse-row">
                <input className="mpulse-input" placeholder="Например: MPULSE-2026" value={mpulseCode} onChange={e => setMpulseCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleMpulseVerify(); }} aria-label="Проверочный код MPulse" />
                <button type="button" className="mpulse-btn" onClick={handleMpulseVerify} disabled={mpulseVerifying}>{mpulseVerifying ? 'Проверка…' : 'Подтвердить код'}</button>
              </div>
            )}
            {mpulseMsg && <div className={`mpulse-msg ${mpulseMsg.includes('✓') ? 'ok' : 'err'}`}>{mpulseMsg}</div>}
            {step3Done && <div className="pkg-status done"><CheckCircle2 size={20} /><div><b>Выполнено — MPulse настроен</b></div></div>}
          </div>
        </div>
        </div>
        {step3Done && <div className="step-done-badge">Шаг 3 выполнен ✓ +5 баллов</div>}
      </section>

      {/* ── Шаг 4: Confluence (dynamic from DB) ── */}
      <section className={`s1-step ${effectiveOpen === 4 ? 'open' : ''}`}>
        <StepHeader n={4} title="База знаний Confluence" reward="10 баллов" desc={`Откройте все ${confTotal} страниц · читайте 2 мин с открытой вкладкой · нажмите «Я ознакомился(-ась)»`} open={effectiveOpen === 4} done={step4ExplicitDone} onToggle={() => toggleStep(4)} />
        <div className="s1-step-body">
        <div className="cf-links">
          {knowledgeServices.map((s) => {
            const pid = s.extra.pageId ?? s.key;
            const seen = Boolean(confClicked[pid]);
            return (
              <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className={`confluence-link ${seen ? 'seen' : ''}`} onClick={() => handleConfluenceLink(pid)}>
                <span className="cf-icon">{seen ? '✓' : s.icon_key === 'BookOpen' ? 'CF' : s.icon_key.slice(0, 2).toUpperCase()}</span>
                <span className="cf-body"><span className="cf-title">{s.title}</span><span className="cf-sub">{s.subtitle} · {seen ? 'открыта ✓' : 'нажмите чтобы открыть'}</span></span>
                <span className="cf-arrow"><ChevronRight size={18} /></span>
              </a>
            );
          })}
        </div>
        <div className="cf-progress">Открыто {confClickedCount}/{confTotal} · видимое чтение {Math.floor(confVisibleSec / 60)}:{String(confVisibleSec % 60).padStart(2, '0')} / 2:00</div>
        <button type="button" className={`cf-confirm ${step4ExplicitDone ? 'done' : ''}`} onClick={handleConfluenceConfirm} disabled={confConfirming || step4ExplicitDone || !confReady}>
          {confConfirming ? 'Фиксируем…' : step4ExplicitDone ? 'Ознакомление зафиксировано ✓' : confReady ? 'Я ознакомился(-ась)' : `Откройте все страницы и читайте (${confClickedCount}/${confTotal}, ${Math.floor(confRemain / 60)}:${String(confRemain % 60).padStart(2, '0')})`}
        </button>
        {confMsg && <div className="wifi-err">{confMsg}</div>}
        <div className="cf-hint">Таймер идёт только пока вкладка открыта — свернули, поставили на паузу</div>
        </div>
        {step4ExplicitDone && <div className="step-done-badge">Шаг 4 выполнен ✓ +10 баллов</div>}
      </section>

      <div className="doc-hint font-orbitron">Открой каждый документ и пролистай до конца — иначе не подтвердится. HR верификация шага 1 обязательна.</div>

      <DocumentModal kind="wifi" open={open === 'wifi'} onClose={() => setOpen(null)} alreadyDone={isDone('wifi')} onConfirm={() => handleConfirm('wifi')} />
      {openInfo && <ServiceModal title={openInfo.title} sub={openInfo.sub} body={openInfo.body} onClose={() => setOpenInfo(null)} />}

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
        .step-head{ display:flex; gap:10px; align-items:flex-start }
        .step-head.clickable{ cursor:pointer; }
        .sh-num{ width:32px; height:32px; border-radius:9px; display:grid; place-items:center; flex-shrink:0; font-size:13px; font-weight:800; color:#fff; background:linear-gradient(135deg,#1E3A8A,#2563EB); box-shadow:0 4px 14px rgba(37,99,235,.35) }
        .sh-body{ flex:1 }
        .sh-title{ font-size:13.5px; font-weight:800; color:var(--text); display:flex; align-items:center; gap:8px; flex-wrap:wrap }
        .sh-reward{ font-size:10px; letter-spacing:.10em; text-transform:uppercase; padding:2px 7px; border-radius:999px; background:rgba(251,191,36,.12); border:1px solid rgba(251,191,36,.28); color:#FBBF24 }
        .sh-desc{ font-size:11.5px; color:var(--muted); margin-top:4px; line-height:1.45 }
        .sh-chevron{ margin-left:auto; color:#60A5FA; font-size:16px; line-height:1; transition:transform .2s ease; flex-shrink:0; display:none }
        @media(min-width:641px){ .sh-chevron{ display:block; transition:transform .35s cubic-bezier(.16,1,.3,1); transform-origin:center } .s1-step.open .sh-chevron{ transform:rotate(180deg) } }
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
        .pkg-status span{ color:var(--muted); }
        .pkg-status.done{ border:1px solid rgba(34,197,94,.35); background:rgba(34,197,94,.08); color:#86EFAC; }
        .pkg-status.pending{ border:1px solid rgba(251,191,36,.3); background:rgba(251,191,36,.06); color:#FDE68A; }
        .pkg-status.rejected{ border:1px solid rgba(239,68,68,.35); background:rgba(239,68,68,.08); color:#FCA5A5; }
        .pkg-submit{ display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; border:none; cursor:pointer; font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; font-family:'Open Sans',sans-serif; background:linear-gradient(90deg,#1E3A8A,#2563EB); color:#fff; transition:filter .15s }
        .pkg-submit:hover{ filter:brightness(1.1) }
        .pkg-submit:disabled{ opacity:.55; cursor:not-allowed }
        .step-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:10px }
        .doc-card{ display:flex; flex-direction:column; gap:8px; padding:12px; border-radius:11px; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.07); transition:border-color .2s }
        .doc-card:hover{ border-color:rgba(59,130,246,.25) }
        .dc-icon{ width:36px; height:36px; border-radius:9px; display:grid; place-items:center; flex-shrink:0; background:rgba(59,130,246,.1); border:1px solid rgba(59,130,246,.25); color:#93C5FD }
        .dc-icon.dc-done{ background:rgba(34,197,94,.14); border-color:rgba(34,197,94,.35); color:#86EFAC }
        .dc-body{ display:flex; flex-direction:column; gap:6px }
        .dc-title{ font-size:13px; font-weight:700; color:var(--text); display:flex; gap:6px; align-items:center; flex-wrap:wrap }
        .dc-badge{ font-size:9px; letter-spacing:.1em; text-transform:uppercase; padding:2px 7px; border-radius:999px; background:rgba(34,197,94,.12); border:1px solid rgba(34,197,94,.3); color:#86EFAC }
        .dc-badge.pending{ background:rgba(251,191,36,.12); border-color:rgba(251,191,36,.3); color:#FBBF24 }
        .dc-sub{ font-size:11.5px; color:var(--muted); line-height:1.5 }
        .wifi-input{ flex:1; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,.10); background:rgba(0,0,0,.22); color:var(--text); font-size:12.5px; font-family:'Open Sans',sans-serif; outline:none }
        .wifi-input:focus{ border-color:rgba(59,130,246,.45); box-shadow:0 0 0 3px rgba(59,130,246,.18) }
        .wifi-btn{ padding:8px 14px; border-radius:8px; border:none; cursor:pointer; font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; font-family:'Open Sans',sans-serif; background:linear-gradient(90deg,#1E3A8A,#2563EB); color:#fff; flex-shrink:0; transition:filter .15s, opacity .15s }
        .wifi-btn:hover{ filter:brightness(1.08) }
        .wifi-btn:disabled{ opacity:.55; cursor:not-allowed }
        .wifi-inline{ display:flex; gap:8px; align-items:center }
        .wifi-ok{ font-size:11.5px; padding:6px 10px; border-radius:8px; background:rgba(34,197,94,.10); border:1px solid rgba(34,197,94,.25); color:#86EFAC }
        .wifi-err{ font-size:11.5px; padding:6px 10px; border-radius:8px; background:rgba(239,68,68,.10); border:1px solid rgba(239,68,68,.25); color:#FCA5A5 }
        .wifi-help-link{ font-size:11.5px; color:#60A5FA; text-decoration:underline; cursor:pointer; background:none; border:none; padding:0 }
        .wifi-shown{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:8px 10px; border-radius:8px; background:rgba(34,197,94,.08); border:1px dashed rgba(34,197,94,.35); font-size:12px; color:#86EFAC }
        .wifi-shown code{ font-family:monospace; font-size:13px; color:#fff; user-select:all }
        .svc-card{ cursor:default; align-items:flex-start; }
        .svc-card:hover{ transform:none; }
        .tg-card{ border-color:rgba(59,130,246,.18); }
        .tg-card.dc-done{ border-color:rgba(34,197,94,.3); }
        .tg-groups{ display:flex; flex-direction:column; gap:6px; margin-top:4px }
        .tg-group-row{ display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 10px; border-radius:8px; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.05); font-size:12px }
        .tg-greet{ display:flex; flex-direction:column; gap:6px; margin-top:8px }
        .tg-greet-title{ font-size:11.5px; font-weight:700; color:var(--text) }
        .tg-textarea{ resize:vertical; min-height:60px }
        .tg-pending{ color:var(--muted) }
        .wifi-card{ border-color:rgba(96,165,250,.18); }
        .wifi-card.dc-done{ border-color:rgba(34,197,94,.3); }
        .mpulse-step .mpulse-card{ display:flex; flex-direction:column; gap:12px; padding:14px; border-radius:12px; background:rgba(37,99,235,.06); border:1px solid rgba(59,130,246,.18) }
        .mpulse-head{ display:flex; gap:12px; align-items:flex-start }
        .mpulse-icon-img{ width:44px; height:44px; border-radius:11px; object-fit:contain; flex-shrink:0; background:rgba(255,255,255,.06); border:1px solid rgba(59,130,246,.18) }
        .mpulse-title{ font-size:13.5px; font-weight:800; color:var(--text) }
        .mpulse-sub{ font-size:11.5px; color:var(--muted); margin-top:4px; line-height:1.45 }
        .mpulse-list{ margin:0; padding-left:18px; font-size:12px; color:var(--muted); line-height:1.6 }
        .mpulse-list b{ color:var(--text) }
        .mpulse-links{ display:flex; gap:8px; flex-wrap:wrap }
        .mpulse-dl{ display:inline-flex; align-items:center; gap:6px; padding:9px 14px; border-radius:999px; font-size:11px; font-weight:700; text-decoration:none; color:#fff }
        .mpulse-dl.google{ background:#01875f } .mpulse-dl.apple{ background:#000 }
        .mpulse-verify{ padding:14px; border-radius:12px; background:linear-gradient(180deg, rgba(37,99,235,.12), rgba(0,0,0,.25)); border:1px solid rgba(59,130,246,.35); display:flex; flex-direction:column; gap:10px }
        .mpulse-verify-title{ font-size:13px; font-weight:800; color:var(--text); display:flex; align-items:center; gap:8px }
        .mpulse-verify-ico{ font-size:18px }
        .mpulse-verify-sub{ font-size:11.5px; color:var(--muted); line-height:1.5 }
        .mpulse-verify-done{ display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:8px; background:rgba(34,197,94,.12); border:1px solid rgba(34,197,94,.3); color:#86EFAC; font-size:12px; font-weight:700 }
        .mpulse-row{ display:flex; gap:8px; align-items:center }
        .mpulse-msg{ font-size:11.5px; padding:8px 12px; border-radius:8px; display:flex; align-items:center; gap:6px }
        .mpulse-msg.ok{ background:rgba(34,197,94,.10); border:1px solid rgba(34,197,94,.25); color:#86EFAC }
        .mpulse-msg.err{ background:rgba(239,68,68,.10); border:1px solid rgba(239,68,68,.25); color:#FCA5A5 }
        .confluence-link{ display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:11px; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.08); text-decoration:none; color:inherit; transition:background .15s, border-color .15s }
        .confluence-link:hover{ background:rgba(59,130,246,.06); border-color:rgba(59,130,246,.22) }
        .confluence-link.seen{ border-color:rgba(34,197,94,.3); }
        .confluence-link.seen .cf-icon{ background:rgba(34,197,94,.14); border-color:rgba(34,197,94,.35); color:#86EFAC; }
        .cf-icon{ width:32px; height:32px; border-radius:8px; display:grid; place-items:center; flex-shrink:0; font-size:11px; font-weight:800; background:rgba(59,130,246,.1); border:1px solid rgba(59,130,246,.25); color:#93C5FD }
        .cf-body{ flex:1; display:flex; flex-direction:column; gap:2px }
        .cf-title{ font-size:12.5px; font-weight:700; color:var(--text) }
        .cf-sub{ font-size:11px; color:var(--muted) }
        .cf-arrow{ color:#60A5FA; flex-shrink:0 }
        .cf-progress{ font-size:11.5px; color:var(--muted); padding:6px 0 }
        .cf-confirm{ width:100%; padding:10px; border-radius:10px; border:none; cursor:pointer; font-size:12px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; background:linear-gradient(90deg,#1E3A8A,#2563EB); color:#fff; transition:filter .15s }
        .cf-confirm:hover{ filter:brightness(1.08) }
        .cf-confirm:disabled{ opacity:.5; cursor:not-allowed }
        .cf-confirm.done{ background:rgba(34,197,94,.2); color:#86EFAC; cursor:default }
        .cf-hint{ font-size:11px; color:var(--muted); text-align:center }
        .step-done-badge{ font-size:11.5px; font-weight:700; color:#86EFAC; text-align:center; padding:6px; border-radius:8px; background:rgba(34,197,94,.08); border:1px solid rgba(34,197,94,.2) }
        .doc-hint{ font-size:11px; color:var(--muted); text-align:center; padding:8px 12px; border-radius:8px; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.05) }
        @media(max-width:640px){
          .step-grid{ grid-template-columns:1fr }
          .wifi-inline, .mpulse-row{ flex-wrap:wrap }
          .wifi-input, .mpulse-input{ flex:1 1 100%; min-height:44px; font-size:13px }
          .wifi-btn, .mpulse-btn{ flex:1 1 100%; min-height:44px; font-size:12px }
          .wifi-shown .wifi-inline{ flex-direction:column; gap:6px }
          .wifi-shown .wifi-btn{ width:100%; min-height:44px }
          .mpulse-row{ flex-direction:column; gap:10px }
          .mpulse-dl{ width:100%; justify-content:center; min-height:44px }
          .pkg-item-row{ padding:10px 11px }
          .pkg-submit{ width:100%; justify-content:center; min-height:44px }
          .cf-confirm{ min-height:44px }
          .tg-group-row{ font-size:11.5px; padding:5px 8px }
          .tg-greet{ gap:5px }
          .tg-textarea{ min-height:52px }
          .dc-title{ font-size:12.5px }
          .dc-sub{ font-size:11px; line-height:1.45 }
          .pkg-sub{ font-size:11px }
          .s1-step{ padding:12px 10px; gap:8px }
          .s1-step-body{ gap:8px }
          .step-done-badge{ font-size:11px; padding:5px }
        }
        @media(max-width:480px){
          .dc-title{ font-size:12px }
          .dc-sub{ font-size:10.5px }
          .s1-step{ padding:10px 8px }
          .pkg-card{ padding:12px }
          .pkg-title{ font-size:12.5px }
          .mpulse-title{ font-size:12.5px }
          .mpulse-sub{ font-size:10.5px }
          .sh-num{ width:28px; height:28px; font-size:12px; border-radius:7px }
          .sh-title{ font-size:12.5px }
          .sh-desc{ font-size:10.5px }
          .tg-greet-title{ font-size:10.5px }
          .cf-title{ font-size:12px }
          .cf-sub{ font-size:10.5px }
          .cf-icon{ width:28px; height:28px; font-size:10px }
          .confluence-link{ padding:10px 12px; gap:10px }
          .wifi-btn{ font-size:11px; padding:7px 12px }
          .wifi-input{ padding:7px 9px; font-size:12px }
          .wifi-ok, .wifi-err{ font-size:11px; padding:5px 8px }
          .wifi-help-link{ font-size:11px }
        }
        @media(max-width:380px){
          .dc-title{ font-size:11.5px }
          .dc-sub{ font-size:10px }
          .pkg-submit{ font-size:10px; padding:7px 10px }
          .mpulse-verify{ padding:10px }
          .mpulse-verify-title{ font-size:11.5px }
          .sh-num{ width:26px; height:26px; font-size:11px }
          .step-done-badge{ font-size:10.5px }
          .doc-hint{ font-size:10px; padding:6px 8px }
        }
      `}</style>
    </div>
  );
}
