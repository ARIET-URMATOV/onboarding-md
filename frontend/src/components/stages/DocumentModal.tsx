import { useEffect, useRef, useState } from 'react';

type DocKind = 'docs' | 'lead' | 'mplus' | 'jira' | 'confluence';
interface Props {
  kind: DocKind;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  alreadyDone: boolean;
}

const DOC_META: Record<DocKind, { title: string; sub: string }> = {
  docs: { title: 'Трудовой договор и NDA', sub: 'Прочитай до конца, чтобы подтвердить' },
  lead: { title: 'Елена Петрова — Frontend Lead', sub: 'Твой руководитель · познакомься с профилем' },
  mplus: { title: 'mPLuse — корпоративный мессенджер', sub: 'MPulse — мобильное приложение · скачай по ссылкам ниже' },
  jira: { title: 'Jira — таск-трекер', sub: 'CRM · https://crm.mdigital.kg · открой и пролистай' },
  confluence: { title: 'Confluence — база знаний', sub: 'https://confluence.mdigital.kg' },
};

export function DocumentModal({ kind, open, onClose, onConfirm, alreadyDone }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canConfirm, setCanConfirm] = useState(alreadyDone);
  const [progress, setProgress] = useState(alreadyDone ? 100 : 0);

  useEffect(() => { if (open) setCanConfirm(alreadyDone); }, [open, alreadyDone]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    // if content fits without scroll -> immediately allow
    const check = () => {
      if (!el) return;
      const scrolled = el.scrollTop + el.clientHeight >= el.scrollHeight - 16;
      const pct = el.scrollHeight <= el.clientHeight ? 100 : Math.round(((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100);
      setProgress(Math.min(100, pct));
      if (scrolled) setCanConfirm(true);
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOver = document.body.style.overscrollBehavior;
    const prevHtmlOver = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';
    document.documentElement.style.overscrollBehavior = 'contain';
    document.body.classList.add('modal-open');
    return () => { el.removeEventListener('scroll', check); ro.disconnect(); window.removeEventListener('keydown', onKey); document.body.style.overflow = prevBodyOverflow; document.documentElement.style.overflow = prevHtmlOverflow; document.body.style.overscrollBehavior = prevBodyOver; document.documentElement.style.overscrollBehavior = prevHtmlOver; document.body.classList.remove('modal-open'); };
  }, [open, onClose]);

  if (!open) return null;
  const meta = DOC_META[kind];

  return (
    <div className="doc-veil" onClick={onClose}>
      <div className="doc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="doc-head">
          <div>
            <div className="doc-h1 font-orbitron">{meta.title}</div>
            <div className="doc-sub">{meta.sub}</div>
          </div>
          <button className="doc-x" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        <div className="doc-progress">
          <div className="doc-bar"><i style={{ width: `${progress}%` }} /></div>
          <span className="font-orbitron">{progress}%</span>
        </div>

        <div ref={scrollRef} className="doc-body">
          {kind === 'docs' && <DocsContent />}
          {kind === 'lead' && <LeadContent />}
          {kind === 'mplus' && <MplusContent />}
          {kind === 'jira' && <JiraContent />}
          {kind === 'confluence' && <ConfluenceContent />}
        </div>

        <div className="doc-foot">
          <button
            className="btn-primary"
            disabled={!canConfirm}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {alreadyDone ? 'Готово ✓' : 'Подтвердить прочтение'}
          </button>
        </div>
      </div>
      <style>{`
        .doc-veil{ position:fixed; inset:0; z-index:80; display:grid; place-items:center; padding:10px; background:rgba(2,6,15,.72); backdrop-filter:blur(10px); animation:docIn .18s ease }
        @keyframes docIn{ from{opacity:0} to{opacity:1} }
        .doc-modal{ width:min(780px,100%); max-height:94vh; display:flex; flex-direction:column; background:rgba(6,12,24,.98); border:1px solid rgba(147,197,253,.28); border-radius:14px; box-shadow:0 30px 80px rgba(0,0,0,.6), inset 0 0 30px rgba(59,130,246,.06); overflow:hidden; animation:modalIn .28s cubic-bezier(.2,.8,.2,1) }
        @keyframes modalIn{ from{ opacity:0; transform:translateY(10px) scale(.98)} to{opacity:1; transform:none} }
        .doc-head{ display:flex; justify-content:space-between; align-items:flex-start; gap:10px; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.06) }
        .doc-h1{ font-family:'Open Sans',sans-serif; font-size:12.5px; font-weight:800; color:#fff; letter-spacing:.02em }
        .doc-sub{ font-family:'Open Sans',sans-serif; font-size:11.5px; color:var(--muted); margin-top:4px }
        .doc-x{ width:28px; height:28px; border-radius:8px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); color:#fff; font-size:18px; line-height:1; display:grid; place-items:center; flex-shrink:0 }
        .doc-progress{ display:flex; align-items:center; gap:8px; padding:8px 14px; border-bottom:1px solid rgba(255,255,255,.05); background:rgba(59,130,246,.05) }
        .doc-bar{ flex:1; height:3px; background:rgba(255,255,255,.08); border-radius:3px; overflow:hidden }
        .doc-bar i{ display:block; height:100%; background:linear-gradient(90deg,#1E3A8A,#3B82F6); transition:width .12s }
        .doc-progress span{ font-size:10px; color:#93C5FD; min-width:32px; text-align:right; font-family:'Open Sans',sans-serif }
        .doc-body{ flex:1; overflow:auto; padding:14px 14px 16px; line-height:1.65; font-size:13.5px; color:rgba(226,244,255,.88); font-family:'Open Sans',sans-serif }
        .doc-body h3{ font-family:'Open Sans',sans-serif; font-size:12px; letter-spacing:.12em; color:#60A5FA; margin:14px 0 6px; text-transform:uppercase }
        .doc-body h3:first-child{ margin-top:0 }
        .doc-body p{ margin:8px 0 }
        .doc-body .lead-card{ display:flex; gap:10px; padding:10px; border-radius:12px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); margin-bottom:12px }
        .doc-foot{ display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:10px 14px; border-top:1px solid rgba(255,255,255,.06); background:rgba(8,16,28,.6); flex-wrap:wrap }
        .doc-foot .btn-primary{ padding:9px 14px; font-size:11px; min-height:32px; border-radius:8px; letter-spacing:.10em; font-family:'Open Sans',sans-serif }
        .doc-foot .btn-primary:disabled{ opacity:.45; cursor:not-allowed }
        @media(max-width:380px){
          .doc-body{ padding:12px; font-size:15px; }
          .doc-foot{ padding:8px 12px; }
          .doc-foot .btn-primary{ padding:8px 12px; font-size:9.5px; min-height:30px; }
        }
        @media(min-width:601px){
          .doc-veil{ padding:20px; }
          .doc-modal{ max-height:88vh; border-radius:18px; }
          .doc-head{ gap:14px; padding:18px 20px; }
          .doc-h1{ font-size:14px; } .doc-sub{ font-size:11.5px; }
          .doc-x{ width:32px; height:32px; font-size:20px; }
          .doc-progress{ gap:10px; padding:10px 20px; }
          .doc-body{ padding:20px; font-size:18px; color:rgba(226,244,255,.90); }
          .doc-body h3{ font-size:15px; letter-spacing:.13em; margin:16px 0 8px; }
          .doc-body .lead-card{ gap:14px; padding:14px; margin-bottom:25px; font-size:20px;flex-direction:column; }
          .doc-foot{ gap:12px; padding:14px 20px; }
          .doc-foot .btn-primary{ padding:10px 18px; font-size:11px; min-height:34px; border-radius:10px; letter-spacing:.14em; }
        }
      `}</style>
    </div>
  );
}

function DocsContent(){
  return (
    <div>
      <h3>1. Трудовой договор — обязанности и условия</h3>
      <p>Компания MDIGITAL заключает с сотрудником трудовой договор в соответствии с ТК РФ. Испытательный срок — 3 месяца, оклад и бонусы указаны в приложении №1. Рабочий график — гибкий, 40 часов в неделю, возможен удалённый формат.</p>
      <p>Сотрудник обязуется выполнять задачи в срок, соблюдать код-стайл, участвовать в код-ревью и стендапах. Компания обязуется предоставить рабочее место, доступы к репозиториям, Figma и корпоративной почте.</p>
      <h3>2. NDA — конфиденциальность</h3>
      <p>Вся информация о клиентах, проектах и исходном коде является конфиденциальной. Разглашение влечёт ответственность по договору. Срок действия NDA — 3 года после увольнения.</p>
      <p>Запрещается публикация кода в публичных репозиториях, передача макетов третьим лицам, использование клиентских данных в портфолио без согласования.</p>
      <h3>3. Ознакомление с регламентами</h3>
      <p><b>Рабочее время:</b> гибкий 40ч/нед, ядро 10:00–16:00, дейли 10:30.<br/><b>Отпуска:</b> заявка в HR-портал за 14 дней, согласование с руководителем.<br/><b>Отчётность:</b> статус задач в Jira (`crm.mdigital.kg`), еженедельный апдейт в Confluence (`confluence.mdigital.kg`), 1-1 с Lead раз в 2 недели.</p>
      <h3>4. Порядок подписания</h3>
      <p>1) Открой HR-портал → Документы → Подписание. 2) Проверь ФИО и должность. 3) Подпиши ЭЦП. 4) Дождись подтверждения HR (обычно до 24 часов). После подписания доступ к mPLuse откроется автоматически.</p>
      <p style={{marginTop:18, padding:'12px', background:'rgba(96,165,250,.08)', border:'1px dashed rgba(96,165,250,.32)', borderRadius:'10px', fontSize:'12px'}}>💡 Совет: если HR-портал не открывается — напиши в #help-hr в mPLuse.</p>
    </div>
  );
}
function LeadContent(){
  return (
    <div>
      <div className="lead-card">
        <div style={{width:56,height:56,borderRadius:12,background:'linear-gradient(135deg,#3B82F6,#1E3A8A)',display:'grid',placeItems:'center',color:'#fff',fontWeight:800}}>ЕП</div>
        <div>
          <div style={{fontWeight:700,color:'#fff'}}>Елена Петрова — Frontend Lead</div>
          <div style={{fontSize:16,color:'var(--muted)',marginTop:2}}>8 лет в фронтенде · React, TypeScript, архитектура · любит чистый код и мемы про `any`</div>
          <div style={{marginTop:8,fontSize:16,lineHeight:1.6}}>Привет! Я помогу тебе влиться. Мой подход: короткие созвоны, честный фидбек, никаких микроменеджментов. Пиши в любое время — отвечаю в течение часа в рабочее время.</div>
        </div>
      </div>
      <h3>Как со мной работать</h3>
      <p>• Дейли в 10:30 (15 мин) — что делал, что будешь делать, блокеры.<br/>• Код-ревью — оставляю комментарии, не правлю за тебя.<br/>• 1-1 раз в 2 недели — про рост и цели.</p>
      <h3>Ознакомление со структурой компании</h3>
      <p>MDIGITAL — продуктовая студия: <b>Продукт</b> (Frontend/Backend/Design/QA) → <b>Операции</b> (HR, Админ) → <b>Менеджмент</b>. Твоя роль — Frontend в команде Елены Петровой, взаимодействие: задачи — Jira (`crm.mdigital.kg`), знания — Confluence (`confluence.mdigital.kg`), код — Git (`github.com/mdigital`).</p>
      <h3>Команда</h3>
      <p>В команде 6 человек: 3 фронта, 2 бэка, 1 дизайнер. Все — в mPLuse канале #frontend. Задай первый вопрос — это уже засчитается как шаг онбординга.</p>
      <h3>Контакты</h3>
      <p>mPLuse: @elena.petrova · Почта: e.petrova@mdigital.ru · Календарь: ищи слоты после 14:00.</p>
    </div>
  );
}
function MplusContent(){
  return (
    <div>
      <h3>Что такое mPLuse</h3>
      <p>mPLuse — наш корпоративный мессенджер (аналог Slack). Там вся жизнь команды: каналы, треды, созвоны, файлы.</p>
      <h3>Установка — десктоп</h3>
      <p><b>Windows/macOS:</b> скачай инсталлятор из HR-портала → Инструменты → mPLuse или по кнопке ниже. Запусти, войди через корпоративную почту. <br/><b>Linux:</b> `.deb / .rpm` в том же разделе.</p>
      <h3>Мобильное приложение MPulse</h3>
      <p>MPulse — мобильный клиент mPLuse. Установи чтобы получать пуши и быть на связи вне офиса. Войди тем же корп. аккаунтом.</p>
      <div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginTop:'10px'}}>
        <a href="https://apps.apple.com/search?term=MPulse" target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'10px 16px',borderRadius:'999px',background:'#000',color:'#fff',textDecoration:'none',fontWeight:700,fontSize:'12px'}}>App Store — MPulse</a>
        <a href="https://play.google.com/store/search?q=MPulse&c=apps" target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'10px 16px',borderRadius:'999px',background:'#01875f',color:'#fff',textDecoration:'none',fontWeight:700,fontSize:'12px'}}>Google Play — MPulse</a>
      </div>
      <p style={{marginTop:'10px',fontSize:'11px',color:'var(--muted)'}}>Прямые ссылки: App Store / Google Play — поиск «MPulse». Если уже установлен корпоративный MDM — MPulse появится автоматически.</p>
      <h3>Ознакомление со структурой компании</h3>
      <p>MDIGITAL: <b>Продукт →</b> Frontend / Backend / Design / QA → <b>Операции</b> (HR, Админ) → <b>Менеджмент</b>. Твоя команда — Frontend (3 dev + Lead Елена Петрова). Взаимодействие: задачи — Jira (`crm.mdigital.kg`), знания — Confluence (`confluence.mdigital.kg`), код — Git.</p>
      <h3>Обзор базовых инструментов</h3>
      <p><b>Jira (CRM):</b> `crm.mdigital.kg` — доски `MDIG-FE`, спринты, задачи.<br/><b>Confluence:</b> `confluence.mdigital.kg` — handbook, ADR, гайды.<br/><b>Git:</b> `github.com/mdigital` — репозитории, PR, code style.</p>
      <h3>Ознакомление с регламентами</h3>
      <p><b>Рабочее время:</b> гибкий 40ч/нед, дейли 10:30.<br/><b>Отпуска:</b> заявка в HR-портал за 2 недели, согласование с Lead.<br/><b>Отчётность:</b> статус в Jira (To Do→Done), еженедельный апдейт в Confluence.</p>
      <h3>После установки</h3>
      <p>1) Вступи в каналы: #general, #frontend, #help-hr.<br/>2) Заполни профиль (фото + статус).<br/>3) Напиши «Привет! Я на борту 👋» в #frontend — это проверит, что мессенджер работает.</p>
      <div style={{marginTop:14, padding:'12px', borderRadius:'10px', background:'rgba(59,130,246,.08)', border:'1px solid rgba(59,130,246,.22)', fontSize:'12px'}}>⚡ Проверка: если после установки не видишь каналы — перезайди и дождись синхронизации 1-2 минуты.</div>
    </div>
  );
}
function JiraContent(){
  return (
    <div>
      <h3>Что такое Jira</h3>
      <p>Jira — таск-трекер команды MDIGITAL. Здесь живут все задачи: бэклог, спринты, баги, код-ревью и релизы. Без доступа к Jira спринт не стартует.</p>
      <h3>Твои доски</h3>
      <p>MDIGITAL • Frontend — твой рабочий борд: колонки <b>To Do → In Progress → Review → Done</b>. Карточка = задача с приоритетом, оценкой story points и дедлайном. Начни с колонки <b>Onboarding</b>.</p>
      <h3>Как начать</h3>
      <p>1) Открой Jira/CRM по кнопке ниже. 2) Войди через корп. почту (SSO). 3) Найди проект <b>MDIG-FE</b> и фильтр <b>“Мои задачи”</b>. 4) Открой первую задачу и передвинь её в In Progress — это засчитается ботом.</p>
      <a href="https://crm.mdigital.kg" target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:'8px',marginTop:'14px',padding:'10px 16px',borderRadius:'999px',background:'linear-gradient(90deg,#0052CC,#2684FF)',color:'#fff',textDecoration:'none',fontWeight:700,fontSize:'12px',letterSpacing:'.04em',boxShadow:'0 6px 18px rgba(0,82,204,.35)'}}>Открыть Jira →</a>
      <h3>Обзор базовых инструментов</h3>
      <p><b>Jira (CRM):</b> <a href="https://crm.mdigital.kg" target="_blank" rel="noopener noreferrer" style={{color:'#2684FF'}}>crm.mdigital.kg</a> — задачи и спринты.<br/><b>Confluence:</b> <a href="https://confluence.mdigital.kg" target="_blank" rel="noopener noreferrer" style={{color:'#2684FF'}}>confluence.mdigital.kg</a> — доки и гайды.<br/><b>Git:</b> репозиторий `github.com/mdigital` — код-ревью, ветки, `code style`.</p>
    </div>
  );
}
function ConfluenceContent(){
  return (
    <div>
      <h3>Что такое Confluence</h3>
      <p>Добро пожаловать в Confluence от mdigital.kg</p>
      <p>Мы рады приветствовать вас в нашем пространстве для совместной работы и обмена знаниями. Confluence – это место, где мы собираем всю важную информацию, делимся идеями и создаем документы, которые помогут нам эффективно работать вместе. Если у вас возникнут вопросы или понадобится помощь, не стесняйтесь обращаться – мы всегда рады помочь!</p>
      <p>Успешной работы и продуктивных обсуждений!</p>
      <a href="https://confluence.mdigital.kg" target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:'8px',marginTop:'14px',padding:'10px 16px',borderRadius:'999px',background:'linear-gradient(90deg,#172B4D,#344563)',color:'#fff',textDecoration:'none',fontWeight:700,fontSize:'12px',letterSpacing:'.04em',boxShadow:'0 6px 18px rgba(23,43,77,.35)'}}>Открыть Confluence →</a>
    </div>
  );
}
