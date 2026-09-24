import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export type DocKind =
  | 'docs'
  | 'lead'
  | 'mplus'
  | 'jira'
  | 'confluence'
  | 'dogovor'
  | 'nda'
  | 'pdp'
  | 'ip'
  | 'sn'
  | 'mbusiness'
  | 'accountant'
  | 'wifi'
  | 'proxy'
  | 'telegram';

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
  mplus: { title: 'MPulse — корпоративное приложение', sub: 'Мобильное приложение · скачай по ссылкам ниже' },
  jira: { title: 'Jira — таск-трекер', sub: 'CRM · https://crm.mdigital.kg · открой и пролистай' },
  confluence: { title: 'Confluence — база знаний', sub: 'https://confluence.mdigital.kg' },
  dogovor: { title: 'Договор об оказании услуг (2 экз.)', sub: 'Подписывается в двух экземплярах (один вам, второй компании)' },
  nda: { title: 'NDA — Соглашение о неразглашении', sub: 'Строгий режим конфиденциальности · Защита репутации компании' },
  pdp: { title: 'Соглашение об обработке персональных данных', sub: 'Обязательный документ компании MDIGITAL' },
  ip: { title: 'Свидетельство ИП', sub: 'Предоставление копии/реквизитов' },
  sn: { title: 'Справка о несудимости', sub: 'Предоставление актуального документа' },
  mbusiness: { title: 'MBusiness — открытие счета', sub: 'Необходимо для получения зарплаты (1–10 число каждого месяца)' },
  accountant: { title: 'Доступ бухгалтеру', sub: 'Инструкция по предоставлению доступа бухгалтерской службе' },
  wifi: { title: 'Доступ к закрытой сети Wi-Fi', sub: 'Отправка MAC-адреса устройства сетевой службе' },
  proxy: { title: 'Прокси-карта и Face ID', sub: 'Транспортный доступ в коворкинг, Технопарк и MSpace' },
  telegram: { title: 'Telegram-группы команды', sub: 'Автоматический доступ и приветствие команды' },
};

