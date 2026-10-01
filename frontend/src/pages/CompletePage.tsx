import { Link } from 'react-router-dom';
import { ArrowRight, Map as MapIcon, Trophy } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import { STAGES } from '../data/stages';
import { useOnboarding } from '../store/useOnboarding';
import { usePageMeta } from '../hooks/usePageMeta';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { SplitText, FadeContent, SpotlightCard, ShinyText } from '../components/bits';

const RESOURCES = [
  { label: 'Notion · База знаний', icon: 'N', color: '#3B82F6' },
  { label: 'GitHub · Репозиторий', icon: 'G', color: '#2563EB' },
  { label: 'Figma · Дизайн-система', icon: 'F', color: '#3B82F6' },
  { label: 'Slack · Команда', icon: 'S', color: '#60A5FA' },
];

export function CompletePage() {
  usePageMeta("Достижения — MDIGITAL Онбординг", "Поздравляем! Ты прошёл все этапы онбординга MDIGITAL. Посмотри свои достижения.");
  const user = useOnboarding((s) => s.user);
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-3xl px-6 py-20 text-center">
        <FadeContent>
          <Badge variant="outline" className="border-primary/40 bg-primary/10 px-4 py-1.5 text-[11px] tracking-[0.3em] text-primary">
            Поздравляем
          </Badge>
        </FadeContent>
        <SplitText
          as="h1"
          text="Онбординг завершён!"
          className="mb-3.5 mt-6 text-4xl font-black leading-tight tracking-tight sm:text-6xl"
        />
        <FadeContent delay={0.25}>
          <p className="mx-auto mb-10 max-w-xl text-[15px] text-muted-foreground">
            {user?.name?.split(' ')[0] || 'Друг'}, ты прошёл все 5 этапов. Добро пожаловать в команду MDIGITAL!
          </p>
        </FadeContent>

        <FadeContent delay={0.3}>
          <Card className="mx-auto mb-12 max-w-xs">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary"><ShinyText text="5/5" /></div>
              <div className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">этапов пройдено</div>
            </CardContent>
          </Card>
        </FadeContent>

        <section className="mb-10 text-left">
          <h3 className="mb-4 text-center text-[11px] tracking-[0.25em] text-primary">Достижения</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((s, i) => (
              <FadeContent key={s.id} delay={i * 0.07}>
                <SpotlightCard className="h-full rounded-xl border border-primary/25 bg-primary/[0.06] p-4 text-center">
                  <Trophy className="mx-auto mb-2 h-7 w-7 text-amber-400" />
                  <div className="text-xs text-emerald-300">{s.rewardName}</div>
                  <div className="mt-1 text-[10px] tracking-wider text-muted-foreground">Этап 0{s.id} · {s.shortLabel}</div>
                </SpotlightCard>
              </FadeContent>
            ))}
          </div>
        </section>

        <section className="mb-10 text-left">
          <h3 className="mb-4 text-center text-[11px] tracking-[0.25em] text-primary">Ресурсы команды</h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {RESOURCES.map((r) => (
              <a
                key={r.label}
                href="#"
                className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3.5 transition-all hover:-translate-y-0.5"
                style={{ borderColor: undefined }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = r.color; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-bold"
                  style={{ backgroundColor: `${r.color}40`, color: r.color }}
                >
                  {r.icon}
                </span>
                <span className="flex-1 text-left text-[13px]">{r.label}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        </section>

        <FadeContent>
          <div className="mt-5 flex flex-wrap justify-center gap-3.5">
            <Button size="lg" asChild>
              <Link to="/dashboard">На главную</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/map"><MapIcon /> Просмотреть карту</Link>
            </Button>
          </div>
        </FadeContent>
      </main>
    </>
  );
}
