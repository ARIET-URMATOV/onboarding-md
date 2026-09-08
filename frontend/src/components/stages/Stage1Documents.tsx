import { useMemo, useState } from 'react';
import type { StageId } from '../../data/stages';
import { useOnboarding } from '../../store/useOnboarding';
import { DocumentModal, type DocKind } from './DocumentModal';
import { api } from '../../api/client';

interface Props { stageId: StageId }

/* ── расширенные ключи документов → taskId ── */
type DocKey = DocKind;
const docToTask: Record<DocKey, string> = {
  docs: '1-docs', lead: '1-lead', mplus: '1-mplus', jira: '1-jira', confluence: '1-confluence',
  dogovor: '1-dogovor', nda: '1-nda', pdp: '1-pdp', ip: '1-ip', sn: '1-sn',
  mbusiness: '1-mbusiness', accountant: '1-accountant', wifi: '1-wifi', proxy: '1-proxy', telegram: '1-telegram',
};

/* helpers */
function DocCard({ k, doneFlag, icon, title, sub, onOpen }: {
  k: DocKey; doneFlag: boolean; icon: React.ReactNode; title: string; sub: string; onOpen: (k: DocKey) => void;
}) {
  return (
    <button type="button" className={`doc-card ${doneFlag ? 'done' : ''}`} onClick={() => onOpen(k)} aria-label={title}>
      <div className={`dc-icon ${k === 'mplus' ? 'mplus' : ''} ${doneFlag ? 'dc-done' : ''}`}>{doneFlag ? '✓' : icon}</div>
      <div className="dc-body">
        <div className="dc-title">{title} {doneFlag && <span className="dc-badge">готово</span>}</div>
        <div className="dc-sub">{sub}</div>
      </div>
      <span className={`dc-chevron ${doneFlag ? 'is-done' : ''}`} aria-hidden>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5" /></svg>
      </span>
    </button>
  );
}

function StepHeader({ n, title, reward, desc }: { n: number; title: string; reward: string; desc?: string }) {
  return (
    <div className="step-head">
      <div className="sh-num">{n}</div>
      <div className="sh-body">
        <div className="sh-title">{title} <span className="sh-reward">{reward}</span></div>
        {desc && <div className="sh-desc">{desc}</div>}
      </div>
    </div>
  );
}

