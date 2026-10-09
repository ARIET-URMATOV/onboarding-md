import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, LoaderCircle, Search, Send, X } from 'lucide-react';
import { api } from '../api/client';
import { usePageMeta } from '../hooks/usePageMeta';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';
import { FadeContent, GradientWaves } from '../components/bits';
import { cn } from '../lib/utils';
import companyLogo from "/mdigital-logo.svg";

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

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
    setGlobalError(null);
    setFieldErrors({});
    let hasErrors = false;
    const errors: Record<string, string> = {};
    if (!ticket.trim()) { errors.number = 'Введите номер заявки'; hasErrors = true; }
    if (!mail.trim()) { errors.email = 'Введите почту'; hasErrors = true; }
    if (hasErrors) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setStatusData(null);
    try {
      const data = await api.post<ApplicationStatus>('/api/applications/status', { number: ticket, email: mail });
      setStatusData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Заявка не найдена';
      const lower = msg.toLowerCase();
      if (lower.includes('номер') || lower.includes('тикет') || lower.includes('не найдена')) {
         setFieldErrors(prev => ({ ...prev, number: msg }));
      } else if (lower.includes('почт') || lower.includes('email')) {
         setFieldErrors(prev => ({ ...prev, email: msg }));
      } else {
         setGlobalError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onReply = async () => {
    if (!replyText.trim()) return;
    setLoading(true);
    setGlobalError(null);
    try {
      await api.post(`/api/applications/${number}/reply`, { reply: replyText, email });
      setReplyText('');
      await fetchStatus(number, email);
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  async function onSubmitForm(e: FormEvent) {
    e.preventDefault();
    await fetchStatus(number, email);
  }

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
    <div className="flex flex-col min-h-screen w-full bg-[#060B14]">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-[#060B14]/70 backdrop-blur-xl border-b border-white/5 transition-all w-full">
        <div className="flex w-full items-center justify-between py-3 sm:py-4 px-8 max-w-[1440px] mx-auto">
          <button onClick={() => nav('/intro')} className="flex items-center transition-opacity hover:opacity-80" aria-label="MDigital — на главную">
           <img src={companyLogo} alt="MDigital" className="h-4 sm:h-6 w-auto" />
          </button>
          <Button variant="ghost" className="h-10 px-4 sm:px-6 text-sm rounded-full text-white/70 hover:text-white hover:bg-white/5" onClick={() => nav('/intro')}>
            На главную
          </Button>
        </div>
      </header>

      <main className="flex-1 w-full relative grid place-items-center p-8">
        <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
          <GradientWaves
            horizonColor="#5227FF"
            waveColor="#FF9FFC"
            crestColor="#FFFFFF"
            speed={0.4}
            amplitude={2.5}
            waveScale={0.6}
            waveRatio={0.9}
            swell={35}
            turbulence={20}
            tilt={1.11}
            zoom={1.0}
            height={5.5}
            fogDepth={15}
            detail="low"
            brightness={0.8}
            opacity={0.6}
            mouseInteraction={false}
            parallaxStrength={0.5}
            grain={true}
            grainIntensity={0.05}
          />
        </div>

        <FadeContent className="w-full max-w-lg relative z-10">
          <div className="rounded-[24px] border border-blue-500/15 bg-[#0A1633]/90 backdrop-blur-xl p-8 sm:p-10 shadow-2xl">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm">
                <Search className="h-6 w-6" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white mb-2">Статус заявки</h2>
              <p className="text-blue-100/60 text-sm">Введи данные для отслеживания процесса</p>
            </div>

            {!statusData ? (
              <form onSubmit={onSubmitForm} className="space-y-6">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="ticket" className="text-sm font-medium text-blue-100">Номер заявки (тикет) *</Label>
                    <Input 
                      id="ticket" 
                      value={number} 
                      onChange={(e) => { setNumber(e.target.value.trim()); setFieldErrors(p => ({...p, number: ''})); }} 
                      placeholder="ONB-2026-0001" 
                      className={"h-12 bg-[#0B1B3A]/60 border-blue-500/15 rounded-xl focus-visible:ring-blue-400/40 text-white placeholder:text-blue-200/30 " + (fieldErrors.number ? 'border-red-400/50 focus-visible:ring-red-400/40' : '')} 
                      aria-invalid={!!fieldErrors.number}
                    />
                    {fieldErrors.number && <p className="text-[13px] text-red-400">{fieldErrors.number}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status-email" className="text-sm font-medium text-blue-100">Личная почта *</Label>
                    <Input 
                      id="status-email" type="email" 
                      value={email} 
                      onChange={(e) => { setEmail(e.target.value.trim()); setFieldErrors(p => ({...p, email: ''})); }} 
                      placeholder="you@example.com" 
                      className={"h-12 bg-[#0B1B3A]/60 border-blue-500/15 rounded-xl focus-visible:ring-blue-400/40 text-white placeholder:text-blue-200/30 " + (fieldErrors.email ? 'border-red-400/50 focus-visible:ring-red-400/40' : '')} 
                      aria-invalid={!!fieldErrors.email}
                    />
                    {fieldErrors.email && <p className="text-[13px] text-red-400">{fieldErrors.email}</p>}
                  </div>
                </div>

                {globalError && (
                  <p className="text-[13px] text-red-400 text-center mb-2">{globalError}</p>
                )}

                <div className="pt-2 flex flex-col gap-3">
                  <Button type="submit" className="w-full h-14 text-base font-semibold rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors" disabled={loading}>
                    {loading && <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />}
                    {loading ? 'Ищем...' : 'Проверить статус'}
                    {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
                  </Button>
                  <Button type="button" variant="outline" className="w-full h-12 rounded-xl border-blue-500/20 text-white bg-transparent hover:bg-blue-500/10 hover:text-white" onClick={() => nav('/intro')}>
                    Назад
                  </Button>
                </div>
              </form>
            ) : (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <Badge className="bg-primary/20 hover:bg-primary/30 text-blue-300 font-mono tracking-widest border-none px-3 py-1 rounded-lg text-sm">{number}</Badge>
                  <span className="text-sm font-medium text-blue-200/60">{Math.round(progressValue)}%</span>
                </div>
                <Progress value={progressValue} className="mb-10 h-2 bg-[#0B1B3A] border border-blue-500/10 [&>div]:bg-primary" />

                {statusData.status === 'rejected' ? (
                  <div className="py-8 text-center rounded-2xl border border-red-500/30 bg-red-500/5">
                    <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
                      <X className="h-6 w-6" />
                    </div>
                    <h3 className="font-display mb-2 text-xl font-bold text-red-400">Заявка отклонена</h3>
                    {statusData.comment && <p className="text-sm text-red-400/80 px-4">{statusData.comment}</p>}
                  </div>
                ) : (
                  <ol className="mb-10">
                    {STEPS.map((s, idx) => {
                      const active = currentStepIndex() === idx;
                      const done = currentStepIndex() > idx;
                      return (
                        <li key={s.id} className="relative flex gap-5 pb-8 last:pb-0">
                          {idx < STEPS.length - 1 && (
                            <span className={cn('absolute left-[15px] top-8 h-[calc(100%-2rem)] w-[2px]', done ? 'bg-primary' : 'bg-blue-500/10')} />
                          )}
                          <span className={cn(
                            'z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition-all duration-300',
                            done && 'border-primary bg-primary text-white',
                            active && 'border-primary text-primary bg-[#0A1633] shadow-[0_0_15px_rgba(37,99,235,0.4)]',
                            !done && !active && 'border-blue-500/20 bg-[#0B1B3A]/60 text-blue-200/40',
                          )}>
                            {done ? <Check className="h-4 w-4" /> : idx + 1}
                          </span>
                          <span className={cn('pt-1 text-base', done || active ? 'font-semibold text-white' : 'text-blue-200/40 font-medium')}>
                            {s.label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}

                {statusData.comment && statusData.status !== 'rejected' && (
                  <div className="mb-8 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-blue-400">Сообщение от HR</span>
                    <span className="text-sm leading-relaxed text-blue-100/90">{statusData.comment}</span>
                  </div>
                )}

                {statusData.status === 'needs_info' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-blue-100">Ваш ответ</Label>
                      <Textarea 
                        placeholder="Напишите ответ здесь..." 
                        value={replyText} 
                        onChange={(e) => setReplyText(e.target.value)} 
                        className="min-h-24 bg-[#0B1B3A]/60 border-blue-500/15 rounded-xl focus-visible:ring-blue-400/40 text-white placeholder:text-blue-200/30 resize-none p-4" 
                      />
                    </div>
                    {globalError && <p className="text-[13px] text-red-400">{globalError}</p>}
                    <Button className="w-full h-12 rounded-xl bg-primary text-white hover:bg-primary/90 font-semibold" onClick={onReply} disabled={loading || !replyText.trim()}>
                      {loading ? <LoaderCircle className="animate-spin mr-2 h-5 w-5" /> : <Send className="mr-2 h-4 w-4" />}
                      Отправить ответ
                    </Button>
                  </div>
                )}

                <Separator className="my-8 border-blue-500/15" />
                <Button variant="outline" className="w-full h-12 rounded-xl border-blue-500/20 text-white bg-transparent hover:bg-blue-500/10 hover:text-white" onClick={() => setStatusData(null)}>
                  Проверить другую заявку
                </Button>
              </div>
            )}
          </div>
        </FadeContent>
      </main>
    </div>
  );
}