export function DocumentModal({ kind, open, onClose, onConfirm, alreadyDone }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canConfirm, setCanConfirm] = useState(alreadyDone);
  const [progress, setProgress] = useState(alreadyDone ? 100 : 0);

  useEffect(() => {
    if (open) setCanConfirm(alreadyDone);
  }, [open, alreadyDone]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
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
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  const meta = DOC_META[kind] || { title: 'Документ', sub: 'Инструкция и описание' };

  return (
    <div className="doc-veil" onClick={onClose}>
      <div className="doc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="doc-head">
          <div>
            <div className="doc-h1 font-orbitron">{meta.title}</div>
            <div className="doc-sub">{meta.sub}</div>
          </div>
          <button className="doc-x" onClick={onClose} aria-label="Закрыть"><X size={16} /></button>
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
          {kind === 'dogovor' && <DogovorContent />}
          {kind === 'nda' && <NdaContent />}
          {kind === 'pdp' && <PdpContent />}
          {kind === 'ip' && <IpContent />}
          {kind === 'sn' && <SnContent />}
          {kind === 'mbusiness' && <MBusinessContent />}
          {kind === 'accountant' && <AccountantContent />}
          {kind === 'wifi' && <WifiContent />}
          {kind === 'proxy' && <ProxyContent />}
          {kind === 'telegram' && <TelegramContent />}
        </div>

        <div className="doc-foot">
          <button
            className="btn-primary"
            disabled={!canConfirm}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {alreadyDone ? 'Ознакомлен(-а) ✓' : 'Подтвердить прочтение'}
          </button>
        </div>
      </div>
      <style>{`
        .doc-veil{ position:fixed; inset:0; z-index:80; display:grid; place-items:center; padding:10px; background:rgba(2,6,15,.72); backdrop-filter:blur(10px); animation:docIn .18s ease }
        @keyframes docIn{ from{opacity:0} to{opacity:1} }
        .doc-modal{ width:min(780px,100%); max-height:94vh; display:flex; flex-direction:column; background:rgba(6,12,24,.98); border:1px solid rgba(147,197,253,.28); border-radius:14px; box-shadow:0 30px 80px rgba(0,0,0,.6), inset 0 0 30px rgba(59,130,246,.06); overflow:hidden; animation:modalIn .28s cubic-bezier(.2,.8,.2,1) }
        @keyframes modalIn{ from{ opacity:0; transform:translateY(10px) scale(.98)} to{opacity:1; transform:none} }
        .doc-head{ display:flex; justify-content:space-between; align-items:flex-start; gap:10px; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.06) }
        .doc-h1{ font-family:'Open Sans',sans-serif; font-size:13.5px; font-weight:800; color:#fff; letter-spacing:.02em }
        .doc-sub{ font-family:'Open Sans',sans-serif; font-size:11.5px; color:var(--muted); margin-top:4px }
        .doc-x{ width:28px; height:28px; border-radius:8px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); color:#fff; font-size:18px; line-height:1; display:grid; place-items:center; flex-shrink:0 }
        .doc-progress{ display:flex; align-items:center; gap:8px; padding:8px 14px; border-bottom:1px solid rgba(255,255,255,.05); background:rgba(59,130,246,.05) }
        .doc-bar{ flex:1; height:3px; background:rgba(255,255,255,.08); border-radius:3px; overflow:hidden }
        .doc-bar i{ display:block; height:100%; background:linear-gradient(90deg,#1E3A8A,#3B82F6); transition:width .12s }
        .doc-progress span{ font-size:10px; color:#93C5FD; min-width:32px; text-align:right; font-family:'Open Sans',sans-serif }
        .doc-body{ flex:1; overflow:auto; padding:14px; line-height:1.65; font-size:13.5px; color:rgba(226,244,255,.88); font-family:'Open Sans',sans-serif }
        .doc-body h3{ font-family:'Open Sans',sans-serif; font-size:12.5px; letter-spacing:.08em; color:#60A5FA; margin:14px 0 6px; text-transform:uppercase }
        .doc-body h3:first-child{ margin-top:0 }
        .doc-body p{ margin:8px 0 }
        .doc-foot{ display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:10px 14px; border-top:1px solid rgba(255,255,255,.06); background:rgba(8,16,28,.6); flex-wrap:wrap }
        .doc-foot .btn-primary{ padding:9px 14px; font-size:11px; min-height:32px; border-radius:8px; letter-spacing:.10em; font-family:'Open Sans',sans-serif; background:linear-gradient(90deg,#1E3A8A,#2563EB); color:#fff; border:none; cursor:pointer }
        .doc-foot .btn-primary:disabled{ opacity:.45; cursor:not-allowed }
      `}</style>
    </div>
  );
}

function DocsContent() {
  return (
    <div>
      3. Трудовой договор и общие правила онбординга MDIGITAL.
      <p>Ознакомьтесь со всеми ключевыми документами ниже.</p>
    </div>
  );
}
function LeadContent() {
  return (
    <div>
      3. Информация о руководителе и структуре вашей команды.
    </div>
  );
}
function MplusContent() {
  return (
    <div>
      <h3>MPulse — установка и настройка</h3>
      <p><b>Шаг 1:</b> Скачай приложение MPulse по ссылкам на карточке этапа (App Store / Google Play).</p>
      <p><b>Шаг 2:</b> Войди через корпоративный Active Directory (AD) — тот же логин и пароль, что для рабочих сервисов.</p>
      <p><b>Шаг 3:</b> Выбери рабочий график, согласованный с руководителем.</p>
      <p><b>Шаг 4:</b> Отмечай ежедневный check-in / check-out и выбери формат работы.</p>
      <p><b>Шаг 5:</b> Включи корпоративные новости и уведомления, чтобы не пропускать важное.</p>
      <p>Пролистай инструкцию до конца и нажми «Подтвердить прочтение» — этап зачтётся автоматически.</p>
    </div>
  );
}
function JiraContent() {
  return (
    <div>
      3. Взаимодействие с доской задач в Jira CRM.
    </div>
  );
}
function ConfluenceContent() {
  return (
    <div>
      3. База знаний Confluence mdigital.kg.
    </div>
  );
}

function DogovorContent() {
  return (
    <div>
      <h3>Договор об оказании услуг</h3>
      <p><b>Описание:</b> Подписывается в двух экземплярах (один экземпляр остается у вас, второй передается в компанию).</p>
      <p><b>Порядок оформления:</b> Распечатайте или получи сформированный печатный бланк у HR-менеджера. Внимательно проверьте паспортные данные, банковские реквизиты и подпишите оба экземпляра.</p>
      <p><b>Верификация:</b> Ответственный сотрудник HR/администратор подтверждает физическое получение и проверку оригинала документа.</p>
    </div>
  );
}

