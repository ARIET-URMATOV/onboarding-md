import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { ArrowRight, BadgeCheck, LoaderCircle, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { usePageMeta } from '../hooks/usePageMeta';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../components/ui/input-otp';
import { SplitText, BlurText, FadeContent, SpotlightCard, CountUp, Magnet, ShinyText } from '../components/bits';

interface IntroContent {
  title: string;
  mission: string;
  values: string[];
  instruction: string;
}

const FALLBACK_CONTENT: IntroContent = {
  title: 'Добро пожаловать в MDIGITAL',
  mission: 'Мы создаём цифровое будущее, разрабатывая инновационные финтех-решения. Наша миссия — упрощать жизнь миллионов людей с помощью технологий.',
  values: ['Скорость', 'Инновации', 'Ответственность', 'Команда'],
  instruction: 'Заполни заявку ниже. Решение HR занимает до 2 рабочих дней. Данные для входа в корпоративную сеть придут на указанную личную почту.',
};

export function PublicIntroPage() {
  usePageMeta('MDIGITAL — Старт карьеры', 'Знакомство с компанией и подача заявки на онбординг.');
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const [content, setContent] = useState<IntroContent | null>(null);
  const [contentLoading, setContentLoading] = useState(true);

  const [step, setStep] = useState<'form' | 'verify' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('onboarding_draft');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* ignore */
      }
    }
    return {
      name: '', email: searchParams.get('email') || '', phone: '',
      department: '', position: '', planned_date: '', lead_name: '', consent_given: false,
    };
  });

  const [code, setCode] = useState('');
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  useEffect(() => {
    api.get<IntroContent>('/api/public/intro')
      .then((res) => setContent(res))
      .catch(() => setContent(FALLBACK_CONTENT))
      .finally(() => setContentLoading(false));
  }, []);

  useEffect(() => {
    if (step === 'form') {
      localStorage.setItem('onboarding_draft', JSON.stringify(formData));
    }
  }, [formData, step]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: typeof formData) => ({ ...prev, [name]: value }));
  };

  const onSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.consent_given) {
      setError('Необходимо согласие на обработку персональных данных');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/applications', formData);
      setStep('verify');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка отправки заявки';
      if (msg.includes('Активная заявка уже существует')) {
        setError('duplicate');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmitVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ ticket_number: string }>('/api/applications/verify-email', {
        email: formData.email, code,
      });
      setTicketNumber(res.ticket_number);
      localStorage.removeItem('onboarding_draft');
      setStep('success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  const scrollToForm = () => {
    document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (contentLoading || !content) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="mx-auto h-6 w-32" />
        <Skeleton className="mx-auto h-12 w-3/4" />
        <Skeleton className="mx-auto h-20 w-full max-w-xl" />
        <div className="grid grid-cols-2 gap-4 pt-8 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-background px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary shadow">
            <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-primary-foreground" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3 4-3 4-3-4 3-4z" />
              <path d="M4 7l4 3v7l-4-3V7z" />
              <path d="M20 7l-4 3v7l4-3V7z" />
              <path d="M8 17l4 3 4-3" />
            </svg>
          </div>
          <span className="font-mono text-base font-bold tracking-wider">MDIGITAL</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => nav('/status')}>Проверить статус</Button>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
        <section className="mb-16 text-center">
          <FadeContent>
            <Badge variant="secondary" className="mb-6 border-primary/30 bg-primary/10 text-primary">
              <Sparkles className="mr-1 h-3 w-3" /> Онбординг V2
            </Badge>
          </FadeContent>
          <SplitText as="h1" text={content.title} className="mb-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl" />
          <BlurText text={content.mission} className="mx-auto mb-8 block max-w-xl text-lg leading-relaxed text-muted-foreground" />
          <FadeContent delay={0.3}>
            <Magnet>
              <Button size="lg" onClick={scrollToForm}>
                Подать заявку <ArrowRight />
              </Button>
            </Magnet>
          </FadeContent>

          <FadeContent delay={0.4}>
            <div className="mx-auto mt-12 grid max-w-lg grid-cols-3 gap-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-2xl font-bold text-primary"><CountUp to={5} /></div>
                <div className="mt-1 text-xs text-muted-foreground">этапов онбординга</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-2xl font-bold text-primary"><CountUp to={1540} /></div>
                <div className="mt-1 text-xs text-muted-foreground">XP за программу</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-2xl font-bold text-primary"><CountUp to={2} /></div>
                <div className="mt-1 text-xs text-muted-foreground">дня на решение HR</div>
              </div>
            </div>
          </FadeContent>
        </section>

        <FadeContent>
          <section className="mb-16">
            <h2 className="mb-6 text-xl font-semibold tracking-tight">Наши ценности</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {content.values?.map((v: string, i: number) => (
                <SpotlightCard key={i} className="rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-3 p-5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-sm font-bold text-primary">{i + 1}</div>
                    <div className="text-[15px] font-medium">{v}</div>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          </section>
        </FadeContent>

        <FadeContent>
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="text-lg">Как пройдёт первый день?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{content.instruction}</p>
            </CardContent>
          </Card>
        </FadeContent>

        <section id="apply-form" className="mb-16 scroll-mt-8">
          <FadeContent>
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Заявка кандидата</CardTitle>
                <CardDescription>Заполни форму для получения доступов к корпоративной сети.</CardDescription>
              </CardHeader>
              <CardContent>
                {step === 'form' && (
                  <>
                    {error === 'duplicate' ? (
                      <Alert>
                        <ShieldCheck />
                        <AlertTitle>У вас уже есть активная заявка</AlertTitle>
                        <AlertDescription className="mt-2 flex flex-col gap-4">
                          <span>Заявка с почтой <b className="text-foreground">{formData.email}</b> уже зарегистрирована в системе.</span>
                          <Button onClick={() => nav(`/status?email=${encodeURIComponent(formData.email)}`)}>
                            Узнать статус заявки
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <form onSubmit={onSubmitForm} className="space-y-5">
                        {error && (
                          <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        )}
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="name">ФИО</Label>
                            <Input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="Иванов Иван" required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Личная почта</Label>
                            <Input id="email" type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="you@example.com" required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone">Телефон</Label>
                            <Input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="+996 555 123 456" required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="planned_date">Дата выхода</Label>
                            <Input id="planned_date" type="date" name="planned_date" value={formData.planned_date} onChange={handleInputChange} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="department">Департамент</Label>
                            <Select value={formData.department} onValueChange={(v) => setFormData((p: typeof formData) => ({ ...p, department: v }))} required>
                              <SelectTrigger id="department">
                                <SelectValue placeholder="Выбрать..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Frontend">Frontend</SelectItem>
                                <SelectItem value="Backend">Backend</SelectItem>
                                <SelectItem value="Design">Design</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="position">Должность</Label>
                            <Input id="position" name="position" value={formData.position} onChange={handleInputChange} placeholder="Middle React Dev" required />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="lead_name">Имя руководителя</Label>
                            <Input id="lead_name" name="lead_name" value={formData.lead_name} onChange={handleInputChange} placeholder="ФИО лида" required />
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="consent"
                            checked={formData.consent_given}
                            onCheckedChange={(c) => setFormData((p: typeof formData) => ({ ...p, consent_given: c === true }))}
                          />
                          <Label htmlFor="consent" className="text-[13px] font-normal leading-snug text-muted-foreground">
                            Я даю согласие на обработку моих персональных данных в соответствии с политикой конфиденциальности.
                          </Label>
                        </div>

                        <Button type="submit" className="w-full" size="lg" disabled={loading}>
                          {loading && <LoaderCircle className="animate-spin" />}
                          {loading ? 'Отправка...' : 'Продолжить'}
                          {!loading && <ArrowRight />}
                        </Button>
                      </form>
                    )}
                  </>
                )}

                {step === 'verify' && (
                  <div className="mx-auto max-w-sm text-center">
                    <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                      <Mail className="h-6 w-6" />
                    </div>
                    <h2 className="mb-2 text-xl font-semibold">Подтверди почту</h2>
                    <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                      Мы отправили 6-значный код на <b className="text-foreground">{formData.email}</b>. Он действителен 15 минут.
                    </p>
                    <form onSubmit={onSubmitVerify} className="space-y-6">
                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      <div className="flex justify-center">
                        <InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={code} onChange={setCode}>
                          <InputOTPGroup>
                            {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <div className="flex gap-3">
                        <Button type="button" variant="ghost" className="flex-1" onClick={() => setStep('form')} disabled={loading}>Назад</Button>
                        <Button type="submit" className="flex-1" disabled={loading || code.length < 6}>
                          {loading && <LoaderCircle className="animate-spin" />}
                          {loading ? 'Проверка...' : 'Подтвердить'}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {step === 'success' && ticketNumber && (
                  <div className="mx-auto max-w-sm text-center">
                    <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                      <BadgeCheck className="h-6 w-6" />
                    </div>
                    <h2 className="mb-2 text-xl font-semibold">
                      <ShinyText text="Заявка успешно отправлена!" />
                    </h2>
                    <p className="mb-4 text-sm text-muted-foreground">Твой номер заявки (тикет Service Desk):</p>
                    <div className="mb-6 rounded-lg border border-dashed border-border bg-muted/30 p-4 font-mono text-2xl font-bold tracking-widest">
                      {ticketNumber}
                    </div>
                    <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
                      Мы отправили этот номер на <b className="text-foreground">{formData.email}</b>. Используй его для проверки статуса. Ожидай письма с решением HR.
                    </p>
                    <Separator className="mb-8" />
                    <Button className="w-full" size="lg" onClick={() => nav(`/status?email=${encodeURIComponent(formData.email)}`)}>
                      Перейти к трекеру статуса <ArrowRight />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </FadeContent>
        </section>
      </main>
    </div>
  );
}
