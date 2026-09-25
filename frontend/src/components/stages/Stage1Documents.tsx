import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck, ChevronDown, ChevronRight, ClipboardCheck, FileCheck,
  FileText, FolderCheck, IdCard, KeyRound, Send, ShieldCheck, Wifi,
  Link as LinkIcon, Smartphone, Apple, BookOpen, Globe, Lock, MessageSquare, ExternalLink, Download,
  CircleCheck, Check, Copy, Info,
} from 'lucide-react';
import type { StageId } from '../../data/stages';
import { useOnboarding } from '../../store/useOnboarding';
import { SlaBanner } from '../ui/SlaBanner';
import { DocumentModal, type DocKind } from './DocumentModal';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../api/client';
import { useServices } from '../../hooks/useServices';
import { ServiceModal } from './ServiceModal';

interface Props { stageId: StageId }

type DocKey = Exclude<DocKind, 'docs' | 'lead' | 'jira' | 'confluence'>;
const docToTask: Record<DocKey, string> = {
  dogovor: '1-dogovor', nda: '1-nda', pdp: '1-pdp', ip: '1-ip', sn: '1-sn',
  mbusiness: '1-mbusiness', accountant: '1-accountant', wifi: '1-wifi', proxy: '1-proxy', telegram: '1-telegram',
  mplus: '1-mpulse-code',
};

