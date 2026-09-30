import type { StageId } from '../../../data/stages';

export function Stage1Prelogin({ stageId }: { stageId: StageId }) {
  return (
    <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #10B981', padding: '16px', borderRadius: '12px', color: '#E5E7EB' }}>
      <h3 style={{ color: '#10B981', margin: '0 0 10px 0', fontSize: '15px' }}>Этап завершён до старта! 🚀</h3>
      <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
        Ты успешно подал заявку, прошёл проверку HR и получил доступ к своему корпоративному аккаунту. 
        За это тебе уже начислен опыт (XP) первого этапа. Двигайся дальше!
      </p>
    </div>
  );
}
