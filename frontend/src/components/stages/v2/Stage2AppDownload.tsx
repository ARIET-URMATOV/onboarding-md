import { useState, useMemo, type FormEvent } from 'react';
import { Apple, CircleCheck, LoaderCircle, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useServices } from '../../../hooks/useServices';
import { useOnboarding } from '../../../store/useOnboarding';
import type { StageId } from '../../../data/stages';
import { api } from '../../../api/client';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Alert, AlertDescription } from '../../ui/alert';
import { Badge } from '../../ui/badge';
import { FadeContent } from '../../bits';

const MPULSE_TASK_IDS = ['1-mpulse', '1-mpulse-schedule', '1-mpulse-checkin', '1-mpulse-code', '1-mpulse-news'];

export function Stage2AppDownload({ stageId }: { stageId: StageId }) {
  const done = useOnboarding((s) => s.doneTasks[stageId] || []);
  const toggleTask = useOnboarding((s) => s.toggleTask);
  const { services = [] } = useServices();

  const mpulseServices = useMemo(() => services.filter((s: { category: string }) => s.category === 'mpulse'), [services]);
  const isDone = MPULSE_TASK_IDS.every((id) => done.includes(id));

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onVerifyMpulse = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!code) return;
    setVerifying(true);
    setErr(null);
    try {
      await api.post('/api/progress/verify-mpulse-code', { code });
      MPULSE_TASK_IDS.forEach((id) => {
        if (!done.includes(id)) toggleTask(stageId, id);
      });
    } catch (err: unknown) {
      setErr(err instanceof Error ? err.message : 'Неверный код');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <FadeContent className="mt-4">
      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex items-start gap-3.5">
            <img src="/mpulse-logo.png" alt="MPulse" loading="lazy" className="h-15 w-15 rounded-xl border border-border bg-white/5 object-contain p-2" width={60} height={60} />
            <div>
              <div className="text-[15px] font-bold">Установи корпоративное приложение</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">Авторизация через корпоративный AD. Внутри — твой график, новости и пропуски.</div>
            </div>
          </div>

          <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground marker:text-primary">
            <li>Ежедневный <b className="text-foreground">check-in / check-out</b></li>
            <li>Выбор формата работы (офис/удалёнка)</li>
            <li>Корпоративные новости и уведомления</li>
          </ul>

          <div className="flex flex-wrap items-center gap-5 rounded-xl bg-black/30 p-4">
            <div className="grid shrink-0 place-items-center rounded-lg bg-white p-2">
              <QRCodeSVG value="https://apps.apple.com/us/app/mpulse-kg/id6740697046" size={80} level="M" />
            </div>
            <div>
              <div className="mb-2 text-[13px] font-bold">Скачай с телефона</div>
              <div className="flex flex-wrap gap-2.5">
                {mpulseServices.map((s: { key: string; url: string; icon_key: string; title: string }) => (
                  <Button key={s.key} variant="secondary" size="sm" asChild>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.icon_key === 'Apple' ? <Apple /> : <Smartphone />}
                      {s.title}
                    </a>
                  </Button>
                ))}
                {mpulseServices.length === 0 && (
                  <>
                    <Button variant="secondary" size="sm" asChild>
                      <a href="https://apps.apple.com/us/app/mpulse-kg/id6740697046" target="_blank" rel="noopener noreferrer">
                        <Apple /> App Store
                      </a>
                    </Button>
                    <Button variant="secondary" size="sm" asChild>
                      <a href="https://play.google.com/store/apps/details?id=kg.pulse.app" target="_blank" rel="noopener noreferrer">
                        <Smartphone /> Google Play
                      </a>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-primary/30 bg-black/30 p-3.5">
            {isDone ? (
              <Badge className="gap-2 border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[13px] text-emerald-300">
                <CircleCheck /> MPulse успешно привязан
              </Badge>
            ) : (
              <form onSubmit={onVerifyMpulse} className="flex flex-col gap-2.5">
                <div className="text-[13px] font-bold">Связать аккаунт</div>
                <div className="text-xs text-muted-foreground">Зайди в приложение под своим логином AD. В разделе «Онбординг» найди 6-значный код.</div>
                <div className="flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9A-Z]/g, ''))}
                    placeholder="КОД"
                    maxLength={10}
                    className="font-mono"
                  />
                  <Button type="submit" disabled={verifying || !code} className="shrink-0">
                    {verifying && <LoaderCircle className="animate-spin" />}
                    Подтвердить
                  </Button>
                </div>
                {err && (
                  <Alert variant="destructive"><AlertDescription className="text-[11px]">{err}</AlertDescription></Alert>
                )}
              </form>
            )}
          </div>
        </CardContent>
      </Card>
    </FadeContent>
  );
}
