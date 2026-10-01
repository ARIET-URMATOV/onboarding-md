import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, LoaderCircle, TriangleAlert } from 'lucide-react';
import { api, type MeResponse } from '../api/client';
import { useOnboarding } from '../store/useOnboarding';
import { usePageMeta } from '../hooks/usePageMeta';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Separator } from '../components/ui/separator';
import { FadeContent } from '../components/bits';

const DEMO_ENABLED = import.meta.env.VITE_DEMO_ENABLED === 'true';

export function LoginPage() {
  usePageMeta("Вход — MDIGITAL Онбординг", "Войди в портал онбординга MDIGITAL, чтобы продолжить адаптацию и отслеживать прогресс этапов.");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [ldapConfigured, setLdapConfigured] = useState(true);
  const [oidcConfigured, setOidcConfigured] = useState(false);
  const login = useOnboarding((s) => s.login);
  const nav = useNavigate();

  useEffect(() => {
    api.get('/api/health').catch(() => { /* ignore */ });
    api.get<{ ldap_configured: boolean }>('/api/auth/ldap-status')
      .then((r) => setLdapConfigured(r.ldap_configured))
      .catch(() => setLdapConfigured(false));
    api.get<{ oidc_configured: boolean }>('/api/auth/oidc-status')
      .then((r) => setOidcConfigured(r.oidc_configured))
      .catch(() => setOidcConfigured(false));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Заполни все поля');
      return;
    }
    setLoading(true);
    try {
      const me = await api.post<MeResponse>('/api/login', { email, password });
      login(me);
      nav('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка входа';
      if (msg.includes('LDAP') || msg.includes('AD')) {
        setError('Ошибка подключения к корпоративной сети');
      } else {
        setError('Неверный email или пароль');
      }
    } finally {
      setLoading(false);
    }
  };

  const onDemo = async (stage?: number) => {
    setDemoLoading(true);
    setError(null);
    try {
      const url = stage ? `/api/demo/login?stage=${stage}` : '/api/demo/login';
      const me = await api.post<MeResponse>(url);
      login(me);
      nav('/dashboard');
    } catch {
      setError('Не удалось войти в демо');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <FadeContent className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground shadow">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3 4-3 4-3-4 3-4z" />
                <path d="M4 7l4 3v7l-4-3V7z" />
                <path d="M20 7l-4 3v7l4-3V7z" />
                <path d="M8 17l4 3 4-3" />
              </svg>
            </div>
            <CardTitle className="font-mono text-base tracking-widest">MDIGITAL ONBOARDING</CardTitle>
            <CardDescription>Войди, чтобы продолжить путь</CardDescription>
          </CardHeader>
          <CardContent>
            {!ldapConfigured && !oidcConfigured && (
              <Alert className="mb-5 border-amber-500/40 bg-amber-500/10">
                <TriangleAlert className="text-amber-400" />
                <AlertTitle className="text-amber-300">Только демо-режим</AlertTitle>
                <AlertDescription className="text-amber-200/80">Ни LDAP, ни OIDC не настроены</AlertDescription>
              </Alert>
            )}

            {oidcConfigured && (
              <>
                <Button className="w-full" size="lg" asChild>
                  <a href="/auth/start">Войти через портал <ArrowUpRight /></a>
                </Button>
                <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <Separator className="flex-1" /> или <Separator className="flex-1" />
                </div>
              </>
            )}

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mdigital.kg" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Пароль</Label>
                <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <LoaderCircle className="animate-spin" />}
                {loading ? 'Входим…' : 'Войти'}
                {!loading && <ArrowRight />}
              </Button>
            </form>

            {DEMO_ENABLED && (
              <>
                <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <Separator className="flex-1" /> или <Separator className="flex-1" />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={() => onDemo()} disabled={demoLoading}>
                  {demoLoading && <LoaderCircle className="animate-spin" />}
                  {demoLoading ? 'Входим…' : 'Демо — с начала'}
                </Button>
                <p className="mb-2 mt-4 text-center text-[11px] uppercase tracking-widest text-muted-foreground">Быстрый старт</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[2, 3, 4, 5].map((stage) => (
                    <Button key={stage} type="button" variant="secondary" size="sm" onClick={() => onDemo(stage)} disabled={demoLoading}>
                      Этап {stage}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </FadeContent>
    </div>
  );
}
