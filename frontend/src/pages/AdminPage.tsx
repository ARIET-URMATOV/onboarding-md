import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useOnboarding } from '../store/useOnboarding';

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string | null;
  is_staff: boolean;
  created_at: string | null;
  done_stage1: string[];
}

interface AuditRow {
  id: number;
  user_id: number;
  task_id: string;
  verified_by: number | null;
  method: string;
  details: string;
  created_at: string | null;
}

interface PendingRow {
  id: number;
  user_id: number;
  email: string;
  name: string;
  task_id: string;
  note: string;
  created_at: string | null;
}

interface MpulseCode {
  id: number;
  code: string;
  batch_name: string;
  is_active: boolean;
  created_at: string | null;
}

interface Links {
  telegram_invite_link: string;
  figma_team_url: string;
  confluence_url: string;
  mpulse_android_url: string;
  mpulse_ios_url: string;
}

const DOC_TASKS = ['1-dogovor', '1-nda', '1-pdp', '1-ip', '1-sn'];
const ACCESS_TASKS = ['1-mbusiness', '1-accountant', '1-wifi', '1-proxy', '1-telegram'];

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} сек назад`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

function prettyDetails(raw: string): string {
  try {
    const d = JSON.parse(raw || '{}') as Record<string, unknown>;
    const parts: string[] = [];
    if (d.elapsed_s !== undefined) parts.push(`читал ${d.elapsed_s}с`);
    if (d.via_api) parts.push('через API');
    if (d.opened_at) parts.push(`открыт ${new Date(String(d.opened_at)).toLocaleString('ru-RU')}`);
    return parts.join(' · ');
  } catch {
    return '';
  }
}

export function AdminPage() {
  const user = useOnboarding((s) => s.user);
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'users' | 'audit' | 'codes'>('pending');
  const [liveOn, setLiveOn] = useState(false);
  const prevPending = useRef(0);
  const [codes, setCodes] = useState<MpulseCode[]>([]);
  const [links, setLinks] = useState<Links | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newBatch, setNewBatch] = useState('');
  const [wifiPw, setWifiPw] = useState<Record<number, string>>({});

  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setLoading(true); setMsg(null); }
    try {
      const [p, a, c, l] = await Promise.all([
        api.get<PendingRow[]>('/api/admin/pending-verifications'),
        api.get<AuditRow[]>('/api/admin/audit'),
        api.get<MpulseCode[]>('/api/admin/mpulse-code'),
        api.get<Links>('/api/integrations/links'),
      ]);
      // тост о новых запросах (не при первой загрузке)
      if (prevPending.current && p.length > prevPending.current) {
        const fresh = p[0];
        const text = fresh ? `🔔 Новый запрос: ${fresh.name} — ${fresh.task_id}` : '🔔 Новые запросы';
        setMsg(text);
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Онбординг HR', { body: text });
          }
        } catch { /* ignore */ }
      }
      prevPending.current = p.length;
      setPending(p);
      setAudit(a);
      setCodes(c);
      setLinks(l);
    } catch (e) {
      if (!quiet) setMsg(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // live: WS + polling 15с + refetch на focus/visible
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${window.location.host}/ws/admin`);
      ws.onmessage = () => { setLiveOn(true); void load(true); };
      ws.onclose = () => setLiveOn(false);
      ws.onerror = () => { try { ws?.close(); } catch { /* ignore */ } };
    } catch { /* WS недоступен — polling */ }
    const id = setInterval(() => void load(true), 15000);
    const refetch = () => void load(true);
    document.addEventListener('visibilitychange', refetch);
    window.addEventListener('focus', refetch);
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    } catch { /* ignore */ }
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refetch);
      window.removeEventListener('focus', refetch);
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [load]);

  const search = async () => {
    setLoading(true);
    try {
      const u = await api.get<AdminUser[]>(`/api/admin/users?q=${encodeURIComponent(q)}`);
      setUsers(u);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка поиска');
    } finally {
      setLoading(false);
    }
  };

  const verify = async (userId: number, taskId: string) => {
    const endpoint = DOC_TASKS.includes(taskId) ? '/api/verify-docs' : '/api/verify-access';
    try {
      await api.post(endpoint, { user_id: userId, task_id: taskId });
      setMsg(`✓ ${taskId} подтверждена`);
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка верификации');
    }
  };

  const verifyRow = async (r: PendingRow) => {
    await verify(r.user_id, r.task_id);
  };

  const rejectRow = async (r: PendingRow) => {
    try {
      await api.del(`/api/admin/pending/${r.id}`);
      setMsg(`Запрос ${r.task_id} (${r.email}) отклонён`);
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка отклонения');
    }
  };

  const verifyAllDocs = async (u: AdminUser) => {
    const docs = DOC_TASKS.filter((t) => u.done_stage1.includes(t));
    if (!docs.length) return;
    try {
      for (const t of docs) {
        await api.post('/api/verify-docs', { user_id: u.id, task_id: t });
      }
      setMsg(`✓ Все документы ${u.email} подтверждены (${docs.length})`);
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка верификации');
    }
  };

  const genWifiPassword = async (u: AdminUser) => {
    try {
      const r = await api.post<{ ok: boolean; password: string; user_id: number }>(
        '/api/admin/wifi-password', { user_id: u.id, task_id: '1-wifi' },
      );
      setWifiPw((prev) => ({ ...prev, [u.id]: r.password }));
      setMsg(`✓ Пароль для ${u.email} сгенерирован — передайте вне системы (показан один раз)`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка генерации');
    }
  };

  const toggleStaff = async (u: AdminUser) => {
    try {
      const updated = await api.patch<AdminUser>(`/api/admin/users/${u.id}/staff`, { is_staff: !u.is_staff });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_staff: updated.is_staff } : x)));
      setPending((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_staff: updated.is_staff } : x)));
      setMsg(`${u.email} — staff: ${updated.is_staff ? 'да' : 'нет'}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const rotateCode = async () => {
    const code = newCode.trim();
    if (!code) { setMsg('Введите новый код MPulse'); return; }
    try {
      const created = await api.post<MpulseCode>('/api/admin/mpulse-code', { code, batch_name: newBatch.trim() });
      setCodes((prev) => [created, ...prev.map((c) => ({ ...c, is_active: false }))]);
      setNewCode('');
      setMsg(`✓ Новый код батча «${created.batch_name || '—'}» активен`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка ротации');
    }
  };

  if (!user?.isStaff) return <Navigate to="/dashboard" replace />;

  const renderTasks = (u: AdminUser) => {
    const tasks = [...DOC_TASKS, ...ACCESS_TASKS].filter((t) => u.done_stage1.includes(t));
    if (!tasks.length) return <span style={{ opacity: 0.5 }}>нет отметок</span>;
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tasks.map((t) => (
          <button key={t} type="button" onClick={() => verify(u.id, t)} className="admin-verify-btn" title="Подтвердить">
            {t} ✓
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="admin-page">
      <h1 className="admin-title">
        HR-панель · Этап 1 «Документы и доступы»{' '}
        <span className={`admin-live ${liveOn ? 'on' : ''}`} title={liveOn ? 'Live-подключение активно' : 'Live недоступен, polling 15с'}>
          {liveOn ? '● live' : '○ polling'}
        </span>
      </h1>
      <div className="admin-tabs">
        {(['pending', 'users', 'audit', 'codes'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`admin-tab ${tab === t ? 'active' : ''}`}>
            {t === 'pending' ? `Ожидают (${pending.length})` : t === 'users' ? 'Сотрудники' : t === 'audit' ? `Журнал (${audit.length})` : 'Коды и ссылки'}
          </button>
        ))}
        <button type="button" onClick={() => load()} className="admin-tab" disabled={loading}>↻</button>
      </div>
      {msg && <div className="admin-msg">{msg}</div>}

      {tab === 'pending' && (
        <div className="admin-list">
          {loading && !pending.length && [0, 1, 2].map((i) => (
            <div key={i} className="admin-card admin-skel"><div className="skel-line" /><div className="skel-line short" /></div>
          ))}
          {pending.map((r) => (
            <div key={r.id} className="admin-card">
              <div className="admin-card-head">
                <b>{r.name}</b> <span className="admin-email">{r.email}</span>
              </div>
              <div className="admin-card-sub">
                <code style={{ fontFamily: 'monospace' }}>{r.task_id}</code>
                {' · '}
                {r.created_at ? ago(r.created_at) : '—'}
                {r.note ? ` · «${r.note}»` : ''}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => verifyRow(r)} className="admin-verify-btn">Подтвердить ✓</button>
                <button type="button" onClick={() => rejectRow(r)} className="admin-reject-btn">Отклонить</button>
              </div>
            </div>
          ))}
          {!pending.length && !loading && <div className="admin-empty">Нет ожидающих запросов</div>}
        </div>
      )}

      {tab === 'users' && (
        <div>
          <div className="admin-search">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} placeholder="email или имя" className="admin-input" />
            <button type="button" onClick={search} className="admin-btn" disabled={loading}>Найти</button>
          </div>
          <div className="admin-list">
            {users.map((u) => (
              <div key={u.id} className="admin-card">
                <div className="admin-card-head">
                  <b>{u.name}</b> <span className="admin-email">{u.email}</span>
                  {u.is_staff && <span className="admin-staff-badge">staff</span>}
                </div>
                <div className="admin-card-sub">Stage 1: {u.done_stage1.length} задач</div>
                {renderTasks(u)}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => toggleStaff(u)} className="admin-btn small">
                    {u.is_staff ? 'Снять staff' : 'Дать staff'}
                  </button>
                  <button type="button" onClick={() => genWifiPassword(u)} className="admin-btn small">
                    Wi-Fi пароль
                  </button>
                  <button type="button" onClick={() => verifyAllDocs(u)} className="admin-btn small">
                    Все доки ✓
                  </button>
                </div>
                {wifiPw[u.id] && (
                  <div className="admin-once">
                    <code>{wifiPw[u.id]}</code>
                    <span>— показан один раз, скопируйте и передайте сотруднику</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="admin-list">
          {audit.map((r) => (
            <div key={r.id} className="admin-card audit">
              <b>{r.task_id}</b> · user #{r.user_id} · {r.method} · by #{r.verified_by ?? '—'} ·{' '}
              {r.created_at ? new Date(r.created_at).toLocaleString('ru-RU') : '—'}
              {prettyDetails(r.details) && <span className="admin-detail"> · {prettyDetails(r.details)}</span>}
            </div>
          ))}
          {!audit.length && !loading && <div className="admin-empty">Журнал пуст</div>}
        </div>
      )}

      {tab === 'codes' && (
        <div className="admin-list">
          <div className="admin-card">
            <div className="admin-card-head"><b>Ротация кода MPulse</b></div>
            <div className="admin-card-sub">Новый код деактивирует предыдущие. Сообщите код сотрудникам.</div>
            <div className="admin-search">
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Новый код" className="admin-input" />
              <input value={newBatch} onChange={(e) => setNewBatch(e.target.value)} placeholder="Батч (напр. 09-2026)" className="admin-input" />
              <button type="button" onClick={rotateCode} className="admin-btn">Выпустить</button>
            </div>
          </div>
          {codes.map((c) => (
            <div key={c.id} className="admin-card audit">
              <b style={{ fontFamily: 'monospace' }}>{c.code}</b> · {c.batch_name || '—'} · {c.is_active ? 'активен ✓' : 'неактивен'} ·{' '}
              {c.created_at ? new Date(c.created_at).toLocaleString('ru-RU') : '—'}
            </div>
          ))}
          {!codes.length && !loading && <div className="admin-empty">Кодов в БД нет — действует MPULSE_VERIFICATION_CODE из env</div>}
          <div className="admin-card">
            <div className="admin-card-head"><b>Ссылки внешних систем</b></div>
            <div className="admin-card-sub">TZ: онбординг даёт ссылки, LDAP — настройки самих систем.</div>
            {links && (
              <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                <div>Telegram: {links.telegram_invite_link || '— (TELEGRAM_INVITE_LINK)'}</div>
                <div>Figma: {links.figma_team_url || '— (FIGMA_TEAM_URL)'}</div>
                <div>Confluence: {links.confluence_url}</div>
                <div>MPulse Android: {links.mpulse_android_url}</div>
                <div>MPulse iOS: {links.mpulse_ios_url}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .admin-page{ display:flex; flex-direction:column; gap:12px; padding:16px 12px; max-width:760px; margin:0 auto }
        .admin-title{ font-size:16px; font-weight:800; color:var(--text) }
        .admin-tabs{ display:flex; gap:8px }
        .admin-tab{ padding:7px 12px; border-radius:8px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.03); color:var(--text); font-size:12px; cursor:pointer }
        .admin-tab.active{ border-color:rgba(59,130,246,.5); background:rgba(59,130,246,.12) }
        .admin-msg{ font-size:12px; padding:8px 12px; border-radius:8px; background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.25); color:#86EFAC }
        .admin-list{ display:flex; flex-direction:column; gap:10px }
        .admin-card{ padding:12px; border-radius:10px; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.07); display:flex; flex-direction:column; gap:8px }
        .admin-card-head{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-size:13px }
        .admin-email{ font-size:11.5px; color:var(--muted) }
        .admin-staff-badge{ font-size:9px; letter-spacing:.1em; text-transform:uppercase; padding:2px 7px; border-radius:999px; background:rgba(251,191,36,.12); border:1px solid rgba(251,191,36,.3); color:#FBBF24 }
        .admin-card-sub{ font-size:11.5px; color:var(--muted) }
        .admin-verify-btn{ padding:5px 10px; border-radius:7px; border:1px solid rgba(34,197,94,.35); background:rgba(34,197,94,.08); color:#86EFAC; font-size:11px; cursor:pointer; font-family:monospace }
        .admin-verify-btn:hover{ background:rgba(34,197,94,.18) }
        .admin-reject-btn{ padding:5px 10px; border-radius:7px; border:1px solid rgba(239,68,68,.35); background:rgba(239,68,68,.08); color:#FCA5A5; font-size:11px; cursor:pointer }
        .admin-reject-btn:hover{ background:rgba(239,68,68,.18) }
        .admin-live{ font-size:10px; font-weight:400; color:#64748b; }
        .admin-live.on{ color:#86EFAC; }
        .admin-detail{ color:var(--muted); font-size:11px; }
        .admin-search{ display:flex; gap:8px }
        .admin-input{ flex:1; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,.1); background:rgba(0,0,0,.22); color:var(--text); font-size:12.5px }
        .admin-btn{ padding:8px 14px; border-radius:8px; border:none; cursor:pointer; font-size:11px; font-weight:800; text-transform:uppercase; background:linear-gradient(90deg,#1E3A8A,#2563EB); color:#fff }
        .admin-btn.small{ align-self:flex-start; padding:6px 10px; font-size:10px }
        .admin-card.audit{ font-size:12px }
        .admin-empty{ font-size:12.5px; color:var(--muted); text-align:center; padding:20px }
        .admin-once{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:8px 10px; border-radius:8px; background:rgba(251,191,36,.08); border:1px dashed rgba(251,191,36,.4); font-size:11.5px; color:#FDE68A }
        .admin-once code{ font-family:monospace; font-size:13px; color:#fff; user-select:all }
        .admin-skel{ pointer-events:none; }
        .skel-line{ height:14px; border-radius:6px; background:linear-gradient(90deg, rgba(255,255,255,.04), rgba(255,255,255,.1), rgba(255,255,255,.04)); background-size:200% 100%; animation:skel 1.2s ease-in-out infinite; }
        .skel-line.short{ width:55%; }
        @keyframes skel{ to{ background-position:-200% 0 } }
      `}</style>
    </div>
  );
}
