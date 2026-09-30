import type { StageId } from '../../../data/stages';
import { useOnboarding } from '../../../store/useOnboarding';

export function Stage5Dept({}: { stageId: StageId }) {
  const user = useOnboarding((s: any) => s.user);
  
  const deptLabel = typeof user?.department === 'string' 
    ? user.department 
    : user?.department?.display_name || 'Твой департамент';

  return (
    <div className="s5-dept">
      <div className="dept-banner">
        <div className="dept-icon">🏢</div>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#fff' }}>Добро пожаловать в {deptLabel}!</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF' }}>Задачи ниже настроены специально для твоего направления. Выполни их для успешного завершения онбординга.</p>
        </div>
      </div>
      
      <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.2)' }}>
        <h4 style={{ margin: '0 0 10px', color: '#60A5FA', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Финальный тест</h4>
        <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#cbd5e1' }}>Пройди тест по пройденному материалу, чтобы закрепить знания и получить сертификат.</p>
        <button 
          className="btn-primary" 
          onClick={() => alert('Здесь будет открыт финальный тест для ' + deptLabel)}
          style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '8px' }}
        >
          НАЧАТЬ ТЕСТ
        </button>
      </div>

      <style>{`
        .s5-dept { display: flex; flex-direction: column; gap: 16px; }
        .dept-banner {
          display: flex; gap: 16px; align-items: center;
          padding: 16px; border-radius: 12px;
          background: linear-gradient(135deg, rgba(37,99,235,0.1), rgba(16,185,129,0.05));
          border: 1px solid rgba(37,99,235,0.2);
        }
        .dept-icon { font-size: 32px; }
      `}</style>
    </div>
  );
}
