import type { StageId } from '../../../data/stages';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import { BadgeCheck } from 'lucide-react';

export function Stage1Prelogin(_props: { stageId: StageId }) {
  return (
    <Alert className="border-emerald-500/40 bg-emerald-500/10">
      <BadgeCheck className="text-emerald-400" />
      <AlertTitle className="text-emerald-300">Этап завершён до старта! 🚀</AlertTitle>
      <AlertDescription className="text-sm leading-relaxed">
        Ты успешно подал заявку, прошёл проверку HR и получил доступ к своему корпоративному аккаунту.
        За это тебе уже начислен опыт (XP) первого этапа. Двигайся дальше!
      </AlertDescription>
    </Alert>
  );
}