function NdaContent() {
  return (
    <div>
      <h3>NDA (Соглашение о неразглашении)</h3>
      <p><b>Описание:</b> Подписывается в двух экземплярах. Устанавливает строгий режим конфиденциальности в отношении разработок, клиентов и партнеров компании.</p>
      <p><b>Защита репутации:</b> Распространяется на данные партнеров и клиентов компании MDIGITAL. Срок действия соглашения сохранен в течение 3 лет после завершения сотрудничества.</p>
      <p><b>Порядок передачи:</b> Физический экземпляр с личной подписью передается HR-менеджеру.</p>
    </div>
  );
}

function PdpContent() {
  return (
    <div>
      <h3>Соглашение об обработке персональных данных</h3>
      <p><b>Обязательный документ:</b> Разрешение компании на обработку персональных данных для целей кадрового учета и безопасности.</p>
      <p>Подписывается при старте онбординга. Гарантируется сохранность ваших данных в соответствии с законодательством.</p>
    </div>
  );
}

function IpContent() {
  return (
    <div>
      <h3>Свидетельство ИП</h3>
      <p><b>Описание:</b> Предоставление копии свидетельства о регистрации ИП / выписки из реестра и банковских реквизитов.</p>
      <p>Необходимо передать файл или бумажную копию ответственному бухгалтеру / HR для внесения в систему взаиморасчетов.</p>
    </div>
  );
}

function SnContent() {
  return (
    <div>
      <h3>Справка о несудимости</h3>
      <p><b>Описание:</b> Предоставление актуального документа (электронная справка с Госуслуг/ЦОН или бумажный оригинал).</p>
      <p>Документ подтверждает соответствие требованиям безопасности для доступа к конфиденциальным проектам клиентов.</p>
    </div>
  );
}

function MBusinessContent() {
  return (
    <div>
      <h3>MBusiness — открытие счета</h3>
      <p>Открытие MBusiness необходимо для того, чтобы вы своевременно получали выплаты за работу. Деньги поступают раз в месяц с 1 по 10 число.</p>
      <p><b>Помощь:</b> При возникновении вопросов на этапе открытия счета вам оперативно поможет ваш HR-менеджер.</p>
    </div>
  );
}

function AccountantContent() {
  return (
    <div>
      <h3>Инструкция: Предоставление доступа бухгалтеру</h3>
      <p><b>Интерфейс и шаг:</b> Откройте настройки MBusiness и добавьте бухгалтера компании в роли «Наблюдатель/Бухгалтер» для автоматического формирования актов и выписок.</p>
      <p><i>(Подробный текст инструкции обновляется службой бухгалтерии).</i></p>
    </div>
  );
}

function WifiContent() {
  return (
    <div>
      <h3>Доступ к Wi-Fi (Закрытая сеть)</h3>
      <p>Для подключения ноутбука к закрытой корпоративной сети выполните следующие шаги:</p>
      <p><b>Шаг 1:</b> Откройте настройки Wi-Fi на вашем ноутбуке.</p>
      <p><b>Шаг 2:</b> Найдите название закрытой сети у вашего сисадмина.</p>
      <p><b>Шаг 3:</b> ВведитеMAC-адрес ноутбука и передайте его сетевым администраторам.</p>
      <p><b>Шаг 4:</b> После обработки запроса вы получите персональный пароль от закрытой сети Wi-Fi.</p>
      <img src="/wifi-guide.jpg" alt="Инструкция по подключению к Wi-Fi" style={{ width: '100%', borderRadius: 8, marginTop: 12 }} />
    </div>
  );
}

function ProxyContent() {
  return (
    <div>
      <h3>Прокси-карта и Face ID (Транспортный доступ)</h3>
      <p>Информация о том, как получить физический пропуск/Face ID на первый этаж, в коворкинг, Технопарк или MSpace.</p>
      <p>Запрос оформляется через вашего Team Lead или PM. Свяжитесь с руководителем для подачи заявки.</p>
    </div>
  );
}

function TelegramContent() {
  return (
    <div>
      <h3>Доступ в Telegram-группы</h3>
      <p>Добавление в рабочие чаты команды происходит автоматически или по пригласительным ссылкам.</p>
      <p>Обязательное условие: отправьте краткое представление себя (кто вы, ваша роль, интересы) в главный чат команды!</p>
    </div>
  );
}
