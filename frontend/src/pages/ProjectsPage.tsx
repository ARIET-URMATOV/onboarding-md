import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FolderKanban, LoaderCircle } from 'lucide-react';
import { api } from '../api/client';
import { TopBar } from '../components/layout/TopBar';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Progress } from '../components/ui/progress';

type Row = { id: number; name: string; client: string; category: string; role: string; is_mentor: boolean; docs_total: number; docs_done: number };

export function ProjectsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<Row[]>('/api/projects/my').then(setRows).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <TopBar />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 py-4 pb-24 sm:px-4">
        <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <FolderKanban className="h-5 w-5 text-primary" /> Этап 6 — Мои проекты
        </h1>

        {loading && (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Загрузка…
          </p>
        )}

        {!loading && !rows.length && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Проекты пока не назначены. Как только PM или HR добавит тебя в проект — карточка появится здесь.
            </CardContent>
          </Card>
        )}

        {rows.map((r) => {
          const pct = r.docs_total ? Math.round((r.docs_done / r.docs_total) * 100) : 100;
          return (
            <Link
              key={r.id}
              to={`/projects/${r.id}`}
              className="card-glow-hover block rounded-2xl border border-border bg-card/60 backdrop-blur transition-all active:scale-[0.99]"
            >
              <CardContent className="flex items-center gap-3 pt-4">
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarFallback className="bg-primary/15 font-bold text-primary">
                    {r.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{r.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.client} · твоя роль: {r.role}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress value={pct} className="h-1 flex-1" />
                    <span className="text-[11px] tabular-nums text-muted-foreground">{r.docs_done}/{r.docs_total}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge variant="outline" className="text-[10px]">{r.category}</Badge>
                  {r.is_mentor && <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-300">ментор</Badge>}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