function StepHeader({ n, title, reward, desc, open, done, onToggle }: {
  n: number; title: string; reward: string; desc?: string; open?: boolean; done?: boolean; onToggle?: () => void;
}) {
  return (
    <div className={`step-head ${onToggle ? 'clickable' : ''}`} onClick={onToggle} role={onToggle ? 'button' : undefined} tabIndex={onToggle ? 0 : undefined}
      onKeyDown={onToggle ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}>
      <div className="sh-num">{done ? <CircleCheck size={16} /> : n}</div>
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
  const refreshMe = useOnboarding((s) => s.refreshMe);
  const connectLive = useOnboarding((s) => s.connectLive);
  const user = useOnboarding((s) => s.user);
  const myRole = useOnboarding((s) => s.role);
  const toast = useToast();

  const [open, setOpen] = useState<DocKind | null>(null);
  const [openInfo, setOpenInfo] = useState<{ title: string; sub?: string; body: string; taskId?: string } | null>(null);

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

  const isTaskDone = (taskId: string) => done.includes(taskId);

  const DOCS_PACKAGE = [
    { id: '1-dogovor', title: 'Договор об оказании услуг', sub: '2 экземпляра · подписать оба, один остаётся у вас', kind: 'dogovor' as DocKind, Icon: FileText },
    { id: '1-nda', title: 'NDA — о неразглашении', sub: '2 экземпляра · строгий режим, действует 3 года', kind: 'nda' as DocKind, Icon: ShieldCheck },
    { id: '1-pdp', title: 'Соглашение о персональных данных', sub: 'Обязательный документ', kind: 'pdp' as DocKind, Icon: FileCheck },
    { id: '1-ip', title: 'Свидетельство ИП', sub: 'Копия / выписка + реквизиты', kind: 'ip' as DocKind, Icon: IdCard },
    { id: '1-sn', title: 'Справка о несудимости', sub: 'Актуальный документ', kind: 'sn' as DocKind, Icon: BadgeCheck },
  ];

  useEffect(() => { connectLive(); }, [connectLive]);

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
  useEffect(() => () => { if (tgCopyTimer.current) clearTimeout(tgCopyTimer.current); }, []);

  useEffect(() => {
    if (!confOpenedAt || step4ExplicitDone) return;
    const id = setInterval(() => { if (!document.hidden) setConfVisibleSec((v) => v + 1); }, 1000);
    return () => clearInterval(id);
  }, [confOpenedAt, step4ExplicitDone]);

  const userName = user?.name ?? '';
  const [tgGroups, setTgGroups] = useState<{ title: string; chat_id: string }[]>([]);
  const [tgAdded, setTgAdded] = useState<string[]>([]);
  const [tgFailed, setTgFailed] = useState<Record<string, string>>({});
  const [tgSkipped, setTgSkipped] = useState<string[]>([]);
  const [tgAdding, setTgAdding] = useState(false);
  const [tgGreet, setTgGreet] = useState('');
  const [tgMsg, setTgMsg] = useState<string | null>(null);
  const [tgInvites, setTgInvites] = useState<{ title: string; url: string }[]>([]);
  const [tgSelected, setTgSelected] = useState<Record<string, boolean>>({});
  const [tgCopied, setTgCopied] = useState(false);
  const tgCopyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTgGroups = () => {
    api.get<{ groups: { title: string; chat_id: string }[] }>('/api/integrations/telegram-groups')
      .then((r) => {
        setTgGroups(r.groups);
        setTgSelected((prev) => {
          const next: Record<string, boolean> = {};
          for (const g of r.groups) next[g.chat_id] = prev[g.chat_id] ?? true;
          return next;
        });
      })
      .catch(() => { /* ignore */ });
  };
  useEffect(() => {
    loadTgGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRole, user?.email]);
  useEffect(() => {
    if (!tgGreet) setTgGreet(`Привет! Я ${userName || 'новый сотрудник'}. Присоединился к команде. Рад познакомиться!`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]);

  const handleTgAutoAdd = async () => {
    setTgAdding(true);
    setTgMsg(null);
    try {
      const r = await api.post<{ added: string[]; failed: { title: string; reason: string }[]; skipped?: string[]; invite_links?: { title: string; url: string }[]; verified?: boolean; greeted?: string[] }>('/api/integrations/telegram-auto-add', { greeting: tgGreet.trim().slice(0, 500) });
      setTgAdded(r.added);
      const f: Record<string, string> = {};
      for (const x of r.failed) f[x.title] = x.reason;
      setTgFailed(f);
      setTgSkipped(r.skipped ?? []);
      setTgInvites(r.invite_links ?? []);
      await refreshMe();
      loadTgGroups();
      if (r.failed.length === 0) {
        const greetNote = r.greeted && r.greeted.length > 0 ? ', приветствие отправлено' : '';
        const skipNote = r.skipped && r.skipped.length > 0 ? ` · пропущены без админки: ${r.skipped.length}` : '';
        setTgMsg(`Вы добавлены в группы ✓ (${r.added.length})${greetNote}${skipNote}`);
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
      if (tgCopyTimer.current) clearTimeout(tgCopyTimer.current);
      setTgCopied(true);
      tgCopyTimer.current = setTimeout(() => setTgCopied(false), 5000);
    } catch {
      /* silent — user can select text manually */
    }
  };

  const handleInfoRead = async (taskId: string) => {
    if (done.includes(taskId)) return;
    try {
      await api.post('/api/progress/info-read', { stage_id: 1, task_id: taskId });
      toast.success('Задача выполнена', '+XP начислено');
      await refreshMe();
    } catch (e) {
      toast.error('Ошибка', e instanceof Error ? e.message : 'Не удалось зачесть');
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

  const [acctInstruction, setAcctInstruction] = useState('');

  const DEFAULT_ACCOUNTANT_TEXT = 'Передайте бухгалтеру реквизиты для выплат: копию свидетельства ИП (или выписку из реестра), БИН/ИИН, банковские реквизиты (БИК, IBAN, наименование банка). Выплаты — с 1 по 10 число. По вопросам начислений пишите бухгалтеру (контакт — у HR).';

  useEffect(() => {
    api.get<{ instruction_accountant?: string }>('/api/integrations/links')
      .then((l) => setAcctInstruction(l.instruction_accountant || ''))
      .catch(() => { /* не критично */ });
  }, []);

  const INFO_MODALS: Record<string, { title: string; sub?: string; body: string; taskId?: string }> = {
    mbusiness: {
      title: 'MBusiness — открытие счёта',
      sub: 'Необходим для получения зарплаты',
      body: 'MBusiness нужен для того, чтобы вы своевременно получали выплаты за работу. Деньги поступают раз в месяц с 1 по 10 число.\n\nПомощь: При возникновении вопросов на этапе открытия счёта вам оперативно поможет ваш HR-менеджер.',
      taskId: '1-mbusiness',
    },
    accountant: {
      title: 'Доступ бухгалтеру',
      sub: 'Предоставление реквизитов бухгалтерской службе',
      body: acctInstruction || DEFAULT_ACCOUNTANT_TEXT,
      taskId: '1-accountant',
    },
    proxy: {
      title: 'Прокси-карта и Face ID (Транспортный доступ)',
      sub: 'Доступ в коворкинг, Технопарк и MSpace',
      body: 'Для получения физического пропуска/Face ID на первый этаж, в коворкинг, Технопарк или MSpace.\n\nЗапрос оформляется через вашего Team Lead или PM. Свяжитесь с руководителем для подачи заявки.',
      taskId: '1-proxy',
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
      <SlaBanner />

      {/* ── Шаг 1 ── */}
      <section className={`s1-step ${effectiveOpen === 1 ? 'open' : ''}`}>
        <StepHeader n={1} title="Подписание документов" reward="5 баллов" desc="Откройте каждый документ, ознакомьтесь и подтвердите прочтение" open={effectiveOpen === 1} done={step1Done} onToggle={() => toggleStep(1)} />
        <div className="s1-step-body">
        <div className="pkg-card">
          <div className="pkg-head">
            <span className="pkg-ico"><FolderCheck size={20} /></span>
            <div>
              <div className="pkg-title">Пакет документов</div>
              <div className="pkg-sub">Откройте каждый документ и подтвердите прочтение</div>
            </div>
          </div>
          <ul className="pkg-list">
            {DOCS_PACKAGE.map((d, i) => {
              const st = done.includes(d.id) ? 'done' : 'todo';
              return (
                <li key={d.id} className={`pkg-item ${st}`}>
                  <button type="button" className="pkg-item-row" onClick={() => setOpen(d.kind)}>
                    <span className="pkg-item-ico"><d.Icon size={15} /></span>
                    <span className="pkg-item-body"><b>{i + 1}. {d.title}</b><span>{d.sub}</span></span>
                    <span className="pkg-item-st">{st === 'done' ? <CircleCheck size={16} /> : <span className="pkg-dot" />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {step1Done ? (
            <div className="pkg-status done"><CircleCheck size={20} /><div><b>Выполнено — шаг 1 пройден</b><span>+5 баллов начислено</span></div></div>
          ) : (
            <div className="pkg-hint">Откройте каждый документ и подтвердите прочтение</div>
          )}
        </div>
        </div>
      </section>

      {/* ── Шаг 2 ── */}
      <section className={`s1-step ${effectiveOpen === 2 ? 'open' : ''}`}>
        <StepHeader n={2} title="Получение доступов" reward="0 баллов" desc="Ознакомьтесь с каждым доступом и нажмите «Готово»" open={effectiveOpen === 2} done={step2Done} onToggle={() => toggleStep(2)} />
        <div className="s1-step-body">
        <div className="step-grid">
          <div className="doc-card svc-card" onClick={() => !isTaskDone('1-mbusiness') && setOpenInfo(INFO_MODALS.mbusiness)} style={{ cursor: isTaskDone('1-mbusiness') ? 'default' : 'pointer' }}>
            <div className="dc-icon"><img src="/mbusiness-logo.png" alt="MBusiness" width={28} height={28} loading="lazy" decoding="async" style={{ objectFit: 'contain' }} /></div>
            <div className="dc-body" style={{ flex: 1 }}>
              <div className="dc-title">MBusiness — открытие {isTaskDone('1-mbusiness') && <span className="dc-badge">выполнено</span>}</div>
              <div className="dc-sub">Нажмите чтобы узнать подробнее</div>
            </div>
            <button type="button" className="dc-info-icon" onClick={(e) => { e.stopPropagation(); setOpenInfo(INFO_MODALS.mbusiness); }} aria-label="Подробнее"><Info size={14} /></button>
          </div>
          <div className="doc-card svc-card" onClick={() => !isTaskDone('1-accountant') && setOpenInfo(INFO_MODALS.accountant)} style={{ cursor: isTaskDone('1-accountant') ? 'default' : 'pointer' }}>
            <div className="dc-icon"><ClipboardCheck size={16} /></div>
            <div className="dc-body" style={{ flex: 1 }}>
              <div className="dc-title">Доступ бухгалтеру {isTaskDone('1-accountant') && <span className="dc-badge">выполнено</span>}</div>
              <div className="dc-sub">Нажмите чтобы узнать подробнее</div>
            </div>
            <button type="button" className="dc-info-icon" onClick={(e) => { e.stopPropagation(); setOpenInfo(INFO_MODALS.accountant); }} aria-label="Подробнее"><Info size={14} /></button>
          </div>
          <div className="doc-card svc-card" onClick={() => !isTaskDone('1-proxy') && setOpenInfo(INFO_MODALS.proxy)} style={{ cursor: isTaskDone('1-proxy') ? 'default' : 'pointer' }}>
            <div className="dc-icon"><KeyRound size={16} /></div>
            <div className="dc-body" style={{ flex: 1 }}>
              <div className="dc-title">Прокси-карта и Face ID {isTaskDone('1-proxy') && <span className="dc-badge">выполнено</span>}</div>
              <div className="dc-sub">Нажмите чтобы узнать подробнее</div>
            </div>
            <button type="button" className="dc-info-icon" onClick={(e) => { e.stopPropagation(); setOpenInfo(INFO_MODALS.proxy); }} aria-label="Подробнее"><Info size={14} /></button>
          </div>
          <div className="doc-card tg-card">
              <div className={`dc-icon ${isTaskDone('1-telegram') ? 'dc-done' : ''}`}>{isTaskDone('1-telegram') ? <CircleCheck size={16} /> : <Send size={16} />}</div>
            <div className="dc-body" style={{ flex: 1 }}>
              <div className="dc-title">Доступ в Telegram-группы {isTaskDone('1-telegram') && <span className="dc-badge">готово</span>}{user?.email === 'demo@mdigital.kg' ? <span className="dc-badge">демо: все группы</span> : myRole ? <span className="dc-badge">{myRole}</span> : null}</div>
              {!isTaskDone('1-telegram') && (
                <div className="tg-hint">1. Откройте бота по ссылке и нажмите Start. 2. Нажмите «Добавить меня в группы» — бот добавит вас во все группы.</div>
              )}
              {isTaskDone('1-telegram') ? (
                <>
                  <div className="dc-sub">Вы добавлены в группы:</div>
                  <div className="tg-groups">{(tgAdded.length ? tgAdded : tgGroups.map((g) => g.title)).map((t) => (<div key={t} className="tg-group-row"><span>• {t}</span></div>))}</div>
                  <div className="dc-sub">Не забудьте представиться команде! Шаблон приветствия:</div>
                </>
              ) : (
                <div className="tg-form-block">
                  {tgGroups.length > 0 ? (
                    <>
                      <div className="tg-chk-list">
                        {tgGroups.map((g) => (
                          <label key={g.chat_id} className="tg-chk" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={tgSelected[g.chat_id] ?? true} onChange={e => setTgSelected(prev => ({ ...prev, [g.chat_id]: e.target.checked }))} />
                            <span className="tg-chk-label">{g.title}</span>
                            {tgAdded.includes(g.title) ? <span className="wifi-ok">✓</span> : tgFailed[g.title] ? <span className="wifi-err">{tgFailed[g.title]}</span> : tgSkipped.includes(g.title) ? <span className="tg-skip">пропущена (бот не админ)</span> : null}
                          </label>
                        ))}
                      </div>
                      <div className="tg-btn-row">
                        <button type="button" className="tg-btn-primary" onClick={handleTgAutoAdd} disabled={tgAdding}>{tgAdding ? 'Добавляем…' : 'Добавить меня в группы'}</button>
                        <a href={`https://t.me/onboarding_admin_bot?start=uid_${user?.id ?? ''}`} target="_blank" rel="noopener noreferrer" className="tg-btn-secondary" onClick={e => e.stopPropagation()}>Открыть бота →</a>
                      </div>
                    </>
                  ) : <div className="wifi-err">Групп для вашей роли ({myRole || '—'}) пока нет — обратитесь к HR</div>}
                </div>
              )}
              <div className="tg-greet">
                <div className="tg-greet-title">Шаблон приветствия:</div>
                <div className="tg-greet-wrap">
                  <textarea className="wifi-input tg-textarea" rows={2} value={tgGreet} onChange={e => setTgGreet(e.target.value)} onClick={e => e.stopPropagation()} aria-label="Текст приветствия" />
                  <button type="button" className={`tg-copy-inside${tgCopied ? ' tg-copied' : ''}`} onClick={handleTgCopy} title="Копировать">{tgCopied ? <Check size={13} /> : <Copy size={13} />}</button>
                </div>
              </div>
              {tgInvites.length > 0 && (
                <div className="tg-groups">
                  <div className="tg-greet-title">Не вышло автоматически — вступите по ссылкам:</div>
                  {tgInvites.map((l) => (<div key={l.title} className="tg-group-row"><span>{l.title}</span><a href={l.url} target="_blank" rel="noopener noreferrer" className="wifi-btn" style={{ textDecoration: 'none' }}>Открыть приглашение</a></div>))}
                </div>
              )}
              {tgMsg && <div className={tgMsg.includes('✓') ? 'wifi-ok' : 'wifi-err'}>{tgMsg}</div>}
            </div>
            <button type="button" className="dc-info-icon" onClick={(e) => { e.stopPropagation(); setOpenInfo(INFO_MODALS.telegram); }} aria-label="Подробнее"><Info size={14} /></button>
          </div>
          {accessServices.map((s) => (
            <div key={s.key} className="doc-card svc-card" onClick={() => s.task_id && !isTaskDone(s.task_id) && handleInfoRead(s.task_id)} style={{ cursor: s.task_id && !isTaskDone(s.task_id) ? 'pointer' : 'default' }}>
              <div className="dc-icon"><ServiceIcon icon_key={s.icon_key} /></div>
              <div className="dc-body" style={{ flex: 1 }}>
                <div className="dc-title">{s.title} {s.task_id && isTaskDone(s.task_id) && <span className="dc-badge">выполнено</span>}</div>
                <div className="dc-sub">{s.subtitle}</div>
                {s.url ? (
                  <button type="button" className="svc-open-btn" onClick={(e) => { e.stopPropagation(); window.open(s.url, '_blank', 'noopener,noreferrer'); if (s.task_id && !isTaskDone(s.task_id)) handleInfoRead(s.task_id); }}>
                    <ExternalLink size={14} /> Открыть — {s.title}
                  </button>
                ) : <span className="wifi-err">Ссылка не настроена</span>}
              </div>
              {s.details && <button type="button" className="dc-info-icon" onClick={(e) => { e.stopPropagation(); setOpenInfo({ title: s.title, sub: s.subtitle, body: s.details, taskId: s.task_id ?? undefined }); }} aria-label="Подробнее"><Info size={14} /></button>}
            </div>
          ))}
          <div className="doc-card wifi-card" onClick={() => !isTaskDone('1-wifi') && setOpen('wifi')} style={{ cursor: isTaskDone('1-wifi') ? 'default' : 'pointer' }}>
            <div className={`dc-icon ${isTaskDone('1-wifi') ? 'dc-done' : ''}`}>{isTaskDone('1-wifi') ? <CircleCheck size={16} /> : <Wifi size={16} />}</div>
            <div className="dc-body" style={{ flex: 1 }}>
              <div className="dc-title">Доступ к Wi-Fi (Закрытая сеть) {isTaskDone('1-wifi') && <span className="dc-badge">готово</span>}</div>
              <div className="dc-sub">Откройте инструкцию по подключению к корпоративному Wi-Fi</div>
            </div>
            <button type="button" className="dc-info-icon" onClick={(e) => { e.stopPropagation(); if (!isTaskDone('1-wifi')) setOpen('wifi'); }} aria-label="Подробнее"><Info size={14} /></button>
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
              <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className={`mpulse-dl ${s.icon_key === 'Apple' ? 'apple' : 'google'}`}>
                {s.icon_key === 'Apple' ? <Apple size={14} /> : <Smartphone size={14} />}
                <span>{s.title}</span>
              </a>
            ))}
          </div>
          <div className="mpulse-verify" onClick={() => !step3Done && setOpen('mplus')} style={{ cursor: step3Done ? 'default' : 'pointer' }}>
            {step3Done ? (
              <div className="mpulse-verify-done">
                <CircleCheck size={18} />
                <span>MPulse настроен ✓</span>
              </div>
            ) : (
              <>
                <div className="mpulse-verify-title">
                  <span className="mpulse-verify-ico">🔑</span>
                  Откройте инструкцию по настройке MPulse
                </div>
                <div className="mpulse-verify-sub">Прочитайте инструкцию до конца и подтвердите — этап зачтётся автоматически</div>
              </>
            )}
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

      {open !== null && (
        <DocumentModal
          kind={open}
          open={open !== null}
          onClose={() => setOpen(null)}
          alreadyDone={(docToTask as Record<string, string>)[open] ? done.includes((docToTask as Record<string, string>)[open]) : false}
          onConfirm={() => { const tid = (docToTask as Record<string, string>)[open]; if (tid) handleInfoRead(tid); }}
        />
      )}
      {openInfo && (
        <ServiceModal
          title={openInfo.title}
          sub={openInfo.sub}
          body={openInfo.body}
          onClose={() => setOpenInfo(null)}
          onConfirm={openInfo.taskId ? () => handleInfoRead(openInfo.taskId as string) : undefined}
          alreadyDone={openInfo.taskId ? done.includes(openInfo.taskId) : undefined}
        />
      )}

    <style>{`
  .stage-content.s1-steps {
    --blue: #3B82F6;
    --blue-hi: #60A5FA;
    --blue-soft: rgba(59, 130, 246, 0.09);
    --blue-line: rgba(96, 165, 250, 0.22);

    --ok: #34D399;
    --ok-soft: rgba(52, 211, 153, 0.09);
    --ok-line: rgba(52, 211, 153, 0.22);

    --warn: #FBBF24;
    --warn-soft: rgba(251, 191, 36, 0.07);
    --warn-line: rgba(251, 191, 36, 0.20);

    --err: #F87171;
    --err-soft: rgba(248, 113, 113, 0.07);
    --err-line: rgba(248, 113, 113, 0.22);

    --ink-1: rgba(255, 255, 255, 0.93);
    --ink-2: rgba(255, 255, 255, 0.62);
    --ink-3: rgba(255, 255, 255, 0.40);

    --surface-0: rgba(255, 255, 255, 0.016);
    --surface-1: rgba(255, 255, 255, 0.028);
    --surface-2: rgba(255, 255, 255, 0.045);

    --hair-0: rgba(255, 255, 255, 0.055);
    --hair-1: rgba(255, 255, 255, 0.09);

    --mono: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace;

    --r-xs: 6px; --r-sm: 8px; --r-md: 10px; --r-lg: 14px; --r-full: 999px;
    --ease: cubic-bezier(0.16, 1, 0.3, 1);

    display: flex; flex-direction: column;
    gap: 14px; margin-bottom: 6px;
    font-family: 'Inter', 'Open Sans', -apple-system, sans-serif;
    font-feature-settings: 'cv11', 'tnum';
    -webkit-font-smoothing: antialiased;
    -webkit-tap-highlight-color: transparent;
  }
  .stage-content .font-orbitron {
    font-family: 'Inter', 'Open Sans', sans-serif !important;
    letter-spacing: 0.01em;
  }

  /* ═══════════════════════════════════════════════════════════════
     SLA — SlaBanner component handles its own inline styles
  ═══════════════════════════════════════════════════════════════ */

  /* ═══════════════════════════════════════════════════════════════
     STEP
  ═══════════════════════════════════════════════════════════════ */
  .s1-step {
    padding: 16px;
    border-radius: var(--r-lg);
    background: var(--surface-0);
    border: 1px solid var(--hair-0);
    display: flex; flex-direction: column; gap: 14px;
    transition: border-color 0.25s var(--ease), background 0.25s var(--ease);
  }
  .s1-step.open { background: var(--surface-1); border-color: var(--blue-line); }
  .s1-step.done { border-color: var(--ok-line); }
  .s1-step-body { display: flex; flex-direction: column; gap: 12px; }

  .step-head {
    display: flex; gap: 12px;
    align-items: flex-start;
    cursor: pointer;
    touch-action: manipulation;
  }
  .step-head:active { transform: scale(0.998); }
  .sh-num {
    width: 26px; height: 26px;
    border-radius: var(--r-sm);
    display: grid; place-items: center;
    flex-shrink: 0;
    font-size: 11.5px; font-weight: 700;
    letter-spacing: -0.01em;
    color: #fff;
    background: var(--blue);
    transition: background 0.3s var(--ease);
  }
  .s1-step.done .sh-num { background: var(--ok); }
  .sh-body { flex: 1; min-width: 0; }
  .sh-title {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    font-size: 13.5px; font-weight: 650;
    letter-spacing: -0.012em;
    color: var(--ink-1);
    line-height: 1.35;
  }
  .s1-step.done .sh-title { color: #A7F3D0; }
  .sh-reward {
    font-size: 10px; font-weight: 600;
    letter-spacing: 0.04em;
    padding: 2px 7px;
    border-radius: var(--r-full);
    color: #FCD34D;
    background: rgba(251, 191, 36, 0.07);
    border: 1px solid rgba(251, 191, 36, 0.16);
    white-space: nowrap;
  }
  .sh-desc {
    font-size: 11.5px; color: var(--ink-3);
    margin-top: 5px; line-height: 1.5;
  }
  .sh-chevron {
    margin-left: auto; display: none;
    color: var(--ink-3); flex-shrink: 0;
    transition: transform 0.3s var(--ease), color 0.2s ease;
  }
  @media (min-width: 641px) {
    .sh-chevron { display: block; }
    .s1-step.open .sh-chevron { transform: rotate(180deg); color: var(--blue-hi); }
  }

  /* ═══════════════════════════════════════════════════════════════
     PACKAGE
  ═══════════════════════════════════════════════════════════════ */
  .pkg-card {
    display: flex; flex-direction: column; gap: 10px;
    padding: 12px;
    border-radius: var(--r-md);
    background: rgba(59, 130, 246, 0.03);
    border: 1px solid rgba(96, 165, 250, 0.12);
  }
  .pkg-head { display: flex; gap: 10px; align-items: center; }
  .pkg-ico {
    width: 30px; height: 30px;
    border-radius: var(--r-sm);
    display: grid; place-items: center;
    flex-shrink: 0;
    color: #BFDBFE;
    background: var(--blue-soft);
    border: 1px solid var(--blue-line);
  }
  .pkg-title { font-size: 13px; font-weight: 650; letter-spacing: -0.01em; color: var(--ink-1); }
  .pkg-sub { font-size: 11.5px; color: var(--ink-3); margin-top: 3px; line-height: 1.45; }

  .pkg-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .pkg-item {
    border-radius: var(--r-sm);
    background: rgba(255, 255, 255, 0.016);
    border: 1px solid var(--hair-0);
    overflow: hidden;
    transition: border-color 0.2s ease, background 0.2s ease;
  }
  .pkg-item:hover { background: var(--surface-2); }
  .pkg-item.done { border-color: var(--ok-line); }
  .pkg-item.pending { border-color: var(--warn-line); border-style: dashed; }
  .pkg-item-row {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 9px 11px;
    background: none; border: none; color: inherit;
    cursor: pointer; text-align: left; font: inherit;
  }
  .pkg-item-ico {
    width: 20px; height: 20px;
    border-radius: 50%;
    display: grid; place-items: center;
    flex-shrink: 0;
    background: transparent;
    border: 1.5px dashed rgba(165, 180, 252, 0.26);
    color: #C7D2FE;
    transition: all 0.3s var(--ease);
  }
  .pkg-item.done .pkg-item-ico { background: var(--ok); border: 1.5px solid var(--ok); color: #052E1B; }
  .pkg-item.pending .pkg-item-ico { background: var(--warn-soft); border: 1.5px dashed var(--warn-line); color: var(--warn); }
  .pkg-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .pkg-item-body b { font-size: 12px; font-weight: 600; color: var(--ink-1); }
  .pkg-item-body span { font-size: 11px; color: var(--ink-3); line-height: 1.35; }
  .pkg-item-st { display: grid; place-items: center; flex-shrink: 0; color: #6EE7B7; }
  .pkg-item.done .pkg-item-st svg { animation: checkPop 0.4s var(--ease) both; }
  @keyframes checkPop {
    0% { transform: scale(0); opacity: 0; }
    60% { transform: scale(1.15); }
    100% { transform: scale(1); opacity: 1; }
  }
  .pkg-item.pending .pkg-item-st { color: var(--warn); animation: pendingPulse 2s ease-in-out infinite; }
  @keyframes pendingPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .pkg-dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px dashed rgba(165, 180, 252, 0.38); }
  .pkg-chev { color: var(--ink-3); flex-shrink: 0; transition: transform 0.25s var(--ease); }
  .pkg-chev.open { transform: rotate(180deg); }
  .pkg-detail {
    font-size: 11px; color: var(--ink-2); line-height: 1.6;
    padding: 8px 12px 10px 42px;
    border-top: 1px dashed rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.12);
    animation: detailIn 0.25s var(--ease);
  }
  @keyframes detailIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
  .pkg-status {
    display: flex; gap: 10px; align-items: center;
    padding: 10px 12px;
    border-radius: var(--r-sm);
    font-size: 11.5px; line-height: 1.45;
  }
  .pkg-status b { display: block; font-size: 12px; font-weight: 600; }
  .pkg-status span { display: block; font-size: 11px; margin-top: 1px; color: var(--ink-3); }
  .pkg-status.done { border: 1px solid var(--ok-line); background: var(--ok-soft); color: #A7F3D0; }
  .pkg-status.pending { border: 1px solid var(--warn-line); background: var(--warn-soft); color: #FDE68A; }
  .pkg-status.rejected { border: 1px solid var(--err-line); background: var(--err-soft); color: #FCA5A5; }

  /* ═══════════════════════════════════════════════════════════════
     BUTTONS (shared)
  ═══════════════════════════════════════════════════════════════ */
  .pkg-submit,
  .wifi-btn,
  .mpulse-btn,
  .tg-btn-primary,
  .tg-btn-secondary,
  .cf-confirm {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: var(--r-sm);
    border: 1px solid var(--blue-line);
    cursor: pointer;
    font-family: inherit;
    font-size: 11.5px; font-weight: 500;
    letter-spacing: 0; text-transform: none;
    color: #DBEAFE;
    background: var(--blue-soft);
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    white-space: nowrap;
  }
  .pkg-submit:hover,
  .wifi-btn:hover,
  .mpulse-btn:hover,
  .tg-btn-primary:hover,
  .tg-btn-secondary:hover,
  .cf-confirm:hover {
    background: rgba(59, 130, 246, 0.16);
    border-color: rgba(96, 165, 250, 0.38);
    color: #fff;
  }
  .pkg-submit:active,
  .wifi-btn:active,
  .mpulse-btn:active,
  .tg-btn-primary:active,
  .tg-btn-secondary:active,
  .cf-confirm:active { transform: scale(0.97); }
  .pkg-submit:disabled,
  .wifi-btn:disabled,
  .mpulse-btn:disabled,
  .tg-btn-primary:disabled,
  .cf-confirm:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .pkg-submit, .tg-btn-primary {
    background: var(--blue); border-color: var(--blue); color: #fff; font-weight: 600;
  }
  .pkg-submit:hover, .tg-btn-primary:hover { background: #2563EB; border-color: #2563EB; }

  .tg-btn-secondary, .mpulse-btn, .wifi-btn {
    background: transparent;
    border-color: var(--hair-1);
    color: var(--ink-2);
  }
  .tg-btn-secondary:hover, .mpulse-btn:hover, .wifi-btn:hover {
    background: var(--blue-soft);
    border-color: var(--blue-line);
    color: var(--ink-1);
  }

  /* ═══════════════════════════════════════════════════════════════
     SEGMENTED INPUT (Wi-Fi / Telegram)
  ═══════════════════════════════════════════════════════════════ */
  .wifi-inline {
    display: flex; align-items: center;
    gap: 2px; padding: 2px;
    border-radius: var(--r-sm);
    background: rgba(0, 0, 0, 0.24);
    border: 1px solid var(--hair-0);
    transition: border-color 0.18s ease, background 0.18s ease;
  }
  .wifi-inline:focus-within { border-color: var(--blue-line); background: rgba(0, 0, 0, 0.32); }
  .wifi-input {
    flex: 1; min-width: 0;
    padding: 6px 10px;
    border: none; border-radius: 6px;
    background: transparent; color: #fff;
    font-family: inherit; font-size: 12px; font-weight: 450;
    outline: none; font-variant-numeric: tabular-nums;
  }
  .wifi-input::placeholder { color: rgba(148, 163, 184, 0.5); }
  .wifi-input:focus { background: rgba(255, 255, 255, 0.025); }
  .wifi-inline .wifi-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border-color: transparent;
  }
  .wifi-inline .wifi-btn:hover { border-color: transparent; background: rgba(59, 130, 246, 0.16); }

  /* ═══════════════════════════════════════════════════════════════
     DOC CARDS
  ═══════════════════════════════════════════════════════════════ */
  .step-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }
  .doc-card {
    position: relative;
    display: flex; flex-direction: column;
    gap: 10px; padding: 12px;
    border-radius: var(--r-md);
    background: var(--surface-0);
    border: 1px solid var(--hair-0);
    transition: border-color 0.2s ease, background 0.2s ease;
  }
  .doc-card:hover { border-color: var(--blue-line); background: var(--surface-1); }
  .svc-card:hover { border-color: rgba(59,130,246,.25); background: rgba(59,130,246,.03); }
  .doc-card > * { position: relative; z-index: 1; }

  .wifi-card { border-color: rgba(96, 165, 250, 0.12); }
  .wifi-card.dc-done { border-color: var(--ok-line); }

  .dc-icon {
    width: 48px; height: 48px;
    border-radius: 12px;
    display: grid; place-items: center;
    flex-shrink: 0;
    background: var(--blue-soft);
    border: 1px solid var(--blue-line);
    color: #BFDBFE;
    pointer-events: none;
    transition: all 0.25s var(--ease);
    padding: 8px;
    box-sizing: border-box;
  }
  .dc-icon.dc-done { background: var(--ok-soft); border-color: var(--ok-line); color: var(--ok); }
  .dc-icon img { width: 100% !important; height: 100% !important; object-fit: contain; display: block; }

  .dc-body { display: flex; flex-direction: column; gap: 6px; padding-right: 30px; }
  .dc-title {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: 12.5px; font-weight: 600;
    letter-spacing: -0.005em;
    color: var(--ink-1); line-height: 1.35;
  }
  .dc-sub { font-size: 11.5px; color: var(--ink-2); line-height: 1.45; }
  .dc-badge {
    font-size: 9px; font-weight: 600;
    letter-spacing: 0.04em;
    padding: 2px 6px;
    border-radius: var(--r-full);
    background: var(--ok-soft);
    border: 1px solid var(--ok-line);
    color: #6EE7B7;
  }
  .dc-badge.pending { background: var(--warn-soft); border-color: var(--warn-line); color: #FCD34D; }
  .dc-info-icon {
    position: absolute;
    top: 8px; right: 8px;
    z-index: 2;
    width: 26px; height: 26px;
    border-radius: 50%;
    display: grid; place-items: center;
    background: transparent;
    border: 1px solid var(--hair-0);
    color: var(--ink-3);
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .dc-info-icon:hover { background: var(--blue-soft); border-color: var(--blue-line); color: var(--blue-hi); }

  /* ═══════════════════════════════════════════════════════════════
     NOTICES
  ═══════════════════════════════════════════════════════════════ */
  .wifi-ok, .wifi-err {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11px; font-weight: 500;
    padding: 6px 10px;
    border-radius: 6px;
    line-height: 1.4;
    animation: noticeIn 0.25s var(--ease);
  }
  @keyframes noticeIn { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
  .wifi-ok { background: var(--ok-soft); border: 1px solid var(--ok-line); color: #A7F3D0; }
  .wifi-err { background: var(--err-soft); border: 1px solid var(--err-line); color: #FCA5A5; }
  .tg-skip {
    display: inline-flex; align-items: center;
    font-size: 10.5px; font-weight: 500; color: #94A3B8;
    padding: 4px 8px; border-radius: 6px;
    background: rgba(148, 163, 184, 0.08); border: 1px solid rgba(148, 163, 184, 0.2);
    line-height: 1.4;
  }
  .svc-open-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 35px; padding: 6px 14px; margin-top: 10px;
    border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.45);
    background: linear-gradient(90deg, rgba(30, 58, 138, 0.55), rgba(37, 99, 235, 0.55));
    color: #fff; font-size: 12.5px; font-weight: 700; letter-spacing: 0.02em;
    cursor: pointer; transition: filter 0.15s ease, transform 0.1s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .svc-open-btn:hover { filter: brightness(1.15); }
  .svc-open-btn:active { transform: scale(0.98); }
  .wifi-help-link {
    font-size: 11.5px; font-weight: 500;
    color: var(--blue-hi);
    text-decoration: none; cursor: pointer;
    background: none; border: none; padding: 0;
    display: inline-flex; align-items: center; gap: 3px;
    transition: color 0.15s ease;
  }
  .wifi-help-link:hover { color: #DBEAFE; text-decoration: underline; text-underline-offset: 2px; }
  .wifi-shown {
    display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--ok-soft);
    border: 1px dashed var(--ok-line);
    font-size: 11.5px; color: #A7F3D0;
  }
  .wifi-shown code {
    font-family: var(--mono);
    font-size: 12.5px; color: #fff;
    user-select: all; letter-spacing: 0.02em;
  }

  /* ═══════════════════════════════════════════════════════════════
     TELEGRAM — same shell & typography as other cards
  ═══════════════════════════════════════════════════════════════ */
  .tg-card { border-color: rgba(96, 165, 250, 0.14); }
  .tg-card .dc-icon { /* inherit everything from base .dc-icon */ }
  .tg-hint {
    font-size: 11px;
    line-height: 1.55;
    color: var(--ink-3);
    padding: 6px 0;
    margin-bottom: 2px;
  }

  /* Groups list */
  .tg-groups { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
  .tg-group-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.018);
    border: 1px solid var(--hair-0);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--ink-1);
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .tg-group-row:hover {
    background: rgba(255, 255, 255, 0.035);
    border-color: var(--hair-1);
  }

  .tg-form-block { display: flex; flex-direction: column; gap: 8px; }

  /* Checkbox list — plain, native checkbox, minimal */
  .tg-chk-list { display: flex; flex-direction: column; gap: 4px; }
  .tg-chk {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 10px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.016);
    border: 1px solid var(--hair-0);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--ink-1);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .tg-chk:hover {
    background: var(--blue-soft);
    border-color: var(--blue-line);
  }
  .tg-chk input[type=checkbox] {
    width: 14px; height: 14px;
    accent-color: var(--blue);
    cursor: pointer; flex-shrink: 0;
    margin: 0;
    appearance: auto;
    -webkit-appearance: auto;
  }
  .tg-chk-label { flex: 1; }

  /* Buttons — same base already; no overrides needed */
  .tg-btn-row { display: flex; gap: 6px; flex-wrap: wrap; }

  /* ───────────────────────────────────────────────────────────────
     GREETING — plain layout matching other cards
     Label on top, textarea below, small copy button in corner
  ─────────────────────────────────────────────────────────────── */
  .tg-greet {
    display: flex; flex-direction: column;
    gap: 6px; margin-top: 6px;
  }
  .tg-greet-title {
    display: flex; align-items: center; gap: 6px;
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    color: var(--ink-2);
  }
  .tg-greet-title::before { content: none; }
  .tg-greet-wrap {
    position: relative;
    border-radius: 8px;
  }
  .tg-textarea {
    width: 100%;
    min-height: 68px;
    padding: 10px 40px 10px 12px;
    background: rgba(0, 0, 0, 0.22);
    border: 1px solid var(--hair-0);
    border-radius: 8px;
    color: var(--ink-1);
    font-family: inherit;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.55;
    letter-spacing: 0;
    resize: vertical;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s ease, background 0.15s ease;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .tg-textarea::-webkit-scrollbar { display: none; width: 0; height: 0; }
  .tg-textarea:focus {
    border-color: var(--blue-line);
    background: rgba(0, 0, 0, 0.3);
  }

  /* Small copy button in bottom-right corner of the textarea */
  .tg-copy-inside {
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 24px; height: 24px;
    display: grid; place-items: center;
    padding: 0;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--hair-0);
    border-radius: 6px;
    color: var(--ink-3);
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    z-index: 2;
  }
  .tg-copy-inside svg { width: 12px; height: 12px; }
  .tg-copy-inside::after { content: none; }
  .tg-copy-inside:hover {
    background: var(--blue-soft);
    border-color: var(--blue-line);
    color: var(--blue-hi);
  }
  .tg-copy-inside:active { transform: scale(0.94); }
  .tg-copy-inside.tg-copied { color: #4ADE80; border-color: rgba(34,197,94,.5); background: rgba(34,197,94,.12); }

  /* ═══════════════════════════════════════════════════════════════
     MPULSE CARD
  ═══════════════════════════════════════════════════════════════ */
  .mpulse-step .mpulse-card {
    display: flex; flex-direction: column; gap: 16px;
    padding: 16px;
    border-radius: var(--r-md);
    background: linear-gradient(180deg, rgba(59, 130, 246, 0.04), rgba(59, 130, 246, 0.008));
    border: 1px solid rgba(96, 165, 250, 0.14);
  }
  .mpulse-head { display: flex; gap: 14px; align-items: flex-start; }
  .mpulse-icon-img {
    width: 68px; height: 68px;
    border-radius: 16px;
    object-fit: contain;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--blue-line);
    padding: 10px;
    box-sizing: border-box;
  }
  .mpulse-title { font-size: 14px; font-weight: 650; letter-spacing: -0.012em; color: var(--ink-1); }
  .mpulse-sub { font-size: 11.5px; color: var(--ink-3); margin-top: 4px; line-height: 1.5; }
  .mpulse-list { margin: 0; padding-left: 18px; font-size: 11.5px; color: var(--ink-2); line-height: 1.7; }
  .mpulse-list li::marker { color: var(--blue); }
  .mpulse-list b { color: var(--ink-1); font-weight: 600; }

  /* Store badges */
  .mpulse-links { display: flex; gap: 10px; flex-wrap: wrap; }
  .mpulse-dl {
    position: relative;
    display: inline-flex; align-items: center; gap: 10px;
    padding: 8px 16px 8px 12px;
    border-radius: 10px;
    font-size: 11px; font-weight: 500;
    text-decoration: none; color: #fff;
    background: #0A0A0A;
    border: 1px solid rgba(255, 255, 255, 0.10);
    transition: transform 0.15s ease, filter 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    line-height: 1.1;
  }
  .mpulse-dl:hover { filter: brightness(1.18); }
  .mpulse-dl:active { transform: scale(0.98); }
  .mpulse-dl > svg { display: none; }
  .mpulse-dl::before {
    content: '';
    width: 22px; height: 22px;
    background-repeat: no-repeat; background-position: center; background-size: contain;
    flex-shrink: 0;
  }
  .mpulse-dl span {
    display: flex; flex-direction: column; gap: 1px;
    font-size: 12.5px; font-weight: 600; letter-spacing: 0.01em;
  }
  .mpulse-dl span::before {
    font-size: 8.5px; font-weight: 500;
    letter-spacing: 0.10em; text-transform: uppercase;
    opacity: 0.72;
  }
  .mpulse-dl.google span::before { content: 'GET IT ON'; }
  .mpulse-dl.apple  span::before { content: 'Download on the'; letter-spacing: 0.04em; text-transform: none; font-size: 9.5px; }
  .mpulse-dl.google::before {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%2300E0FF' d='M3.6 1.8a1 1 0 0 0-.35.75v18.9a1 1 0 0 0 .35.75l10.4-10.2L3.6 1.8z'/><path fill='%23FFE000' d='M17.7 15.9l-3.7-3.9 3.7-3.9 4.05 2.3c1.15.66 1.15 1.75 0 2.4L17.7 15.9z'/><path fill='%23FF3A44' d='M17.7 15.9L14 12l-10.4 10.2c.36.36.9.42 1.55.04l12.55-6.34z'/><path fill='%2300C853' d='M17.7 8.1L5.15 1.76C4.5 1.38 3.96 1.44 3.6 1.8L14 12l3.7-3.9z'/></svg>");
  }
  .mpulse-dl.apple::before {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23fff' d='M17.05 12.54c-.02-2.1 1.72-3.11 1.8-3.16-.98-1.44-2.51-1.63-3.05-1.66-1.3-.13-2.53.76-3.19.76-.66 0-1.67-.74-2.74-.72-1.41.02-2.71.82-3.43 2.08-1.46 2.53-.37 6.28 1.05 8.34.7.99 1.52 2.1 2.6 2.06 1.05-.04 1.44-.67 2.71-.67 1.26 0 1.62.67 2.73.65 1.13-.02 1.85-1.01 2.54-2 .8-1.14 1.13-2.25 1.15-2.31-.03-.01-2.2-.85-2.22-3.37zm-2.1-6.13c.58-.71.97-1.68.86-2.65-.84.03-1.85.56-2.45 1.26-.53.62-1 1.61-.87 2.56.94.07 1.9-.47 2.46-1.17z'/></svg>");
  }

  /* ───────────────────────────────────────────────────────────────
     MPULSE VERIFY — compact, matched pair
     Desktop/tablet: 36px. Mobile: 42px.
  ─────────────────────────────────────────────────────────────── */
  .mpulse-verify {
    padding: 14px;
    border-radius: var(--r-md);
    background: rgba(0, 0, 0, 0.22);
    border: 1px solid var(--blue-line);
    display: flex; flex-direction: column;
    gap: 10px;
  }
  .mpulse-verify-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 12.5px; font-weight: 600;
    color: var(--ink-1);
  }
  .mpulse-verify-ico {
    display: grid; place-items: center;
    width: 22px; height: 22px;
    border-radius: 6px;
    background: var(--blue-soft);
    border: 1px solid var(--blue-line);
    font-size: 11px; flex-shrink: 0;
  }
  .mpulse-verify-sub { font-size: 11.5px; color: var(--ink-3); line-height: 1.5; }

  .mpulse-row {
    display: flex; flex-direction: column;
    gap: 6px;
  }
  .mpulse-input,
  .mpulse-btn {
    width: 100%;
    height: 36px;
    box-sizing: border-box;
    padding: 0 14px;
    border-radius: 7px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
    outline: none;
    transition: all 0.18s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .mpulse-input {
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid var(--hair-0);
    color: #fff;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .mpulse-input::placeholder { color: rgba(148, 163, 184, 0.45); letter-spacing: 0.02em; }
  .mpulse-input:focus {
    border-color: var(--blue);
    background: rgba(0, 0, 0, 0.36);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
  }
  .mpulse-btn {
    background: var(--blue);
    border: 1px solid var(--blue);
    color: #fff;
    cursor: pointer;
    font-weight: 600;
  }
  .mpulse-btn:hover { background: #2563EB; border-color: #2563EB; }
  .mpulse-btn:active { transform: scale(0.985); }
  .mpulse-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .mpulse-verify-done {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 10px 14px;
    border-radius: 8px;
    background: var(--ok-soft);
    border: 1px solid var(--ok-line);
    color: #A7F3D0;
    font-size: 11.5px; font-weight: 600;
    align-self: flex-start;
  }
  .mpulse-msg {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; font-weight: 500;
    padding: 7px 10px;
    border-radius: 6px;
    animation: noticeIn 0.25s var(--ease);
  }
  .mpulse-msg.ok { background: var(--ok-soft); border: 1px solid var(--ok-line); color: #A7F3D0; }
  .mpulse-msg.err { background: var(--err-soft); border: 1px solid var(--err-line); color: #FCA5A5; }

  /* ═══════════════════════════════════════════════════════════════
     CONFLUENCE
  ═══════════════════════════════════════════════════════════════ */
  .cf-links { display: flex; flex-direction: column; gap: 8px; }
  .confluence-link {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px;
    border-radius: var(--r-md);
    background: var(--surface-0);
    border: 1px solid var(--hair-0);
    text-decoration: none; color: inherit;
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.15s ease;
  }
  .confluence-link:hover { border-color: var(--blue-line); background: var(--surface-1); }
  .confluence-link.seen { border-color: var(--ok-line); background: rgba(52, 211, 153, 0.028); }
  .cf-icon {
    width: 28px; height: 28px;
    border-radius: 7px;
    display: grid; place-items: center;
    flex-shrink: 0;
    font-size: 10.5px; font-weight: 700;
    letter-spacing: 0.02em;
    background: var(--blue-soft);
    border: 1px solid var(--blue-line);
    color: #BFDBFE;
    transition: all 0.25s var(--ease);
  }
  .confluence-link.seen .cf-icon { background: var(--ok-soft); border-color: var(--ok-line); color: var(--ok); }
  .cf-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .cf-title { font-size: 12px; font-weight: 600; letter-spacing: -0.005em; color: var(--ink-1); }
  .cf-sub { font-size: 11px; color: var(--ink-3); line-height: 1.4; }
  .cf-arrow { color: var(--ink-3); flex-shrink: 0; transition: transform 0.2s var(--ease), color 0.15s ease; }
  .confluence-link:hover .cf-arrow { transform: translateX(3px); color: var(--blue-hi); }
  .cf-progress {
    display: block;
    font-size: 11px; font-weight: 500;
    color: var(--ink-3);
    text-align: center;
    padding: 7px 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.018);
    border: 1px solid var(--hair-0);
    font-variant-numeric: tabular-nums;
  }
  .cf-confirm { width: 100%; padding: 8px 12px; font-size: 12px; }
  .cf-confirm.done { background: var(--ok-soft); border-color: var(--ok-line); color: #A7F3D0; cursor: default; }
  .cf-hint { font-size: 10.5px; color: var(--ink-3); text-align: center; line-height: 1.45; }

  /* ═══════════════════════════════════════════════════════════════
     BADGES
  ═══════════════════════════════════════════════════════════════ */
  .step-done-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 600;
    color: #A7F3D0;
    padding: 6px 12px;
    border-radius: var(--r-full);
    background: var(--ok-soft);
    border: 1px solid var(--ok-line);
    align-self: flex-start;
    animation: noticeIn 0.3s var(--ease);
  }
  .doc-hint {
    font-size: 11px; font-weight: 500;
    color: var(--ink-3);
    text-align: center;
    padding: 9px 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.014);
    border: 1px dashed var(--hair-1);
  }
  .spin-slow { animation: spin 2.4s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  /* ═══════════════════════════════════════════════════════════════
     RESPONSIVE
  ═══════════════════════════════════════════════════════════════ */
  @media (max-width: 640px) {
    .stage-content.s1-steps { gap: 12px; }
    .step-grid { grid-template-columns: fix-content; }
    .wifi-input { min-height: 34px; font-size: 12.5px; }
    .wifi-btn { min-height: 34px; padding: 6px 12px; }
    .pkg-submit, .cf-confirm { min-height: 34px; }
    .tg-btn-primary, .tg-btn-secondary { min-height: 34px; }
    .pkg-status.rejected { flex-wrap: wrap; }
    .pkg-status.rejected .pkg-submit { margin-left: auto; }
    .s1-step { padding: 13px; gap: 12px; }
    .s1-step-body { gap: 12px; }
    .doc-card, .tg-card { padding: 11px; }
    .confluence-link { padding: 10px 12px; gap: 10px; }
    .mpulse-icon-img { width: 60px; height: 60px; border-radius: 14px; padding: 9px; }
    .dc-icon { width: 44px; height: 44px; padding: 7px; }
    .mpulse-input, .mpulse-btn { height: 35px; font-size: 13px; padding: 0 16px; }
  }
  @media (max-width: 480px) {
    .stage-content.s1-steps { gap: 10px; }
    .s1-step { padding: 12px; }
    .sh-num { width: 24px; height: 24px; font-size: 11px; }
    .sh-title { font-size: 12.5px; }
    .sh-desc { font-size: 11px; }
    .dc-title { font-size: 12px; }
    .dc-sub { font-size: 11px; }
    .pkg-title, .mpulse-title { font-size: 12.5px; }
    .mpulse-sub { font-size: 11px; }
    .cf-icon { width: 26px; height: 26px; font-size: 10px; }
    .cf-title { font-size: 11.5px; }
    .cf-sub { font-size: 10.5px; }
    .wifi-ok, .wifi-err { font-size: 10.5px; padding: 5px 9px; }
    .wifi-inline { padding: 2px; gap: 2px; }
    .wifi-input { padding: 6px 9px; font-size: 12px; }
    .wifi-btn { padding: 6px 10px; font-size: 11px; }
    .pkg-submit, .cf-confirm { padding: 6px 12px; font-size: 11.5px; }
    .mpulse-icon-img { width: 56px; height: 56px; border-radius: 13px; padding: 8px; }
    .dc-icon { width: 40px; height: 40px; padding: 6px; border-radius: 10px; }
    .tg-textarea { min-height: 62px; padding: 9px 36px 9px 11px; font-size: 11.5px; }
    .tg-copy-inside { width: 22px; height: 22px; right: 6px; bottom: 6px; }
    .tg-copy-inside svg { width: 11px; height: 11px; }
    .mpulse-dl { padding: 7px 14px 7px 10px; }
    .mpulse-dl::before { width: 20px; height: 20px; }
    .mpulse-dl span { font-size: 12px; }
  }
  @media (max-width: 380px) {
    .stage-content.s1-steps { gap: 9px; }
    .sh-num { width: 22px; height: 22px; font-size: 10.5px; }
    .s1-step { padding: 11px; }
    .dc-title { font-size: 11.5px; }
    .dc-sub { font-size: 10.5px; }
    .mpulse-verify { padding: 12px; }
    .mpulse-verify-title { font-size: 11.5px; }
    .doc-hint { font-size: 10px; padding: 7px 10px; }
    /* SlaBanner uses inline styles — no mobile overrides needed */
    .mpulse-icon-img { width: 52px; height: 52px; padding: 7px; }
    .dc-icon { width: 38px; height: 38px; padding: 6px; }
    .mpulse-input, .mpulse-btn { height: 30px; font-size: 12.5px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .stage-content.s1-steps *,
    .stage-content.s1-steps *::before,
    .stage-content.s1-steps *::after {
      animation: none !important;
      transition-duration: 0.01ms !important;
    }
  }
    `}</style>
    </div>
  );
}
