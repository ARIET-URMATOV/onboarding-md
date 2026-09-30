import { useState, useMemo } from 'react';
import { Smartphone, Apple, CircleCheck } from 'lucide-react';
import { useStages, useServices } from '../../api/queries';
import { useOnboarding } from '../../store/useOnboarding';
import type { StageId } from '../../data/stages';
import { api } from '../../api/client';
import { ServiceModal } from './ServiceModal';

export function Stage2AppDownload({ stageId }: { stageId: StageId }) {
  const done = useOnboarding((s) => s.doneTasks[stageId] || []);
  const toggleTask = useOnboarding((s) => s.toggleTask);
  const { data: services = [] } = useServices();
  
  const mpulseServices = useMemo(() => services.filter((s) => s.category === 'mpulse'), [services]);
  const isDone = ['1-mpulse','1-mpulse-schedule','1-mpulse-checkin','1-mpulse-code','1-mpulse-news'].every(id => done.includes(id));

  const [open, setOpen] = useState<string | null>(null);

  // Mpulse verification state inside the modal logic or inline
  // Using ServiceModal just like V1, assuming we can inject content or just use inline verification.
  // Actually, V1 used ServiceModal for the code entry. I will use inline state for simplicity.

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onVerifyMpulse = async () => {
    if (!code) return;
    setVerifying(true);
    setErr(null);
    try {
      await api.post('/api/progress/verify-mpulse-code', { code });
      ['1-mpulse','1-mpulse-schedule','1-mpulse-checkin','1-mpulse-code','1-mpulse-news'].forEach(id => {
        if (!done.includes(id)) toggleTask(stageId, id);
      });
    } catch (e: any) {
      setErr(e.message || 'Неверный код');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="s2-mpulse">
      <div className="mpulse-card">
        <div className="mpulse-head">
          <img src="/mpulse-logo.png" alt="MPulse" loading="lazy" className="mpulse-icon-img" />
          <div>
            <div className="mpulse-title">Установи корпоративное приложение</div>
            <div className="mpulse-sub">Авторизация через корпоративный AD. Внутри — твой график, новости и пропуски.</div>
          </div>
        </div>

        <ul className="mpulse-list">
          <li>Ежедневный <b>check-in / check-out</b></li>
          <li>Выбор формата работы (офис/удалёнка)</li>
          <li>Корпоративные новости и уведомления</li>
        </ul>

        <div className="mpulse-links">
          {mpulseServices.map((s) => (
            <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className={`mpulse-dl ${s.icon_key === 'Apple' ? 'apple' : 'google'}`}>
              {s.icon_key === 'Apple' ? <Apple size={14} /> : <Smartphone size={14} />}
              <span>{s.title}</span>
            </a>
          ))}
          {/* Fallback if services not loaded */}
          {mpulseServices.length === 0 && (
            <>
              <a href="https://apps.apple.com/us/app/mpulse-kg/id6740697046" target="_blank" rel="noopener noreferrer" className="mpulse-dl apple">
                <Apple size={14} /> <span>App Store</span>
              </a>
              <a href="https://play.google.com/store/apps/details?id=kg.pulse.app" target="_blank" rel="noopener noreferrer" className="mpulse-dl google">
                <Smartphone size={14} /> <span>Google Play</span>
              </a>
            </>
          )}
        </div>

        <div className="mpulse-verify">
          {isDone ? (
            <div className="mpulse-verify-done">
              <CircleCheck size={18} />
              <span>MPulse успешно привязан ✓</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', color: '#E5E7EB', fontWeight: 'bold' }}>Связать аккаунт</div>
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>Зайди в приложение под своим логином AD. В разделе «Онбординг» найди 6-значный код.</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  className="mpulse-input" 
                  value={code} 
                  onChange={e => setCode(e.target.value.replace(/[^0-9A-Z]/g, ''))} 
                  placeholder="КОД" 
                  maxLength={10}
                />
                <button className="mpulse-btn" onClick={onVerifyMpulse} disabled={verifying || !code}>
                  {verifying ? '...' : 'ПОДТВЕРДИТЬ'}
                </button>
              </div>
              {err && <div style={{ color: '#FCA5A5', fontSize: '11px' }}>{err}</div>}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .s2-mpulse { margin-top: 16px; }
        .mpulse-card {
          display: flex; flex-direction: column; gap: 16px;
          padding: 18px; border-radius: 12px;
          background: linear-gradient(180deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.02));
          border: 1px solid rgba(96, 165, 250, 0.2);
        }
        .mpulse-head { display: flex; gap: 14px; align-items: flex-start; }
        .mpulse-icon-img {
          width: 60px; height: 60px; border-radius: 14px; object-fit: contain;
          background: rgba(255, 255, 255, 0.05); border: 1px solid var(--blue-line); padding: 8px;
        }
        .mpulse-title { font-size: 15px; font-weight: 700; color: #E5E7EB; }
        .mpulse-sub { font-size: 12.5px; color: #9CA3AF; margin-top: 4px; line-height: 1.5; }
        .mpulse-list { margin: 0; padding-left: 18px; font-size: 12.5px; color: #cbd5e1; line-height: 1.7; }
        .mpulse-list li::marker { color: #3B82F6; }

        .mpulse-links { display: flex; gap: 10px; flex-wrap: wrap; }
        .mpulse-dl {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 600;
          text-decoration: none; color: #fff; background: #0A0A0A;
          border: 1px solid rgba(255,255,255,0.15); transition: transform 0.15s;
        }
        .mpulse-dl:active { transform: scale(0.96); }

        .mpulse-verify { padding: 14px; border-radius: 10px; background: rgba(0,0,0,0.25); border: 1px solid rgba(59,130,246,0.3); }
        .mpulse-verify-done { display: inline-flex; align-items: center; gap: 8px; color: #34D399; font-size: 13px; font-weight: bold; }
        .mpulse-input { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid #4B5563; padding: 10px; border-radius: 8px; color: #fff; font-family: monospace; outline: none; }
        .mpulse-input:focus { border-color: #3B82F6; }
        .mpulse-btn { background: #2563EB; color: #fff; border: none; padding: 0 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: background 0.15s; }
        .mpulse-btn:hover { background: #1D4ED8; }
        .mpulse-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
