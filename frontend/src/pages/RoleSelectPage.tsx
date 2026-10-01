import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Code2, Database, LoaderCircle, Palette } from 'lucide-react';
import { ROLES } from '../data/stages';
import { useOnboarding } from '../store/useOnboarding';
import type { Role } from '../data/stages';
import { usePageMeta } from '../hooks/usePageMeta';
import { Badge } from '../components/ui/badge';
import { SplitText, FadeContent, SpotlightCard } from '../components/bits';
import { cn } from '../lib/utils';

const ROLE_ICONS = {
  frontend: Code2,
  backend: Database,
  design: Palette,
} as const;

export function RoleSelectPage() {
  usePageMeta("Выбор роли — MDIGITAL Онбординг", "Выбери свою роль в MDIGITAL, чтобы настроить персональный путь онбординга.");
  const [picked, setPicked] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const setRole = useOnboarding((s) => s.setRole);
  const nav = useNavigate();

  const onPick = async (role: Role) => {
    setPicked(role);
    setLoading(true);
    try {
      await setRole(role);
      nav('/dashboard');
    } catch {
      setPicked(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-10 max-w-xl text-center">
        <FadeContent>
          <Badge variant="secondary">Шаг 0 / 1</Badge>
        </FadeContent>
        <SplitText as="h1" text="Выбери свою роль" className="mb-3 mt-4 block text-3xl font-bold tracking-tight sm:text-4xl" />
        <FadeContent delay={0.2}>
          <p className="text-sm leading-relaxed text-muted-foreground">Это поможет нам настроить твой путь онбординга. Потом можно изменить.</p>
        </FadeContent>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        {ROLES.map((r, i) => {
          const Icon = ROLE_ICONS[r.id as keyof typeof ROLE_ICONS] ?? Code2;
          const isPicked = picked === r.id;
          return (
            <FadeContent key={r.id} delay={i * 0.1} className="h-full">
              <SpotlightCard
                spotlightColor={`${r.color}26`}
                className={cn('h-full rounded-xl border border-border bg-card transition-all hover:-translate-y-1', loading && 'pointer-events-none opacity-60')}
              >
                <button
                  onClick={() => onPick(r.id)}
                  disabled={loading}
                  className="flex h-full w-full flex-col p-7 text-left"
                  style={{ borderColor: undefined }}
                >
                  <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-white/5" style={{ color: r.color }}>
                    {isPicked ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
                  </span>
                  <span className="mb-1.5 text-xl font-bold">{r.title}</span>
                  <span className="mb-5 text-xs text-muted-foreground">{r.subtitle}</span>
                  <span className="mt-auto flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.2em]" style={{ color: r.color }}>
                    Выбрать <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              </SpotlightCard>
            </FadeContent>
          );
        })}
      </div>
    </div>
  );
}
