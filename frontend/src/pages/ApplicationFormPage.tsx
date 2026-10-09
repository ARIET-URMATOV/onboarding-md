import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/ui/ToastProvider';
import { usePageMeta } from '../hooks/usePageMeta';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { FadeContent, SpringCheck, CodeSlots } from '../components/bits';
import {
  formatPhoneDisplay,
  normalizeEmail,
  normalizePhoneDigits,
  toE164,
  validateConsent,
  validateDepartment,
  validateEmail,
  validateMinLength,
  validateName,
  validatePhoneDigits,
  validatePlannedDate,
} from '../lib/validators';
import companyLogo from '/mdigital-logo.svg';

/**
 * Unified input style for the application form.
 * - No focus ring at all (focus-visible:ring-0 kills the base Input ring via twMerge),
 *   only a border-color change — this removes the white-flash on focus.
 * - transition-colors (not transition-all) so box-shadow never animates.
 */
const FORM_INPUT =
  'h-14 bg-white/[0.03] border-white/10 rounded-2xl text-white placeholder:text-white/20 ' +
  'outline-none transition-colors hover:bg-white/[0.05] hover:border-white/20 ' +
  'focus-visible:outline-none focus-visible:ring-0 focus-visible:border-white/50 focus-visible:bg-white/[0.05]';

const FORM_INPUT_ERROR = ' border-red-500/50';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[13px] text-red-400 mt-1">{message}</p>;
}

interface FormDraft {
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  planned_date: string;
  lead_name: string;
  consent_given: boolean;
}

