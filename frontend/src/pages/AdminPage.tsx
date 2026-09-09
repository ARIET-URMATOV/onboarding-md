import { useCallback, useEffect, useState } from 'react';
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
  created_at: string | null;
}

const DOC_TASKS = ['1-dogovor', '1-nda', '1-pdp', '1-ip', '1-sn'];
const ACCESS_TASKS = ['1-mbusiness', '1-accountant', '1-wifi', '1-proxy', '1-telegram'];

export function AdminPage() {
  const user = useOnboarding((s) => s.user);
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pending, setPending] = useState<AdminUser[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'users' | 'audit'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [p, a] = await Promise.all([
        api.get<AdminUser[]>('/api/admin/pending-verifications'),
        api.get<AuditRow[]>('/api/admin/audit'),
      ]);
      setPending(p);
      setAudit(a);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка верификации');
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
      <h1 className="admin-title">HR-панель · Этап 1 «Документы и доступы»</h1>
      <div className="admin-tabs">
        {(['pending', 'users', 'audit'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`admin-tab ${tab === t ? 'active' : ''}`}>
            {t === 'pending' ? `Ожидают (${pending.length})` : t === 'users' ? 'Сотрудники' : `Журнал (${audit.length})`}
          </button>
        ))}
        <button type="button" onClick={load} className="admin-tab" disabled={loading}>↻</button>
      </div>
      {msg && <div className="admin-msg">{msg}</div>}

      {tab === 'pending' && (
        <div className="admin-list">
          {pending.map((u) => (
            <div key={u.id} className="admin-card">
              <div className="admin-card-head">
                <b>{u.name}</b> <span className="admin-email">{u.email}</span>
                {u.is_staff && <span className="admin-staff-badge">staff</span>}
              </div>
              <div className="admin-card-sub">Отмечено: {u.done_stage1.length} · нажмите задачу чтобы подтвердить</div>
              {renderTasks(u)}
            </div>
          ))}
          {!pending.length && !loading && <div className="admin-empty">Нет ожидающих — все завершили Stage 1</div>}
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
                <button type="button" onClick={() => toggleStaff(u)} className="admin-btn small">
                  {u.is_staff ? 'Снять staff' : 'Дать staff'}
                </button>
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
            </div>
          ))}
          {!audit.length && !loading && <div className="admin-empty">Журнал пуст</div>}
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
        .admin-search{ display:flex; gap:8px }
        .admin-input{ flex:1; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,.1); background:rgba(0,0,0,.22); color:var(--text); font-size:12.5px }
        .admin-btn{ padding:8px 14px; border-radius:8px; border:none; cursor:pointer; font-size:11px; font-weight:800; text-transform:uppercase; background:linear-gradient(90deg,#1E3A8A,#2563EB); color:#fff }
        .admin-btn.small{ align-self:flex-start; padding:6px 10px; font-size:10px }
        .admin-card.audit{ font-size:12px }
        .admin-empty{ font-size:12.5px; color:var(--muted); text-align:center; padding:20px }
      `}</style>
    </div>
  );
}
