import { Stage2Team } from '../Stage2Team';
import { Stage3Video } from '../Stage3Video';
import { Stage4Checklist } from '../Stage4Checklist';
import type { StageId } from '../../../data/stages';

export function Stage4TeamVideoChecklist({ stageId, onVideoEnded }: { stageId: StageId, onVideoEnded: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 style={{ fontSize: '15px', color: '#60A5FA', margin: '0 0 12px 0', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Часть 1: Знакомство с командой</h3>
        <Stage2Team stageId={stageId} />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 style={{ fontSize: '15px', color: '#60A5FA', margin: '0 0 12px 0', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Часть 2: Приветственное видео</h3>
        <Stage3Video stageId={stageId} onVideoEnded={onVideoEnded} />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 style={{ fontSize: '15px', color: '#60A5FA', margin: '0 0 12px 0', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Часть 3: Чек-лист первого дня</h3>
        <Stage4Checklist stageId={stageId} />
      </div>
    </div>
  );
}
