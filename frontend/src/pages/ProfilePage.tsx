import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Pencil } from 'lucide-react';
import { TopBar, DefaultAvatar } from '../components/layout/TopBar';
import { getProgress, useOnboarding } from '../store/useOnboarding';
import { usePageMeta } from '../hooks/usePageMeta';

function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas недоступен')); return; }
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать изображение')); };
    img.src = url;
  });
}

export function ProfilePage() {
  usePageMeta('Профиль — MDIGITAL Онбординг', 'Твой профиль: данные сотрудника, аватар и прогресс онбординга.');
  const nav = useNavigate();
  const user = useOnboarding((s) => s.user);
  const xp = useOnboarding((s) => s.xp);
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const progress = useMemo(() => getProgress(doneTasks), [doneTasks]);
  const lvl = Math.floor(xp / 100) + 1;
  const updateProfile = useOnboarding((s) => s.updateProfile);
  const logout = useOnboarding((s) => s.logout);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar ?? null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!user) return null;

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      setProfileError('Поддерживаются PNG, JPEG и WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Файл больше 5 МБ');
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarPreview(dataUrl);
      setProfileError(null);
      await saveAvatar(dataUrl);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  };

  const saveAvatar = async (avatar: string) => {
    setProfileError(null);
    try {
      await updateProfile({ avatar });
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 2200);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  };

  const onLogout = async () => {
    await logout();
    nav('/login');
  };

  return (
    <>
      <TopBar />
      <div className="pf-bg" aria-hidden />
      <main className="pf-page">
        <motion.div
          className="pf-card"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <button type="button" className="pf-back" onClick={() => nav(-1)}>← Назад</button>
          <h1 className="pf-title font-orbitron">Профиль</h1>

          {/* Аватар-планета с орбитой */}
          <div className="pf-avatar-wrap">
            <span className="pf-orbit" aria-hidden />
            <button
              type="button"
              className="pf-avatar"
              onClick={() => fileRef.current?.click()}
              aria-label="Сменить фото"
            >
              {avatarPreview
                ? <img src={avatarPreview} alt="Аватар" />
                : <DefaultAvatar size={120} />}
              <span className="pf-avatar-hover">Сменить фото</span>
            </button>
            <button type="button" className="pf-avatar-badge" aria-label="Сменить фото" onClick={() => fileRef.current?.click()}>
              <Pencil size={14} strokeWidth={2.1} />
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={onPickFile} />
          </div>
          <div className="pf-xp" aria-hidden>
            {user.email}
          </div>

          {/* XP — перенесён из шапки (виден на мобилках) */}
          <button type="button" className="pf-xpCard" onClick={() => nav('/stages')} title="Перейти к этапам">
            <span className="pf-xpLvl">Lv.{lvl}</span>
            <span className="pf-xpBar" aria-hidden><i style={{ width: `${progress.pct}%` }} /></span>
            <span className="pf-xpNum">{xp >= 1000 ? `${(xp / 1000).toFixed(1)}k` : xp} XP</span>
            <span className="pf-xpDone">{progress.done}/5</span>
          </button>

          {/* Личные данные — только просмотр */}
          <section className="pf-section">
            <div className="pf-label">Личные данные</div>
            <div className="pf-field-readonly">
              <span>Имя</span>
              <span className="pf-value">{user.name}</span>
            </div>
            <div className="pf-field-readonly">
              <span>Email</span>
              <span className="pf-value">{user.email}</span>
            </div>
            {user.telegramUsername && (
              <div className="pf-field-readonly">
                <span>Telegram</span>
                <span className="pf-value">{user.telegramUsername}</span>
              </div>
            )}
            {profileError && <div className="pf-error">{profileError}</div>}
            {profileSaved && <div className="pf-ok">Фото обновлено ✓</div>}
          </section>

          {/* Рабочая информация — только просмотр */}
          <section className="pf-section">
            <div className="pf-label">Рабочая информация</div>
            {user.department && (
              <div className="pf-field-readonly">
                <span>Департамент</span>
                <span className="pf-value">{user.department}</span>
              </div>
            )}
            {user.position && (
              <div className="pf-field-readonly">
                <span>Должность</span>
                <span className="pf-value">{user.position}</span>
              </div>
            )}
            {user.office && (
              <div className="pf-field-readonly">
                <span>Офис</span>
                <span className="pf-value">{user.office}</span>
              </div>
            )}
            {user.ad_login && (
              <div className="pf-field-readonly">
                <span>AD логин</span>
                <span className="pf-value">{user.ad_login}</span>
              </div>
            )}
            {!user.department && !user.position && !user.office && !user.ad_login && (
              <div className="pf-empty">Данные не загружены</div>
            )}
          </section>

          {/* Опасная зона */}
          <section className="pf-section danger">
            <div className="pf-label">Опасная зона</div>
            <button type="button" className="pf-logout" onClick={onLogout}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Выйти из аккаунта
            </button>
          </section>
        </motion.div>
      </main>

      <style>{`
        .pf-bg {
          position: fixed; inset: 0; z-index: -1;
          background:
            radial-gradient(ellipse 60% 40% at 50% -10%, rgba(37, 99, 235, 0.14), transparent 60%),
            radial-gradient(ellipse 40% 30% at 85% 100%, rgba(30, 58, 138, 0.12), transparent 60%),
            #0A0F1E;
        }
        .pf-page {
          min-height: 100vh;
          display: grid; place-items: start center;
          padding: 32px 16px 64px;
          font-family: 'Inter', sans-serif;
        }
        .pf-card {
          position: relative;
          width: 100%; max-width: 460px;
          padding: 56px 32px 32px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(37, 99, 235, 0.16);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4), 0 0 60px rgba(37, 99, 235, 0.06);
        }
        .pf-back {
          position: absolute; top: 18px; left: 20px;
          background: none; border: none; cursor: pointer;
          display: inline-flex; align-items: center; gap: 4px;
          font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 500;
          color: rgba(255, 255, 255, 0.4); transition: color .15s ease;
        }
        .pf-back:hover { color: #93C5FD; }
        .pf-title {
          text-align: center;
          font-size: 16px; font-weight: 800; letter-spacing: 0.24em; text-transform: uppercase;
          color: #fff; margin: 0 0 8px;
          text-shadow: 0 0 24px rgba(37, 99, 235, 0.4);
        }

        /* --- аватар-планета --- */
        .pf-avatar-wrap {
          position: relative;
          width: 148px; height: 148px;
          margin: 20px auto 6px;
          display: grid; place-items: center;
        }
        .pf-orbit {
          position: absolute; inset: -12px;
          border-radius: 50%;
          border: 1.5px dashed rgba(59, 130, 246, 0.4);
          animation: pfOrbit 16s linear infinite;
        }
        .pf-orbit::before {
          content: '';
          position: absolute; top: -4px; left: 50%;
          width: 7px; height: 7px; border-radius: 50%;
          background: #3B82F6;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.9);
          transform: translateX(-50%);
        }
        @keyframes pfOrbit { to { transform: rotate(360deg); } }
        .pf-avatar {
          position: relative;
          width: 132px; height: 132px;
          border-radius: 50%;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid rgba(59, 130, 246, 0.45);
          background: #16233A;
          box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.08), 0 0 40px rgba(37, 99, 235, 0.3);
          padding: 0;
        }
        .pf-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pf-avatar-badge {
          position: absolute; right: 8px; bottom: 8px;
          width: 32px; height: 32px; border-radius: 50%;
          display: grid; place-items: center;
          background: linear-gradient(135deg, #3B82F6, #2563EB);
          border: 2px solid #0A0F1E;
          color: #fff;
          box-shadow: 0 4px 16px rgba(0,0,0,.35), 0 0 16px rgba(37,99,235,.4);
          cursor: pointer; z-index: 2; padding: 0;
        }
        .pf-avatar-badge:hover { transform: scale(1.06); }
        .pf-avatar-badge:active { transform: scale(0.96); }
        .pf-avatar-hover {
          position: absolute; inset: 0;
          display: grid; place-items: center;
          background: rgba(10, 15, 30, 0.72);
          color: #DBEAFE; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em;
          opacity: 0; transition: opacity .18s ease;
        }
        .pf-avatar:hover .pf-avatar-hover, .pf-avatar:focus-visible .pf-avatar-hover { opacity: 1; }
        .pf-xp {
          text-align: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: #64748B; letter-spacing: 0.04em;
          margin-bottom: 12px;
        }
        .pf-xpCard {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; border-radius: 12px; cursor: pointer;
          background: rgba(37, 99, 235, 0.08); border: 1px solid rgba(37, 99, 235, 0.16);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          transition: all .2s ease; font: inherit; color: inherit;
        }
        .pf-xpCard:hover { background: rgba(37, 99, 235, 0.13); border-color: rgba(37, 99, 235, 0.28); transform: translateY(-1px); }
        .pf-xpLvl { font-size: 12px; font-weight: 700; color: rgba(37, 99, 235, 0.9); letter-spacing: .04em; flex-shrink: 0; }
        .pf-xpBar { flex: 1; height: 4px; border-radius: 2px; background: rgba(37, 99, 235, 0.16); overflow: hidden; }
        .pf-xpBar i { display: block; height: 100%; background: linear-gradient(90deg, #2563EB, #1E3A8A); border-radius: 2px; transition: width .6s ease; box-shadow: 0 0 12px rgba(37,99,235,0.35); }
        .pf-xpNum { font-size: 12px; font-weight: 600; color: rgba(255,255,255,.7); flex-shrink: 0; }
        .pf-xpDone { font-size: 11px; font-weight: 600; color: #93C5FD; flex-shrink: 0; }

        /* --- секции --- */
        .pf-section { margin-top: 22px; }
        .pf-label {
          font-size: 9.5px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase;
          color: rgba(96, 165, 250, 0.75);
          padding-bottom: 8px; margin-bottom: 14px;
          border-bottom: 1px solid rgba(37, 99, 235, 0.14);
        }
        .pf-field { display: block; margin-bottom: 12px; }
        .pf-field span {
          display: block; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          color: #64748B; margin-bottom: 7px;
        }
        .pf-field input {
          width: 100%; padding: 12px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(37, 99, 235, 0.16);
          border-radius: 10px; color: #E2E8F0; font-size: 13.5px; font-family: 'Inter', sans-serif;
          outline: none; transition: border-color .15s ease, box-shadow .15s ease;
        }
        .pf-field input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
        .pf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .pf-error {
          margin: 4px 0 10px; padding: 9px 12px;
          border: 1px solid rgba(248, 113, 113, 0.4);
          background: rgba(248, 113, 113, 0.08);
          color: #FCA5A5; font-size: 12px; border-radius: 9px;
        }
        .pf-ok {
          margin: 4px 0 10px; padding: 9px 12px;
          border: 1px solid rgba(52, 211, 153, 0.4);
          background: rgba(52, 211, 153, 0.08);
          color: #6EE7B7; font-size: 12px; border-radius: 9px;
        }
        .pf-save {
          width: 100%; padding: 12px 16px; margin-top: 2px;
          border: none; border-radius: 11px; cursor: pointer;
          font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #fff;
          background: linear-gradient(135deg, #3B82F6, #2563EB);
          box-shadow: 0 0 22px rgba(37, 99, 235, 0.35);
          transition: all .18s ease;
        }
        .pf-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 0 30px rgba(37, 99, 235, 0.5); }
        .pf-save:disabled { opacity: 0.65; cursor: wait; }
        .pf-save.ghost {
          background: transparent; color: #93C5FD;
          border: 1px solid rgba(37, 99, 235, 0.3); box-shadow: none;
        }
        .pf-save.ghost:hover:not(:disabled) { background: rgba(37, 99, 235, 0.1); color: #fff; box-shadow: none; }

        .pf-section.danger { border-top: 1px dashed rgba(255, 255, 255, 0.08); padding-top: 18px; }

        /* --- readonly fields for AD users --- */
        .pf-field-readonly {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 12px; margin-bottom: 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(37, 99, 235, 0.12);
          border-radius: 9px;
        }
        .pf-field-readonly span:first-child {
          font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          color: #64748B;
        }
        .pf-value {
          font-size: 13.5px; font-weight: 500; color: #E2E8F0;
          font-family: 'Inter', sans-serif;
        }
        .pf-empty {
          padding: 16px; text-align: center;
          color: #64748B; font-size: 13px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(37, 99, 235, 0.2);
          border-radius: 10px;
        }

        .pf-logout {
          width: 100%; padding: 11px 16px;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          background: rgba(248, 113, 113, 0.06);
          border: 1px solid rgba(248, 113, 113, 0.28);
          border-radius: 11px; cursor: pointer;
          color: #FCA5A5; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 600;
          transition: all .18s ease;
        }
        .pf-logout svg { width: 15px; height: 15px; }
        .pf-logout:hover { background: rgba(248, 113, 113, 0.14); border-color: rgba(248, 113, 113, 0.5); color: #fff; }

        @media (max-width: 480px) {
          .pf-page { padding: 20px 12px 48px; }
          .pf-card { padding: 48px 20px 24px; }
          .pf-avatar-wrap { width: 128px; height: 128px; }
          .pf-avatar { width: 114px; height: 114px; }
          .pf-avatar-badge { width: 28px; height: 28px; right: 6px; bottom: 6px; }
          .pf-row { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pf-orbit { animation: none; }
        }
      `}</style>
    </>
  );
}
