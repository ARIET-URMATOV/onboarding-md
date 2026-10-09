import { Building2, ExternalLink, FlaskConical, Link2 } from 'lucide-react';
import type { StageId } from '../../../data/stages';
import { useOnboarding } from '../../../store/useOnboarding';
import { useServices } from '../../../hooks/useServices';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { FadeContent } from '../../bits';

/** Этап 4 «Онбординг в департамент» (FR-406/407): ссылки департамента
 *  (репозиторий, Figma, style guide) берутся из external_services
 *  (category=dept, roles=[dept], управляются из админки), задачи —
 *  из stage_tasks c department (общий список ниже). */
export function Stage5Dept(_props: { stageId: StageId }) {
  const user = useOnboarding((s) => s.user);
  const { services = [] } = useServices();

  const deptLabel = typeof user?.department === 'string'
    ? user.department
    : user?.department?.display_name || 'Твой департамент';

  const deptLinks = services.filter((s) => s.category === 'dept' && s.task_id !== '5-take' && s.task_id !== '5-confirm');
  const testLink = services.find((s) => s.task_id === '5-take');

  return (
    <FadeContent className="mt-4">
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

        {deptLinks.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[13px] uppercase tracking-wider text-primary">
                <Link2 className="h-4 w-4" /> Ресурсы департамента
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {deptLinks.map((s) => (
                <Button key={s.key} variant="outline" className="h-auto justify-start gap-3 px-3 py-2.5 text-left" asChild>
                  <a href={s.url} target={s.open_new_tab ? '_blank' : undefined} rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{s.title}</span>
                      {s.subtitle && <span className="block truncate text-xs font-normal text-muted-foreground">{s.subtitle}</span>}
                    </span>
                  </a>
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[13px] uppercase tracking-wider text-primary">
              <FlaskConical className="h-4 w-4" /> Финальный тест
            </CardTitle>
            <CardDescription className="text-[13px]">Пройди тест по пройденному материалу, чтобы закрепить знания и получить сертификат.</CardDescription>
          </CardHeader>
          <CardContent>
            {testLink?.url ? (
              <Button size="sm" asChild>
                <a href={testLink.url} target={testLink.open_new_tab ? '_blank' : undefined} rel="noopener noreferrer">
                  Начать тест
                </a>
              </Button>
            ) : (
              <CardDescription className="text-xs">Ссылка на тест появится здесь, когда лид департамента добавит её.</CardDescription>
            )}
          </CardContent>
        </Card>
      </div>
    </FadeContent>
  );
}
