import { Building2, FlaskConical } from 'lucide-react';
import type { StageId } from '../../../data/stages';
import { useOnboarding } from '../../../store/useOnboarding';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

export function Stage5Dept(_props: { stageId: StageId }) {
  const user = useOnboarding((s) => s.user);

  const deptLabel = typeof user?.department === 'string'
    ? user.department
    : user?.department?.display_name || 'Твой департамент';

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 to-emerald-500/5">
        <CardContent className="flex items-center gap-4 pt-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-[15px]">Добро пожаловать в {deptLabel}!</CardTitle>
            <CardDescription className="mt-1 text-[13px]">Задачи ниже настроены специально для твоего направления. Выполни их для успешного завершения онбординга.</CardDescription>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[13px] uppercase tracking-wider text-primary">
            <FlaskConical className="h-4 w-4" /> Финальный тест
          </CardTitle>
          <CardDescription className="text-[13px]">Пройди тест по пройденному материалу, чтобы закрепить знания и получить сертификат.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" onClick={() => alert('Здесь будет открыт финальный тест для ' + deptLabel)}>
            Начать тест
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
