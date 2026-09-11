import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../components/ui/ToastProvider';
import { useOnboarding } from '../store/useOnboarding';

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string | null;
  is_staff: boolean;
  created_at: string | null;
  done_stage1: string[];
  lead_email: string;
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
  const [tab, setTab] = useState<'pending' | 'users' | 'audit' | 'codes' | 'wifi' | 'settings'>('pending');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [wifiReqs, setWifiReqs] = useState<{ user_id: number; email: string; name: string; mac: string; sent_at: string | null; has_password: boolean; verified: boolean }[]>([]);
  const [wifiPwForm, setWifiPwForm] = useState<Record<number, string>>({});
  const [liveOn, setLiveOn] = useState(false);
  const prevPending = useRef(0);
  const [codes, setCodes] = useState<MpulseCode[]>([]);
  const [links, setLinks] = useState<Links | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newBatch, setNewBatch] = useState('');
  const [wifiPw, setWifiPw] = useState<Record<number, string>>({});
  const [leadForm, setLeadForm] = useState<Record<number, string>>({});
  const [tgGroupsJson, setTgGroupsJson] = useState('[]');
  const [tgRights, setTgRights] = useState<{ bot: string; groups: { title: string; ok: boolean; detail: string; roles?: string[] }[] } | null>(null);

  const loadTgGroups = useCallback(async () => {
    try {
      const r = await api.get<{ groups: { title: string; chat_id: string }[] }>('/api/integrations/telegram-groups');
      setTgGroupsJson(JSON.stringify(r.groups, null, 1));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadTgGroups(); }, [loadTgGroups]);

  const loadExtras = useCallback(async () => {
    try {
      const [w, s] = await Promise.all([
        api.get<{ user_id: number; email: string; name: string; mac: string; sent_at: string | null; has_password: boolean; verified: boolean }[]>('/api/admin/wifi-requests'),
        api.get<{ contacts: Record<string, string> }>('/api/admin/settings'),
      ]);
      setWifiReqs(w);
      setContacts(s.contacts);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadExtras(); }, [loadExtras]);

  const saveContact = async (key: string) => {
    try {
      const r = await api.patch<{ contacts: Record<string, string> }>('/api/admin/settings', { key, value: contacts[key] ?? '' });
      setContacts(r.contacts);
      setMsg(`✓ ${key} сохранён`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка сохранения');
    }
  };

  const setWifiPwAdmin = async (userId: number) => {
    const password = (wifiPwForm[userId] ?? '').trim();
    try {
      const r = await api.post<{ ok: boolean; password: string; user_id: number }>(
        '/api/admin/wifi-password', { user_id: userId, password },
      );
      setWifiPw((prev) => ({ ...prev, [userId]: r.password }));
      setWifiPwForm((prev) => ({ ...prev, [userId]: '' }));
      setMsg(password ? '✓ Пароль сохранён, сотрудник увидит его в интерфейсе' : '✓ Пароль сгенерирован (показан один раз)');
      await loadExtras();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const saveTgGroups = async () => {
    try {
      await api.patch('/api/admin/settings', { key: 'telegram.groups_json', value: tgGroupsJson });
      setMsg('✓ Группы Telegram сохранены');
      await loadTgGroups();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка сохранения');
    }
  };

  const checkTgRights = async () => {
    try {
      const r = await api.get<{ bot: string; groups: { title: string; ok: boolean; detail: string; roles?: string[] }[] }>('/api/integrations/telegram-check-rights');
      setTgRights(r);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Бот недоступен');
    }
  };
  const toast = useToast();
  const [rejectFor, setRejectFor] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const DOC_TITLES: Record<string, string> = {
    '1-dogovor': 'Договор об оказании услуг (2 экз., подписан)',
    '1-nda': 'NDA (2 экз., подписано)',
    '1-pdp': 'Соглашение о персональных данных (подписано)',
    '1-ip': 'Реквизиты ИП (приложены)',
    '1-sn': 'Справка о несудимости (актуальна)',
  };

  // группировка очереди по сотрудникам: один мини-документ на человека (+ фильтр по задаче)
  const visiblePending = taskFilter === 'all' ? pending : pending.filter((r) => r.task_id === taskFilter);
  const pendingByUser = visiblePending.reduce<Record<number, { user_id: number; email: string; name: string; rows: PendingRow[] }>>((acc, r) => {
    (acc[r.user_id] ??= { user_id: r.user_id, email: r.email, name: r.name, rows: [] }).rows.push(r);
    return acc;
  }, {});
  const pendingGroups = Object.values(pendingByUser);

  const verifyBatch = async (userId: number) => {
    try {
      await api.post('/api/verify-docs-batch', { task_ids: DOC_TASKS, user_id: userId });
      setMsg('✓ Пакет документов подтверждён (+5 баллов сотруднику)');
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка верификации');
    }
  };

  const rejectBatch = async (userId: number) => {
    const reason = rejectReason.trim();
    if (reason.length < 10) { setMsg('Укажите причину отклонения (мин 10 символов)'); return; }
    try {
      const rows = pendingByUser[userId]?.rows ?? [];
      for (const r of rows.filter((x) => DOC_TASKS.includes(x.task_id))) {
        await api.post(`/api/admin/pending/${r.id}/reject`, { reason });
      }
      setRejectFor(null);
      setRejectReason('');
      setMsg('Пакет отклонён, сотрудник уведомлён');
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка отклонения');
    }
  };

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
        const text = fresh ? `Новый запрос: ${fresh.name} — ${fresh.task_id}` : 'Новые запросы';
        setMsg(`🔔 ${text}`);
        toast.info(text, 'Откройте вкладку «Ожидают»');
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
      await api.post(`/api/admin/pending/${r.id}/reject`, { reason: 'Отклонено HR — уточните детали у HR' });
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
        {(['pending', 'users', 'audit', 'codes', 'wifi', 'settings'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`admin-tab ${tab === t ? 'active' : ''}`}>
            {t === 'pending' ? `Ожидают (${pending.length})` : t === 'users' ? 'Сотрудники' : t === 'audit' ? `Журнал (${audit.length})` : t === 'codes' ? 'Коды и ссылки' : t === 'wifi' ? 'Wi-Fi запросы' : 'Настройки'}
          </button>
        ))}
        <button type="button" onClick={() => load()} className="admin-tab" disabled={loading}>↻</button>
      </div>
      {msg && <div className="admin-msg">{msg}</div>}

      {tab === 'pending' && (
        <div className="admin-list">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', '1-mbusiness', '1-accountant', '1-wifi', '1-proxy', '1-telegram', '1-jira', '1-figma', '1-gitlab'].map((f) => (
              <button key={f} type="button" onClick={() => setTaskFilter(f)} className={`admin-tab ${taskFilter === f ? 'active' : ''}`}>
                {f === 'all' ? 'Все' : f.replace('1-', '')}
              </button>
            ))}
          </div>
          {loading && !pending.length && [0, 1, 2].map((i) => (
            <div key={i} className="admin-card admin-skel"><div className="skel-line" /><div className="skel-line short" /></div>
          ))}
          {pendingGroups.filter((g) => g.rows.some((r) => DOC_TASKS.includes(r.task_id))).map((g) => {
            const first = g.rows[0];
            const docRows = g.rows.filter((r) => DOC_TASKS.includes(r.task_id));
            return (
              <div key={g.user_id} className="admin-card hr-doc">
                <div className="admin-card-head">
                  <span className="admin-avatar">{(g.name || g.email).slice(0, 1).toUpperCase()}</span>
                  <div>
                    <b>{g.name}</b>
                    <div className="admin-email">{g.email} · отправлено {first.created_at ? ago(first.created_at) : '—'}</div>
                  </div>
                </div>
                <div className="admin-card-sub">Пакет документов на физическую проверку — сверьте 5 пунктов, затем подтвердите:</div>
                <ul className="hr-checklist">
                  {DOC_TASKS.map((tid) => {
                    const sent = docRows.some((r) => r.task_id === tid);
                    return (
                      <li key={tid} className={sent ? 'sent' : 'missing'}>
                        <span className="hr-check">{sent ? '✓' : '○'}</span> {DOC_TITLES[tid]}
                      </li>
                    );
                  })}
                </ul>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => verifyBatch(g.user_id)} className="admin-btn small">
                    Подтвердить получение и проверку документов
                  </button>
                  <button type="button" onClick={() => { setRejectFor(rejectFor === g.user_id ? null : g.user_id); setRejectReason(''); }} className="admin-reject-btn">
                    Отклонить
                  </button>
                </div>
                {rejectFor === g.user_id && (
                  <div className="hr-reject">
                    <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Причина отклонения (мин 10 символов), например: не хватает справки о несудимости" rows={2} className="admin-input" />
                    <button type="button" onClick={() => rejectBatch(g.user_id)} className="admin-reject-btn" disabled={rejectReason.trim().length < 10}>
                      Отклонить пакет
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {pending.filter((r) => !DOC_TASKS.includes(r.task_id)).map((r) => (
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

      {tab === 'wifi' && (
        <div className="admin-list">
          <div className="admin-card">
            <div className="admin-card-head"><b>Wi-Fi запросы</b></div>
            <div className="admin-card-sub">MAC от сотрудников · введите пароль → Сохранить → система покажет его сотруднику под полем MAC.</div>
          </div>
          {wifiReqs.map((w) => (
            <div key={`${w.user_id}-${w.mac}`} className="admin-card">
              <div className="admin-card-head">
                <b>{w.name}</b> <span className="admin-email">{w.email}</span>
                {w.verified && <span className="admin-staff-badge">подтверждён</span>}
                {!w.verified && w.has_password && <span className="admin-staff-badge">пароль задан</span>}
              </div>
              <div className="admin-card-sub">
                MAC: <code style={{ fontFamily: 'monospace' }}>{w.mac}</code> · отправлен {w.sent_at ? ago(w.sent_at) : '—'}
              </div>
              {!w.verified && (
                <div className="admin-search">
                  <input
                    value={wifiPwForm[w.user_id] ?? ''}
                    onChange={(e) => setWifiPwForm((p) => ({ ...p, [w.user_id]: e.target.value }))}
                    placeholder="Пароль (пусто = сгенерировать)"
                    className="admin-input"
                  />
                  <button type="button" onClick={() => setWifiPwAdmin(w.user_id)} className="admin-btn small">Сохранить</button>
                </div>
              )}
              {wifiPw[w.user_id] && (
                <div className="admin-once">
                  <code>{wifiPw[w.user_id]}</code>
                  <span>— показан один раз, сотрудник уже видит его в интерфейсе</span>
                </div>
              )}
            </div>
          ))}
          {!wifiReqs.length && !loading && <div className="admin-empty">MAC-адресов пока нет</div>}
        </div>
      )}

      {tab === 'settings' && (
        <div className="admin-list">
          <div className="admin-card">
            <div className="admin-card-head"><b>Настройки → Контакты</b></div>
            <div className="admin-card-sub">Email ответственных (можно несколько через запятую). Уведомления о запросах уходят сюда; если пусто — HR. Меняются в любой момент без редеплоя.</div>
          </div>
          {[
            { key: 'contacts.hr_email', label: 'HR' },
            { key: 'contacts.sysadmin_email', label: 'Сетевик(и) — можно несколько через запятую' },
            { key: 'contacts.lead_email', label: 'Lead / PM (глобальный; per-employee задаётся в карточке сотрудника)' },
            { key: 'contacts.accountant_email', label: 'Бухгалтер' },
            { key: 'contacts.teamlead_email', label: 'Тимлид' },
          ].map((c) => (
            <div key={c.key} className="admin-card">
              <div className="admin-card-head"><b>{c.label}</b></div>
              <div className="admin-search">
                <input
                  value={contacts[c.key] ?? ''}
                  onChange={(e) => setContacts((p) => ({ ...p, [c.key]: e.target.value }))}
                  placeholder="email@example.com"
                  className="admin-input"
                />
                <button type="button" onClick={() => saveContact(c.key)} className="admin-btn small">Сохранить</button>
              </div>
            </div>
          ))}
          <div className="admin-card">
            <div className="admin-card-head"><b>Инструкция для бухгалтера</b></div>
            <div className="admin-card-sub">Показывается сотруднику в задаче «Доступ бухгалтеру».</div>
            <textarea
              value={contacts['instruction.accountant'] ?? ''}
              onChange={(e) => setContacts((p) => ({ ...p, ['instruction.accountant']: e.target.value }))}
              rows={3}
              className="admin-input"
              placeholder="Текст инструкции (пока заглушка)…"
            />
            <div><button type="button" onClick={() => saveContact('instruction.accountant')} className="admin-btn small">Сохранить инструкцию</button></div>
          </div>
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
                <div className="admin-card-sub">Stage 1: {u.done_stage1.length} задач · Лид: {u.lead_email || '— (глобальный)'}</div>
                {renderTasks(u)}
                <div className="admin-search">
                  <input
                    value={leadForm[u.id] ?? u.lead_email}
                    onChange={(e) => setLeadForm((p) => ({ ...p, [u.id]: e.target.value }))}
                    placeholder="Email лида (пусто = глобальный)"
                    className="admin-input"
                  />
                  <button type="button" onClick={async () => {
                    try {
                      const updated = await api.patch<AdminUser>(`/api/admin/users/${u.id}/lead`, { lead_email: leadForm[u.id] ?? '' });
                      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
                      setMsg(`✓ Лид для ${u.email}: ${updated.lead_email || 'глобальный'}`);
                    } catch (e) {
                      setMsg(e instanceof Error ? e.message : 'Ошибка');
                    }
                  }} className="admin-btn small">Лид</button>
                </div>
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
            <div className="admin-card-head"><b>Telegram-группы (auto-add)</b></div>
            <div className="admin-card-sub">JSON: title + chat_id + roles (frontend/backend/design; пустой = всем). Бот должен быть админом (can_invite_users).</div>
            <textarea value={tgGroupsJson} onChange={(e) => setTgGroupsJson(e.target.value)} rows={3} className="admin-input" style={{ fontFamily: 'monospace', fontSize: 11 }} placeholder='[{"title":"Dev","chat_id":"-100123"}]' />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={saveTgGroups} className="admin-btn small">Сохранить группы</button>
              <button type="button" onClick={checkTgRights} className="admin-btn small">Проверить права бота</button>
            </div>
            {tgRights && (
              <div style={{ fontSize: 11.5, lineHeight: 1.7 }}>
                <div>Бот: @{tgRights.bot || '—'}</div>
                {tgRights.groups.map((g: { title: string; chat_id?: string; ok: boolean; detail: string; roles?: string[] }) => (
                  <div key={g.title} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>{g.ok ? '✓' : '✗'} {g.title} [{(g.roles && g.roles.length ? g.roles : ['все']).join(',')}] — {g.detail}</span>
                    {g.chat_id && (
                      <button
                        type="button"
                        className="admin-reject-btn"
                        onClick={async () => {
                          try {
                            const cur = JSON.parse(tgGroupsJson || '[]') as { title: string; chat_id: string; roles?: string[] }[];
                            const rest = cur.filter((x) => String(x.chat_id) !== String(g.chat_id));
                            await api.patch('/api/admin/settings', { key: 'telegram.groups_json', value: JSON.stringify(rest), mode: 'replace' });
                            setMsg(`✓ Группа ${g.title} удалена`);
                            await loadTgGroups();
                          } catch (e) {
                            setMsg(e instanceof Error ? e.message : 'Ошибка удаления');
                          }
                        }}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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
        .admin-card.hr-doc{ border-color:rgba(59,130,246,.3); background:rgba(37,99,235,.05); }
        .admin-avatar{ width:34px; height:34px; border-radius:50%; display:grid; place-items:center; flex-shrink:0; font-weight:800; font-size:14px; color:#fff; background:linear-gradient(135deg,#1E3A8A,#2563EB); }
        .hr-checklist{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; font-size:12px; }
        .hr-checklist li{ display:flex; gap:8px; align-items:center; padding:7px 10px; border-radius:8px; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.06); }
        .hr-checklist li.sent{ border-color:rgba(34,197,94,.25); }
        .hr-checklist li.missing{ opacity:.55; }
        .hr-check{ color:#86EFAC; font-weight:800; }
        .hr-checklist li.missing .hr-check{ color:#64748b; }
        .hr-reject{ display:flex; flex-direction:column; gap:8px; }
        .hr-reject textarea{ min-height:56px; resize:vertical; }
        .admin-skel{ pointer-events:none; }
        .skel-line{ height:14px; border-radius:6px; background:linear-gradient(90deg, rgba(255,255,255,.04), rgba(255,255,255,.1), rgba(255,255,255,.04)); background-size:200% 100%; animation:skel 1.2s ease-in-out infinite; }
        .skel-line.short{ width:55%; }
        @keyframes skel{ to{ background-position:-200% 0 } }
      `}</style>
    </div>
  );
}
