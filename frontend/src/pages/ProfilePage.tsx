import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, LogOut, Mail, Pencil, Send, Tag, User } from 'lucide-react';
import { TopBar, DefaultAvatar } from '../components/layout/TopBar';
import { getProgress, useOnboarding } from '../store/useOnboarding';
import { usePageMeta } from '../hooks/usePageMeta';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Separator } from '../components/ui/separator';
import { FadeContent } from '../components/bits';

function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas недоступен')); return; }
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать изображение')); };
    img.src = url;
  });
}

export function ProfilePage() {
  usePageMeta('Профиль — MDIGITAL Онбординг', 'Твой профиль: данные сотрудника, аватар и прогресс онбординга.');
  const nav = useNavigate();
  const user = useOnboarding((s) => s.user);
  const xp = useOnboarding((s) => s.xp);
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const progress = useMemo(() => getProgress(doneTasks), [doneTasks]);
  const lvl = Math.floor(xp / 100) + 1;
  const updateProfile = useOnboarding((s) => s.updateProfile);
  const logout = useOnboarding((s) => s.logout);
  const onboardingRole = useOnboarding((s) => s.user?.department?.display_name);

  const missing = (v: string | null | undefined) => (v && v.trim() ? v : null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar ?? null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!user) return null;

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      setProfileError('Поддерживаются PNG, JPEG и WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Файл больше 5 МБ');
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarPreview(dataUrl);
      setProfileError(null);
      await saveAvatar(dataUrl);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  };

  const saveAvatar = async (avatar: string) => {
    setProfileError(null);
    try {
      await updateProfile({ avatar });
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 2200);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  };

  const onLogout = async () => {
    await logout();
    nav('/login');
  };

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <FadeContent>
          <Card>
            <CardHeader>
              <Button variant="ghost" size="sm" className="w-fit" onClick={() => nav(-1)}>
                <ArrowLeft /> Назад
              </Button>
              <CardTitle className="font-mono text-lg tracking-widest">Профиль</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <button type="button" onClick={() => fileRef.current?.click()} aria-label="Сменить фото" className="group relative block rounded-full">
                    <Avatar className="h-28 w-28 border-2 border-primary/40">
                      {avatarPreview ? <AvatarImage src={avatarPreview} alt="Аватар" /> : null}
                      <AvatarFallback className="bg-secondary">
                        <DefaultAvatar size={48} />
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute inset-0 grid place-items-center rounded-full bg-black/60 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      Сменить фото
                    </span>
                  </button>
                  <Button size="icon" variant="secondary" className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full" aria-label="Сменить фото" onClick={() => fileRef.current?.click()}>
                    <Pencil />
                  </Button>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPickFile} />
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>

              <button type="button" onClick={() => nav('/stages')} title="Перейти к этапам" className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent">
                <Badge className="shrink-0">Lv.{lvl}</Badge>
                <Progress value={progress.pct} className="h-2 flex-1" />
                <span className="text-xs font-semibold">{xp >= 1000 ? `${(xp / 1000).toFixed(1)}k` : xp} XP</span>
                <span className="text-xs text-muted-foreground">{progress.done}/5</span>
              </button>

              <section className="flex flex-col gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Личные данные</h2>
                <ProfileRow icon={<User />} label="Имя" value={missing(user.name)} />
                <ProfileRow icon={<Mail />} label="Email" value={missing(user.email)} />
                <ProfileRow icon={<Send />} label="Telegram" value={missing(user.telegramUsername)} />
                {profileError && (
                  <Alert variant="destructive"><AlertDescription>{profileError}</AlertDescription></Alert>
                )}
                {profileSaved && (
                  <Alert className="border-emerald-500/40 bg-emerald-500/10">
                    <AlertDescription className="text-emerald-300">Фото обновлено ✓</AlertDescription>
                  </Alert>
                )}
              </section>

              <Separator />

              <section className="flex flex-col gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Рабочая информация</h2>
                <ProfileRow icon={<Tag />} label="Роль" value={missing(onboardingRole)} />
                <ProfileRow icon={<Building2 />} label="Департамент" value={missing(user.department?.display_name)} />
              </section>

              <Separator />

              <section className="flex flex-col gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-destructive">Опасная зона</h2>
                <Button variant="destructive" onClick={onLogout} className="w-fit">
                  <LogOut /> Выйти из аккаунта
                </Button>
              </section>
            </CardContent>
          </Card>
        </FadeContent>
      </main>
    </>
  );
}

function ProfileRow({ icon, label, value }: { icon: ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}{label}</span>
      {value ? <span className="text-right">{value}</span> : <i className="text-xs not-italic text-muted-foreground/60">Не указано</i>}
    </div>
  );
}
