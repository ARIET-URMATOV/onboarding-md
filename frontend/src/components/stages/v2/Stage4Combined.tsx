import { Stage2Team } from '../Stage2Team';
import { Stage3Video } from '../Stage3Video';
import { Stage4Checklist } from '../Stage4Checklist';
import type { StageId } from '../../../data/stages';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

function Part({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="text-[13px] uppercase tracking-wider text-primary">{n}: {title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Stage4TeamVideoChecklist({ stageId, onVideoEnded }: { stageId: StageId, onVideoEnded: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Part n="Часть 1" title="Знакомство с командой">
        <Stage2Team stageId={stageId} />
      </Part>
      <Part n="Часть 2" title="Приветственное видео">
        <Stage3Video stageId={stageId} onVideoEnded={onVideoEnded} />
      </Part>
      <Part n="Часть 3" title="Чек-лист первого дня">
        <Stage4Checklist stageId={stageId} />
      </Part>
    </div>
  );
}
