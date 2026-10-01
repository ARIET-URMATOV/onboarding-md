import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { api, type MeResponse } from '../api/client';
import { useOnboarding } from '../store/useOnboarding';
import { usePageMeta } from '../hooks/usePageMeta';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { FadeContent } from '../components/bits';

export function RegisterPage() {
  usePageMeta("Регистрация — MDIGITAL Онбординг", "Создай аккаунт в портале онбординга MDIGITAL и начни интерактивную адаптацию в команде.");
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useOnboarding((s) => s.login);
  const nav = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name || !email || !password) { setError('Заполни все поля'); return; }
    if (password.length < 8) { setError('Пароль должен быть не короче 8 символов'); return; }
    setLoading(true);
    try {
      const me = await api.post<MeResponse>('/api/register', { name, email, password });
      login(me);
      nav('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
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
            <CardTitle className="font-mono text-base tracking-widest">Создать аккаунт</CardTitle>
            <CardDescription>Начни свой путь в команде MDIGITAL</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reg-name">Имя</Label>
                <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Алексей Иванов" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Email</Label>
                <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mdigital.io" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Пароль</Label>
                <Input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 8 символов" required />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <LoaderCircle className="animate-spin" />}
                {loading ? 'Создаём…' : 'Создать аккаунт'}
                {!loading && <ArrowRight />}
              </Button>
            </form>
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Уже есть аккаунт?{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">Войти</Link>
            </p>
          </CardContent>
        </Card>
      </FadeContent>
    </div>
  );
}