export function ApplicationFormPage() {
  usePageMeta('Заявка — MDIGITAL', 'Заполни анкету кандидата и подтверди почту.');
  const toast = useToast();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<'form' | 'verify' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<FormDraft>(() => {
    const fallback = {
      name: '',
      email: searchParams.get('email') || '',
      phone: '',
      department: '',
      position: '',
      planned_date: '',
      lead_name: '',
      consent_given: false,
    };
    const saved = localStorage.getItem('onboarding_draft');
    if (!saved) return fallback;
    try {
      const parsed = JSON.parse(saved);
      // Migrate old drafts: phone may be stored raw/formatted — keep digits only.
      return { ...fallback, ...parsed, phone: normalizePhoneDigits(String(parsed.phone ?? '')) };
    } catch {
      return fallback;
    }
  });

  const [codeStatus, setCodeStatus] = useState('idle');
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  useEffect(() => {
    if (step === 'form') {
      localStorage.setItem('onboarding_draft', JSON.stringify(formData));
    }
  }, [formData, step]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    setGlobalError(null);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = normalizePhoneDigits(e.target.value);
    setFormData((prev) => ({ ...prev, phone: digits }));
    setFieldErrors((prev) => ({ ...prev, phone: '' }));
    setGlobalError(null);
  };

  const onSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setDuplicateError(false);

    const errors: Record<string, string> = {};
    const nameErr = validateName(formData.name);
    if (nameErr) errors.name = nameErr;
    const emailErr = validateEmail(formData.email);
    if (emailErr) errors.email = emailErr;
    const phoneErr = validatePhoneDigits(formData.phone);
    if (phoneErr) errors.phone = phoneErr;
    const deptErr = validateDepartment(formData.department);
    if (deptErr) errors.department = deptErr;
    const dateErr = validatePlannedDate(formData.planned_date);
    if (dateErr) errors.planned_date = dateErr;
    const posErr = validateMinLength(formData.position);
    if (posErr) errors.position = posErr;
    const leadErr = validateMinLength(formData.lead_name);
    if (leadErr) errors.lead_name = leadErr;
    const consentErr = validateConsent(formData.consent_given);
    if (consentErr) errors.consent = consentErr;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      const res = await api.post<{ ok: boolean; dev_code?: string }>('/api/applications', {
        ...formData,
        email: normalizeEmail(formData.email),
        phone: toE164(formData.phone),
      });
      // DEV-only: бэкенд возвращает код только вне продакшена — тост показываем по факту наличия кода.
      if (res.dev_code) {
        toast.info(`DEV-код подтверждения: ${res.dev_code}`, 'Скопируй в поле ниже — в проде код приходит письмом');
      }
      setStep('verify');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка отправки заявки';
      if (msg.includes('Активная заявка уже существует')) {
        setDuplicateError(true);
      } else {
        const lower = msg.toLowerCase();
        if (lower.includes('почта') || lower.includes('email')) {
          setFieldErrors((prev) => ({ ...prev, email: msg }));
        } else if (lower.includes('телефон') || lower.includes('phone')) {
          setFieldErrors((prev) => ({ ...prev, phone: msg }));
        } else {
          setGlobalError(msg);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCodeComplete = async (completedCode: string) => {
    setGlobalError(null);
    setLoading(true);
    setCodeStatus('idle');
    try {
      const res = await api.post<{ ticket_number: string }>('/api/applications/verify-email', {
        email: normalizeEmail(formData.email),
        code: completedCode,
      });
      setCodeStatus('success');
      setTicketNumber(res.ticket_number);
      localStorage.removeItem('onboarding_draft');
      setTimeout(() => setStep('success'), 1200);
    } catch (err: unknown) {
      setCodeStatus('error');
      setGlobalError(err instanceof Error ? err.message : 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#060B14]">
      <header className="sticky top-0 z-50 bg-[#060B14]/70 backdrop-blur-xl border-b border-white/5 transition-all w-full">
        <div className="flex w-full items-center justify-between py-3 sm:py-4 px-8 max-w-[1440px] mx-auto">
          <button
            onClick={() => nav('/intro')}
            className="flex items-center transition-opacity hover:opacity-80"
            aria-label="MDigital — на главную"
          >
            <img src={companyLogo} alt="MDigital" className="h-4 sm:h-6 w-auto" />
          </button>
          <Button
            variant="ghost"
            className="h-10 px-4 sm:px-6 text-sm rounded-full text-white/70 hover:text-white hover:bg-white/5"
            onClick={() => nav('/intro')}
          >
            На главную
          </Button>
        </div>
      </header>

      <main className="flex-1 w-full grid place-items-center px-8 py-12 sm:py-16">
        <FadeContent className="w-full max-w-xl">
          <div className="mb-8 text-center">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              Анкета кандидата
            </h1>
            <p className="text-white/60 leading-relaxed">
              Заполнение займёт пару минут. Данные нужны HR-отделу и сисадминам для формирования
              ваших корпоративных доступов.
            </p>
          </div>

          <div className="rounded-[32px] border border-white/5 bg-[#080C14] p-6 sm:p-8 md:p-10 shadow-2xl">
            {step === 'form' && (
              <>
                {duplicateError ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
                    <ShieldCheck className="h-6 w-6 text-red-400" />
                    <h4 className="text-lg font-semibold text-red-400 mt-2">Заявка уже существует</h4>
                    <p className="text-red-400/80 mb-6 mt-1 text-sm">
                      Заявка с почтой <b>{formData.email}</b> уже зарегистрирована.
                    </p>
                    <Button
                      className="w-full h-12 rounded-xl bg-white text-black hover:bg-neutral-200 font-semibold transition-colors"
                      onClick={() => nav(`/status?email=${encodeURIComponent(formData.email)}`)}
                    >
                      Узнать статус
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={onSubmitForm} className="space-y-6" noValidate>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-medium text-white/80">
                          ФИО *
                        </Label>
                        <Input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className={FORM_INPUT + (fieldErrors.name ? FORM_INPUT_ERROR : '')}
                          placeholder="Иванов Иван Иванович"
                          aria-invalid={!!fieldErrors.name}
                        />
                        {fieldErrors.name ? (
                          <FieldError message={fieldErrors.name} />
                        ) : (
                          <p className="text-[13px] text-white/30 mt-1">
                            Как в паспорте — так попадет в документы.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium text-white/80">
                          Личная почта *
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className={FORM_INPUT + (fieldErrors.email ? FORM_INPUT_ERROR : '')}
                          placeholder="mail@example.com"
                          aria-invalid={!!fieldErrors.email}
                        />
                        {fieldErrors.email ? (
                          <FieldError message={fieldErrors.email} />
                        ) : (
                          <p className="text-[13px] text-white/30 mt-1">
                            Сюда придет логин и пароль от рабочей учетки.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-sm font-medium text-white/80">
                          Телефон *
                        </Label>
                        <div className="relative">
                          <span className="pointer-events-none select-none absolute left-4 top-1/2 -translate-y-1/2 text-white/60 text-[15px] font-medium">
                            +996
                          </span>
                          <Input
                            id="phone"
                            type="tel"
                            name="phone"
                            inputMode="numeric"
                            value={formatPhoneDisplay(formData.phone)}
                            onChange={handlePhoneChange}
                            className={
                              FORM_INPUT +
                              ' pl-16' +
                              (fieldErrors.phone ? FORM_INPUT_ERROR : '')
                            }
                            placeholder="508 100 165"
                            aria-invalid={!!fieldErrors.phone}
                          />
                        </div>
                        {fieldErrors.phone ? (
                          <FieldError message={fieldErrors.phone} />
                        ) : (
                          <p className="text-[13px] text-white/30 mt-1">
                            9 цифр мобильного номера после кода +996.
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="department" className="text-sm font-medium text-white/80">
                            Отдел *
                          </Label>
                          <Select
                            value={formData.department}
                            onValueChange={(v) => {
                              setFormData((p) => ({ ...p, department: v }));
                              setFieldErrors((p) => ({ ...p, department: '' }));
                            }}
                          >
                            <SelectTrigger
                              id="department"
                              className={FORM_INPUT + (fieldErrors.department ? FORM_INPUT_ERROR : '')}
                            >
                              <SelectValue placeholder="Выберите..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl bg-[#080C14] border-white/10 text-white shadow-2xl">
                              <SelectItem value="Frontend">Frontend</SelectItem>
                              <SelectItem value="Backend">Backend</SelectItem>
                              <SelectItem value="Design">Design</SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldError message={fieldErrors.department} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="planned_date" className="text-sm font-medium text-white/80">
                            Дата выхода *
                          </Label>
                          <Input
                            id="planned_date"
                            type="date"
                            name="planned_date"
                            value={formData.planned_date}
                            onChange={handleInputChange}
                            className={
                              FORM_INPUT +
                              ' [&::-webkit-calendar-picker-indicator]:invert-[0.8]' +
                              (fieldErrors.planned_date ? FORM_INPUT_ERROR : '')
                            }
                          />
                          <FieldError message={fieldErrors.planned_date} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="position" className="text-sm font-medium text-white/80">
                            Должность *
                          </Label>
                          <Input
                            id="position"
                            name="position"
                            value={formData.position}
                            onChange={handleInputChange}
                            className={FORM_INPUT + (fieldErrors.position ? FORM_INPUT_ERROR : '')}
                            placeholder="Например, Developer"
                          />
                          <FieldError message={fieldErrors.position} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lead_name" className="text-sm font-medium text-white/80">
                            Руководитель *
                          </Label>
                          <Input
                            id="lead_name"
                            name="lead_name"
                            value={formData.lead_name}
                            onChange={handleInputChange}
                            className={FORM_INPUT + (fieldErrors.lead_name ? FORM_INPUT_ERROR : '')}
                            placeholder="ФИО Лида"
                          />
                          <FieldError message={fieldErrors.lead_name} />
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 pb-4">
                      {globalError && (
                        <p className="text-[14px] text-red-400 mb-4 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                          {globalError}
                        </p>
                      )}
                      <FieldError message={fieldErrors.consent} />
                      <div
                        className={
                          'bg-white/[0.02] border rounded-2xl p-5 ' +
                          (fieldErrors.consent ? 'border-red-500/40 mb-3' : 'border-white/5')
                        }
                      >
                        <SpringCheck
                          label="Согласие на обработку данных"
                          checked={formData.consent_given}
                          onChange={(c: boolean) => {
                            setFormData((p) => ({ ...p, consent_given: c }));
                            setFieldErrors((p) => ({ ...p, consent: '' }));
                          }}
                          color="#d4d4d8"
                          fillColor="#ffffff"
                          checkColor="#000000"
                          boxSize={24}
                          boxRadius={8}
                          fontSize={14}
                          bounce={0.2}
                          strikeLag={0.12}
                          doneOpacity={0.6}
                          strike="none"
                          className="text-white/80 font-medium"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-14 text-base font-semibold rounded-2xl bg-white text-black hover:bg-neutral-200 transition-colors shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]"
                      disabled={loading}
                    >
                      {loading && <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />}
                      {loading ? 'Отправка...' : 'Отправить заявку'}
                    </Button>
                  </form>
                )}
              </>
            )}

            {step === 'verify' && (
              <div className="text-center py-6">
                <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-white/5 text-white/80 border border-white/10">
                  <Mail className="h-8 w-8" />
                </div>
                <h3 className="font-display mb-2 text-2xl font-bold text-white">Подтверди почту</h3>
                <p className="mb-10 text-sm text-white/60">
                  Мы отправили 6-значный код на <br />
                  <b className="text-white">{formData.email}</b>.
                </p>
                <div className="space-y-8">
                  {globalError && (
                    <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                      {globalError}
                    </div>
                  )}

                  <div className="flex justify-center mb-8">
                    <CodeSlots
                      length={6}
                      status={codeStatus}
                      onChange={() => setCodeStatus('idle')}
                      onComplete={handleCodeComplete}
                      accentColor="#ffffff"
                      inkColor="#d4d4d8"
                      slotColor="#ffffff10"
                      digitColor="#000000"
                          dangerColor="#ef4444"
                          slotSize={36}
                          gap={4}
                      radius={12}
                      bounce={0.2}
                      settle={0.3}
                      rise={8}
                      cascade={20}
                      mask={false}
                      caret={true}
                      disabled={loading}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-14 rounded-2xl border-white/10 text-white bg-transparent hover:bg-white/5 hover:text-white transition-colors"
                      onClick={() => setStep('form')}
                      disabled={loading}
                    >
                      Назад
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 'success' && ticketNumber && (
              <div className="text-center py-6">
                <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="font-display mb-3 text-2xl font-bold text-white">Анкета принята</h3>
                <p className="mb-6 text-sm text-white/60">Твой номер заявки в Service Desk:</p>

                <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 py-5 font-mono text-2xl sm:text-3xl font-bold tracking-widest text-white shadow-inner break-all">
                  {ticketNumber}
                </div>

                <p className="mb-10 text-sm leading-relaxed text-white/60">
                  Ожидайте решения HR (до 2 рабочих дней). Вы можете проверять статус заявки по
                  номеру.
                </p>

                <Button
                  className="w-full h-14 text-base font-semibold rounded-2xl bg-white text-black hover:bg-neutral-200 transition-colors"
                  onClick={() => nav(`/status?email=${encodeURIComponent(formData.email)}`)}
                >
                  Проверить статус
                </Button>
              </div>
            )}
          </div>

          {step === 'form' && !duplicateError && (
            <p className="text-center text-sm text-white/40 mt-6">
              Уже отправляли заявку?{' '}
              <button
                onClick={() => nav('/status')}
                className="text-white/80 underline underline-offset-4 hover:text-white transition-colors"
              >
                Проверьте статус
              </button>
            </p>
          )}
        </FadeContent>
      </main>
    </div>
  );
}