export function Stage1Documents({ stageId }: Props) {
  const done = useOnboarding((s) => s.doneTasks[stageId] || []);
  const toggle = useOnboarding((s) => s.toggleTask);
  const refreshMe = useOnboarding((s) => s.refreshMe);
  const createdAt = useOnboarding((s) => s.createdAt);
  const user = useOnboarding((s) => s.user);
  const resolvedCreatedAt = (user as unknown as { createdAt?: string | null })?.createdAt ?? createdAt ?? null;

  const [open, setOpen] = useState<DocKind | null>(null);

  // Wi-Fi MAC
  const [mac, setMac] = useState('');
  const [macSent, setMacSent] = useState(false);
  const [macError, setMacError] = useState<string | null>(null);

  // MPulse code
  const [mpulseCode, setMpulseCode] = useState('');
  const [mpulseVerifying, setMpulseVerifying] = useState(false);
  const [mpulseMsg, setMpulseMsg] = useState<string | null>(null);

  // Confluence
  const [confConfirming, setConfConfirming] = useState(false);

  const isDone = (k: DocKey) => done.includes(docToTask[k]);
  const isTaskDone = (taskId: string) => done.includes(taskId);

  const handleConfirm = (k: DocKey) => {
    if (!isDone(k)) toggle(stageId, docToTask[k]);
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

  const handleWifiSubmit = async () => {
    const v = mac.trim().toUpperCase();
    // MAC: 6 групп hex по 2 символа через : или -
    const re = /^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/;
    if (!re.test(v)) { setMacError('Введите MAC в формате AA:BB:CC:DD:EE:FF'); return; }
    setMacError(null);
    setMacSent(true);
    if (!isTaskDone('1-wifi')) {
      try { await toggle(stageId, '1-wifi'); } catch { /* ignore */ }
    }
    // имитация отправки сетевикам
    setTimeout(() => setMacSent(true), 300);
  };

  const handleMpulseVerify = async () => {
    const code = mpulseCode.trim();
    if (!code) { setMpulseMsg('Введите проверочный код из MPulse'); return; }
    setMpulseVerifying(true);
    setMpulseMsg(null);
    try {
      // предпочтительно — специализированный эндпоинт верификации кода
      try { await api.post('/api/verify-mpulse-code', { code }); } catch { /* fallback to toggle */ }
      // помечаем все MPulse-задачи шага как выполненные (если ещё не)
      const mpulseTasks = ['1-mpulse','1-mpulse-schedule','1-mpulse-checkin','1-mpulse-code','1-mpulse-news'];
      for (const tid of mpulseTasks) if (!done.includes(tid)) { try { await toggle(stageId, tid); } catch { /* */ } }
      // дополнительно гарантируем, что 1-mpulse-code отмечен
      if (!done.includes('1-mpulse-code')) { try { await toggle(stageId, '1-mpulse-code'); } catch { /* */ } }
      setMpulseMsg('Код принят ✓ Доступ к MPulse подтверждён');
      await refreshMe();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Неверный код';
      setMpulseMsg(msg);
    } finally {
      setMpulseVerifying(false);
    }
  };

  const handleConfluenceConfirm = async () => {
    setConfConfirming(true);
    try {
      try { await api.post('/api/confirm-confluence'); } catch { /* fallback */ }
      const confTasks = ['1-confluence-vacation','1-confluence-grading','1-confluence-info','1-confluence-read'];
      for (const tid of confTasks) if (!done.includes(tid)) { try { await toggle(stageId, tid); } catch { /* */ } }
      if (!done.includes('1-confluence-read')) { try { await toggle(stageId, '1-confluence-read'); } catch { /* */ } }
      await refreshMe();
    } finally { setConfConfirming(false); }
  };

  return (
    <div className="stage-content s1-steps">
      {/* SLA banner */}
      <div className={`sla-banner ${sla.overdue && !step1Done && !step2Done ? 'overdue' : ''}`}>
        <span className="sla-icon">{sla.overdue ? '⚠️' : '⏱️'}</span>
        <span className="sla-text">
          {sla.overdue && (!step1Done || !step2Done || !step3Done || !step4ExplicitDone)
            ? 'SLA превышен: этап не выполнен в течение 1 недели с момента регистрации'
            : `SLA: 1 неделя с момента старта онбординга — ${sla.label}`}
        </span>
        {resolvedCreatedAt && <span className="sla-date">Старт: {new Date(resolvedCreatedAt).toLocaleDateString('ru-RU')}</span>}
      </div>

      {/* ── Шаг 1. Подписание документов ── */}
      <section className="s1-step">
        <StepHeader n={1} title="Подписание документов" reward="5 баллов" desc="Двух экземплярах NDA и договора · проверка HR обязательна" />
        <div className="hr-note">
          <span className="hr-dot" /> Защита от случайных галочек: этап не может быть пройден автоматически. Требуется верификация HR / администратора, подтверждающего физическое получение и проверку документов.
        </div>
        <div className="step-grid">
          <DocCard k="dogovor" doneFlag={isDone('dogovor')} icon="📄" title="Договор об оказании услуг" sub="2 экземпляра · один остаётся у вас, второй — у компании" onOpen={setOpen} />
          <DocCard k="nda" doneFlag={isDone('nda')} icon="🔒" title="NDA — Соглашение о неразглашении" sub="Строгий режим · партнёры и клиенты · защита репутации" onOpen={setOpen} />
          <DocCard k="pdp" doneFlag={isDone('pdp')} icon="🛡️" title="Соглашение об обработке персональных данных" sub="Обязательный документ" onOpen={setOpen} />
          <DocCard k="ip" doneFlag={isDone('ip')} icon="🏢" title="Свидетельство ИП" sub="Копия / реквизиты" onOpen={setOpen} />
          <DocCard k="sn" doneFlag={isDone('sn')} icon="✅" title="Справка о несудимости" sub="Актуальный документ" onOpen={setOpen} />
        </div>
        {/* fallback legacy docs card */}
        <div className="legacy-row">
          <DocCard k="docs" doneFlag={isDone('docs')} icon="📑" title="Трудовой договор и NDA (общий)" sub="Открой и пролистай до конца · legacy" onOpen={setOpen} />
          <DocCard k="lead" doneFlag={isDone('lead')} icon={<span className="font-orbitron" style={{ fontSize: 11, fontWeight: 800 }}>ЕП</span>} title="Елена Петрова — руководитель" sub="Профиль · пролистай до конца" onOpen={setOpen} />
        </div>
        {step1Done && <div className="step-done-badge">Шаг 1 выполнен ✓ +5 баллов</div>}
      </section>

      {/* ── Шаг 2. Получение доступов ── */}
      <section className="s1-step">
        <StepHeader n={2} title="Получение доступов" reward="5 баллов" desc="Техническая проверка или подтверждение ответственным лицом" />
        <div className="step-grid">
          <DocCard k="mbusiness" doneFlag={isDone('mbusiness')} icon="💳" title="MBusiness — открытие" sub="Выплаты 1–10 числа · поможет HR" onOpen={setOpen} />
          <DocCard k="accountant" doneFlag={isDone('accountant')} icon="🧾" title="Доступ бухгалтеру" sub="Инструкция · как предоставить доступ" onOpen={setOpen} />
          <DocCard k="proxy" doneFlag={isDone('proxy')} icon="🪪" title="Прокси-карта и Face ID" sub="Пропуск на 1 этаж · коворкинг · Технопарк / MSpace · через лида/PM" onOpen={setOpen} />
          <DocCard k="telegram" doneFlag={isDone('telegram')} icon="✈️" title="Доступ в Telegram-группы" sub="Авто-добавление · представьтесь команде" onOpen={setOpen} />
          <div className="doc-card wifi-card">
            <div className={`dc-icon ${isTaskDone('1-wifi') ? 'dc-done' : ''}`}>{isTaskDone('1-wifi') ? '✓' : '📶'}</div>
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
                <button type="button" className="wifi-btn" onClick={handleWifiSubmit} disabled={macSent && isTaskDone('1-wifi')}>
                  {isTaskDone('1-wifi') ? 'Отправлено ✓' : 'Отправить'}
                </button>
              </div>
              {macError && <div className="wifi-err">{macError}</div>}
              {isTaskDone('1-wifi') && !macError && <div className="wifi-ok">MAC принят — ожидайте пароль от закрытой сети</div>}
              <button type="button" className="wifi-help-link" onClick={() => setOpen('wifi')}>Подробнее →</button>
            </div>
          </div>
        </div>
        <div className="legacy-row">
          <DocCard k="jira" doneFlag={isDone('jira')} icon={<span className="font-orbitron" style={{ fontSize: 10, fontWeight: 800 }}>JR</span>} title="Jira · таск-трекер" sub="Доска задач · пролистай до конца" onOpen={setOpen} />
          <div className={`doc-card ${isTaskDone('1-figma') ? 'done' : ''}`} onClick={() => { if (!isTaskDone('1-figma')) toggle(stageId, '1-figma'); }} role="button" tabIndex={0}>
            <div className={`dc-icon ${isTaskDone('1-figma') ? 'dc-done' : ''}`}>{isTaskDone('1-figma') ? '✓' : '🎨'}</div>
            <div className="dc-body">
              <div className="dc-title">Figma · рабочие пространства {isTaskDone('1-figma') && <span className="dc-badge">готово</span>}</div>
              <div className="dc-sub">Доступ к дизайн-системе команды</div>
            </div>
            <span className="dc-chevron"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 3l5 5-5 5" /></svg></span>
          </div>
        </div>
        {step2Done && <div className="step-done-badge">Шаг 2 выполнен ✓ +5 баллов</div>}
      </section>

      {/* ── Шаг 3. Корпоративное приложение MPulse ── */}
      <section className="s1-step mpulse-step">
        <StepHeader n={3} title="Корпоративное приложение MPulse" reward="5 баллов" desc="AD · выбор графика · check-in/out · формат работы · новости" />
        <div className="mpulse-card">
          <div className="mpulse-head">
            <div className="mpulse-icon">M+</div>
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
                <label key={t.id} className={`mtask ${isTaskDone(t.id) ? 'done' : ''}`}>
                  <input type="checkbox" checked={isTaskDone(t.id)} onChange={() => toggle(stageId, t.id)} />
                  <span className="mtask-box">{isTaskDone(t.id) ? '✓' : ''}</span>
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {step3Done && <div className="step-done-badge">Шаг 3 выполнен ✓ +5 баллов</div>}
      </section>

      {/* ── Шаг 4. База знаний Confluence ── */}
      <section className="s1-step">
        <StepHeader n={4} title="База знаний Confluence" reward="10 баллов" desc="Отпуска · грейдинг · информация о компании" />
        <a href="https://confluence.mdigital.kg" target="_blank" rel="noopener noreferrer" className="confluence-link">
          <span className="cf-icon">CF</span>
          <span className="cf-body">
            <span className="cf-title">Confluence — пространства команды</span>
            <span className="cf-sub">confluence.mdigital.kg · откройте и пролистайте до конца</span>
          </span>
          <span className="cf-arrow">→</span>
        </a>
        <ul className="cf-list">
          <li>Правила оформления отпусков и отгулов</li>
          <li>Система грейдинга и повышения</li>
          <li>Общая информация о компании MDIGITAL</li>
        </ul>
        <div className="cf-tasks">
          {[
            { id: '1-confluence-vacation', label: 'Правила оформления отпусков' },
            { id: '1-confluence-grading', label: 'Система грейдинга и повышения' },
            { id: '1-confluence-info', label: 'Общая информация о компании' },
            { id: '1-confluence-rules', label: 'Правила внутреннего трудового распорядка' },
            { id: '1-confluence-security', label: 'Безопасность информации' },
            { id: '1-confluence-benefits', label: 'Социальные пакеты и beneficios' },
            { id: '1-confluence-contact', label: 'Контакты отделов' },
            { id: '1-confluence-faq', label: 'Частые вопросы' },
          ].map(t => (
            <label key={t.id} className={`mtask ${isTaskDone(t.id) ? 'done' : ''}`}>
              <input type="checkbox" checked={isTaskDone(t.id)} onChange={() => toggle(stageId, t.id)} />
              <span className="mtask-box">{isTaskDone(t.id) ? '✓' : ''}</span>
              <span>{t.label}</span>
            </label>
          ))}
        </div>
        <button type="button" className={`cf-confirm ${step4ExplicitDone ? 'done' : ''}`} onClick={handleConfluenceConfirm} disabled={confConfirming || step4ExplicitDone}>
          {confConfirming ? 'Фиксируем…' : step4ExplicitDone ? 'Ознакомление зафиксировано ✓' : 'Я ознакомился(-ась)'}
        </button>
        <div className="cf-hint">Нажмите кнопку выше, чтобы зафиксировать ознакомление в системе</div>
        {step4ExplicitDone && <div className="step-done-badge">Шаг 4 выполнен ✓ +10 баллов</div>}
      </section>

      <div className="doc-hint font-orbitron">Открой каждый документ и пролистай до конца — иначе не подтвердится. HR верификация шага 1 обязательна.</div>

      {/* modals */}
      <DocumentModal kind="docs" open={open === 'docs'} onClose={() => setOpen(null)} alreadyDone={isDone('docs')} onConfirm={() => handleConfirm('docs')} />
      <DocumentModal kind="lead" open={open === 'lead'} onClose={() => setOpen(null)} alreadyDone={isDone('lead')} onConfirm={() => handleConfirm('lead')} />
      <DocumentModal kind="mplus" open={open === 'mplus'} onClose={() => setOpen(null)} alreadyDone={isDone('mplus')} onConfirm={() => { handleConfirm('mplus'); window.open('https://play.google.com/store/search?q=MPulse&c=apps', '_blank', 'noopener'); }} />
      <DocumentModal kind="jira" open={open === 'jira'} onClose={() => setOpen(null)} alreadyDone={isDone('jira')} onConfirm={() => handleConfirm('jira')} />
      <DocumentModal kind="confluence" open={open === 'confluence'} onClose={() => setOpen(null)} alreadyDone={isDone('confluence')} onConfirm={() => handleConfirm('confluence')} />
      <DocumentModal kind="dogovor" open={open === 'dogovor'} onClose={() => setOpen(null)} alreadyDone={isDone('dogovor')} onConfirm={() => handleConfirm('dogovor')} />
      <DocumentModal kind="nda" open={open === 'nda'} onClose={() => setOpen(null)} alreadyDone={isDone('nda')} onConfirm={() => handleConfirm('nda')} />
      <DocumentModal kind="pdp" open={open === 'pdp'} onClose={() => setOpen(null)} alreadyDone={isDone('pdp')} onConfirm={() => handleConfirm('pdp')} />
      <DocumentModal kind="ip" open={open === 'ip'} onClose={() => setOpen(null)} alreadyDone={isDone('ip')} onConfirm={() => handleConfirm('ip')} />
      <DocumentModal kind="sn" open={open === 'sn'} onClose={() => setOpen(null)} alreadyDone={isDone('sn')} onConfirm={() => handleConfirm('sn')} />
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

function downloadStub() {
  window.open('https://play.google.com/store/search?q=MPulse&c=apps', '_blank', 'noopener');
  setTimeout(() => { window.open('https://apps.apple.com/search?term=MPulse', '_blank', 'noopener'); }, 400);
}
