import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, LoaderCircle, Search, Send, X } from 'lucide-react';
import { api } from '../api/client';
import { usePageMeta } from '../hooks/usePageMeta';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';
import { FadeContent } from '../components/bits';
import { cn } from '../lib/utils';

interface ApplicationStatus {
  status: string;
  updated_at: string;
  comment?: string;
}

const STEPS = [
  { id: 'new', label: 'Заявка принята' },
  { id: 'in_review', label: 'На рассмотрении HR' },
  { id: 'approved', label: 'Одобрено' },
  { id: 'account_created', label: 'Доступы готовы' },
];

export function StatusPage() {
  usePageMeta('Статус заявки — MDIGITAL', 'Проверь статус своей заявки на онбординг.');
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const [number, setNumber] = useState('');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusData, setStatusData] = useState<ApplicationStatus | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    const qEmail = searchParams.get('email');
    const qNum = searchParams.get('number');
    if (qEmail && qNum) {
      setEmail(qEmail);
      setNumber(qNum);
      void fetchStatus(qNum, qEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchStatus = async (ticket: string, mail: string) => {
    setError(null);
    setLoading(true);
    setStatusData(null);
    try {
      const data = await api.post<ApplicationStatus>('/api/applications/status', { number: ticket, email: mail });
      setStatusData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Заявка не найдена');
    } finally {
      setLoading(false);
    }
  };

  const onReply = async () => {
    if (!replyText.trim()) return;
    setLoading(true);
    try {
      await api.post(`/api/applications/${number}/reply`, { reply: replyText, email });
      setReplyText('');
      await fetchStatus(number, email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = () => {
    if (!statusData) return 0;
    const s = statusData.status;
    if (s === 'activated') return 4;
    if (s === 'account_created') return 3;
    if (s === 'approved') return 2;
    if (s === 'in_review' || s === 'needs_info') return 1;
    return 0;
  };

  const progressValue = statusData?.status === 'rejected' ? 0 : Math.min(100, (currentStepIndex() / STEPS.length) * 100);

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <FadeContent className="w-full max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground shadow">
              <Search className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">Статус заявки</CardTitle>
            <CardDescription>Введи данные для отслеживания процесса</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-5">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!statusData ? (
              <form onSubmit={onSubmitForm} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="ticket">Номер заявки (тикет)</Label>
                  <Input id="ticket" value={number} onChange={(e) => setNumber(e.target.value.trim())} placeholder="ONB-2026-0001" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status-email">Личная почта</Label>
                  <Input id="status-email" type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="you@example.com" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <LoaderCircle className="animate-spin" />}
                  {loading ? 'Ищем...' : 'Проверить статус'}
                  {!loading && <ArrowRight />}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => nav('/intro')}>
                  Назад
                </Button>
              </form>
            ) : (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant="secondary" className="bg-primary/10 font-mono tracking-widest text-primary">{number}</Badge>
                  <span className="text-xs text-muted-foreground">{Math.round(progressValue)}%</span>
                </div>
                <Progress value={progressValue} className="mb-8" />

                {statusData.status === 'rejected' ? (
                  <div className="py-6 text-center">
                    <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
                      <X className="h-5 w-5" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold">Заявка отклонена</h3>
                    {statusData.comment && <p className="text-sm text-muted-foreground">{statusData.comment}</p>}
                  </div>
                ) : (
                  <ol className="mb-8">
                    {STEPS.map((s, idx) => {
                      const active = currentStepIndex() === idx;
                      const done = currentStepIndex() > idx;
                      return (
                        <li key={s.id} className="relative flex gap-4 pb-8 last:pb-0">
                          {idx < STEPS.length - 1 && (
                            <span className={cn('absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5', done ? 'bg-primary' : 'bg-border')} />
                          )}
                          <span className={cn(
                            'z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold transition-colors',
                            done && 'border-primary bg-primary text-primary-foreground',
                            active && 'border-primary text-primary shadow-[0_0_0_4px_rgba(37,99,235,0.15)]',
                            !done && !active && 'border-border bg-background text-muted-foreground',
                          )}>
                            {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                          </span>
                          <span className={cn('pt-1 text-[15px]', done || active ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                            {s.label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}

                {statusData.comment && statusData.status !== 'rejected' && (
                  <Alert className="mb-6 border-primary/30 bg-primary/5">
                    <AlertDescription>
                      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-primary">Сообщение от HR</span>
                      <span className="text-sm leading-relaxed text-foreground">{statusData.comment}</span>
                    </AlertDescription>
                  </Alert>
                )}

                {statusData.status === 'needs_info' && (
                  <div className="space-y-3">
                    <Textarea placeholder="Напиши свой ответ здесь..." value={replyText} onChange={(e) => setReplyText(e.target.value)} className="min-h-20" />
                    <Button className="w-full" onClick={onReply} disabled={loading || !replyText.trim()}>
                      {loading ? <LoaderCircle className="animate-spin" /> : <Send />}
                      Ответить
                    </Button>
                  </div>
                )}

                <Separator className="my-6" />
                <Button variant="ghost" className="w-full" onClick={() => setStatusData(null)}>
                  Проверить другую заявку
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeContent>
    </div>
  );

  async function onSubmitForm(e: FormEvent) {
    e.preventDefault();
    await fetchStatus(number, email);
  }
}
