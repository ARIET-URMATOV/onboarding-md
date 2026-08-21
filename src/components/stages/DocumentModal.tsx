import { useEffect, useRef, useState } from 'react';

type DocKind = 'docs' | 'lead' | 'mplus';
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
  mplus: { title: 'mPLuse — корпоративный мессенджер', sub: 'Инструкция по установке' },
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { el.removeEventListener('scroll', check); ro.disconnect(); window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
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
        </div>

        <div className="doc-foot">
          <span className="doc-hint">{canConfirm ? '✓ Дочитано до конца' : 'Пролистай до конца чтобы подтвердить'}</span>
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
        .doc-veil{ position:fixed; inset:0; z-index:50; display:grid; place-items:center; padding:20px; background:rgba(2,6,15,.72); backdrop-filter:blur(10px); animation:docIn .18s ease }
        @keyframes docIn{ from{opacity:0} to{opacity:1} }
        .doc-modal{ width:min(780px,100%); max-height:88vh; display:flex; flex-direction:column; background:rgba(6,12,24,.98); border:1px solid rgba(249,168,212,.28); border-radius:18px; box-shadow:0 30px 80px rgba(0,0,0,.6), inset 0 0 30px rgba(244,114,182,.06); overflow:hidden; animation:modalIn .28s cubic-bezier(.2,.8,.2,1) }
        @keyframes modalIn{ from{ opacity:0; transform:translateY(10px) scale(.98)} to{opacity:1; transform:none} }
        .doc-head{ display:flex; justify-content:space-between; align-items:flex-start; gap:14px; padding:18px 20px; border-bottom:1px solid rgba(255,255,255,.06) }
        .doc-h1{ font-size:14px; font-weight:800; color:#fff; letter-spacing:.02em }
        .doc-sub{ font-size:11.5px; color:var(--muted); margin-top:4px }
        .doc-x{ width:32px; height:32px; border-radius:8px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); color:#fff; font-size:20px; line-height:1; display:grid; place-items:center; flex-shrink:0 }
        .doc-progress{ display:flex; align-items:center; gap:10px; padding:10px 20px; border-bottom:1px solid rgba(255,255,255,.05); background:rgba(244,114,182,.05) }
        .doc-bar{ flex:1; height:3px; background:rgba(255,255,255,.08); border-radius:3px; overflow:hidden }
        .doc-bar i{ display:block; height:100%; background:linear-gradient(90deg,#f472b6,#8B5CF6); transition:width .12s }
        .doc-progress span{ font-size:10px; color:#f9a8d4; min-width:36px; text-align:right }
        .doc-body{ flex:1; overflow:auto; padding:20px; line-height:1.7; font-size:13px; color:rgba(226,244,255,.82) }
        .doc-body h3{ font-family:'Orbitron',sans-serif; font-size:12px; letter-spacing:.14em; color:#f472b6; margin:18px 0 8px; text-transform:uppercase }
        .doc-body h3:first-child{ margin-top:0 }
        .doc-body p{ margin:8px 0 }
        .doc-body .lead-card{ display:flex; gap:14px; padding:14px; border-radius:12px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); margin-bottom:14px }
        .doc-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 20px; border-top:1px solid rgba(255,255,255,.06); background:rgba(8,16,28,.6) }
        .doc-hint{ font-size:11px; color:var(--muted) }
        .doc-foot .btn-primary:disabled{ opacity:.45; cursor:not-allowed }
        @media(max-width:600px){ .doc-modal{ max-height:92vh } .doc-body{ padding:16px } }
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
      <h3>3. Порядок подписания</h3>
      <p>1) Открой HR-портал → Документы → Подписание. 2) Проверь ФИО и должность. 3) Подпиши ЭЦП. 4) Дождись подтверждения HR (обычно до 24 часов). После подписания доступ к mPLuse откроется автоматически.</p>
      <p style={{marginTop:18, padding:'12px', background:'rgba(192,132,252,.08)', border:'1px dashed rgba(192,132,252,.32)', borderRadius:'10px', fontSize:'12px'}}>💡 Совет: если HR-портал не открывается — напиши в #help-hr в mPLuse.</p>
      <p style={{marginTop:22, color:'var(--muted)', fontSize:'11px'}}>Докрути до конца чтобы кнопка «Подтвердить» стала активной. Это подтверждает, что ты ознакомился с документом.</p>
    </div>
  );
}
function LeadContent(){
  return (
    <div>
      <div className="lead-card">
        <div style={{width:56,height:56,borderRadius:12,background:'linear-gradient(135deg,#F472B6,#8B5CF6)',display:'grid',placeItems:'center',color:'#fff',fontWeight:800}}>ЕП</div>
        <div>
          <div style={{fontWeight:700,color:'#fff'}}>Елена Петрова — Frontend Lead</div>
          <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>8 лет в фронтенде · React, TypeScript, архитектура · любит чистый код и мемы про `any`</div>
          <div style={{marginTop:8,fontSize:11,lineHeight:1.6}}>Привет! Я помогу тебе влиться. Мой подход: короткие созвоны, честный фидбек, никаких микроменеджментов. Пиши в любое время — отвечаю в течение часа в рабочее время.</div>
        </div>
      </div>
      <h3>Как со мной работать</h3>
      <p>• Дейли в 10:30 (15 мин) — что делал, что будешь делать, блокеры.<br/>• Код-ревью — оставляю комментарии, не правлю за тебя.<br/>• 1-1 раз в 2 недели — про рост и цели.</p>
      <h3>Команда</h3>
      <p>В команде 6 человек: 3 фронта, 2 бэка, 1 дизайнер. Все — в mPLuse канале #frontend. Задай первый вопрос — это уже засчитается как шаг онбординга.</p>
      <h3>Контакты</h3>
      <p>mPLuse: @elena.petrova · Почта: e.petrova@mdigital.ru · Календарь: ищи слоты после 14:00.</p>
      <p style={{marginTop:14, fontSize:11, color:'var(--muted)'}}>Прокрути до конца и нажми «Подтвердить знакомство», чтобы закрыть задачу.</p>
    </div>
  );
}
function MplusContent(){
  return (
    <div>
      <h3>Что такое mPLuse</h3>
      <p>mPLuse — наш корпоративный мессенджер (аналог Slack). Там вся жизнь команды: каналы, треды, созвоны, файлы.</p>
      <h3>Установка</h3>
      <p><b>Windows/macOS:</b> скачай инсталлятор по кнопке ниже (или возьми ссылку из HR-портала → Инструменты → mPLuse). Запусти, войди через корпоративную почту. <br/><b>Linux:</b> `.deb / .rpm` в том же разделе.</p>
      <p><b>Мобильный:</b> iOS/Android — найди «mPlus» в сторе, войди тем же аккаунтом — удобно для пушей.</p>
      <h3>После установки</h3>
      <p>1) Вступи в каналы: #general, #frontend, #help-hr.<br/>2) Заполни профиль (фото + статус).<br/>3) Напиши «Привет! Я на борту 👋» в #frontend — это проверит, что мессенджер работает.</p>
      <div style={{marginTop:14, padding:'12px', borderRadius:'10px', background:'rgba(244,114,182,.08)', border:'1px solid rgba(244,114,182,.22)', fontSize:'12px'}}>⚡ Проверка: если после установки не видишь каналы — перезайди и дождись синхронизации 1-2 минуты.</div>
      <p style={{marginTop:16, fontSize:11, color:'var(--muted)'}}>Дочитай инструкцию до конца, чтобы подтвердить установку. Кнопка скачивания выдаст мок-файл (в реале — бинарь).</p>
    </div>
  );
}
