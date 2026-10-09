import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, BookOpenCheck, Check, ExternalLink, KeyRound, LoaderCircle, Users,
} from 'lucide-react';
import { api } from '../api/client';
import { TopBar } from '../components/layout/TopBar';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { cn } from '../lib/utils';

type Doc = { id: number; title: string; url: string; required: boolean; read: boolean };
type Member = { role: string; responsibility: string; contact_tg: string; is_mentor: boolean };
type Card = {
  id: number; name: string; client: string; category: string; description: string;
  stack: string; stage: string; jira_key: string; jira_component: string;
  confluence_space: string; links: Record<string, string>; docs: Doc[]; team: Member[];
};

const LINK_LABEL: Record<string, string> = {
  chat: '💬 Чат', repo: '📦 Репозиторий', figma: '🎨 Figma',
  jira: '📌 Jira', confluence: '📚 Confluence', stand: '🚀 Стенд',
};

function linkLabel(k: string) {
  return LINK_LABEL[k] ?? k;
}

export function ProjectCardPage() {
  const { id } = useParams();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [openedAt] = useState(() => new Date().toISOString());

  const load = () => {
    if (!id) return;
    setLoading(true);
    api.get<Card>(`/api/projects/${id}`)
      .then(setCard)
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const confirm = async (docId: number) => {
    setConfirming(docId);
    try {
      await api.post(`/api/projects/${id}/docs/${docId}/confirm`, { opened_at: openedAt });
      setCard((c) => c ? { ...c, docs: c.docs.map((d) => d.id === docId ? { ...d, read: true } : d) } : c);
    } catch { /* таймер/ошибка — тихо */ } finally {
      setConfirming(null);
    }
  };

  const reqAccess = async () => {
    await api.post(`/api/projects/${id}/request-access`);
    alert('Запрос доступов отправлен PM/тимлиду');
  };

  if (loading && !card) {
    return (
      <div>
        <TopBar />
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Загрузка проекта…
        </p>
      </div>
    );
  }
  if (!card) {
    return (
      <div>
        <TopBar />
        <p className="py-16 text-center text-sm text-muted-foreground">Проект не найден или нет доступа</p>
      </div>
    );
  }

  const reqDocs = card.docs.filter((d) => d.required);
  const doneDocs = reqDocs.filter((d) => d.read).length;
  const pct = reqDocs.length ? Math.round((doneDocs / reqDocs.length) * 100) : 100;
  const mentors = card.team.filter((m) => m.is_mentor);

  return (
    <div>
      <TopBar />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 py-4 pb-24 sm:px-4">
        <Link to="/projects" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Мои проекты
        </Link>

        {/* Шапка */}
        <Card className="overflow-hidden border-primary/25 shadow-[0_0_32px_rgba(37,99,235,0.15)]">
          <CardContent className="flex flex-col gap-2.5 pt-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[11px] text-primary">{card.category}</Badge>
              {card.stage && <Badge variant="secondary" className="text-[11px]">{card.stage}</Badge>}
              {card.jira_key && <Badge variant="outline" className="font-mono text-[11px]">Jira {card.jira_key}{card.jira_component ? ` · ${card.jira_component}` : ''}</Badge>}
            </div>
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{card.name}</h1>
            <p className="text-sm text-muted-foreground">{card.client}</p>
            {card.description && <p className="text-sm leading-relaxed">{card.description}</p>}
            {card.stack && (
              <p className="text-xs text-muted-foreground"><b className="text-foreground">Стек:</b> {card.stack}</p>
            )}
            <Separator className="bg-border/60" />
            {reqDocs.length > 0 && (
              <div className="mt-1">
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>Обязательные документы</span><b className="text-foreground">{doneDocs}/{reqDocs.length}</b>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ссылки */}
        {Object.keys(card.links || {}).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><ExternalLink className="h-4 w-4 text-primary" /> Быстрые ссылки</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {Object.entries(card.links).map(([k, v]) => (
                <a
                  key={k}
                  href={v}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-border bg-card/60 px-3.5 text-sm transition-all hover:border-[var(--border-strong)] hover:shadow-[0_0_18px_rgba(37,99,235,0.25)] active:scale-95"
                >
                  {linkLabel(k)}
                </a>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Команда */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" /> Команда · кто за что отвечает
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mentors.length > 0 && (
              <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-3 text-sm">
                ⭐ <b>Твой ментор:</b> {mentors.map((m) => `${m.role}${m.contact_tg ? ` (${m.contact_tg})` : ''}`).join(', ')} — иди к нему с любым вопросом
              </div>
            )}
            <ScrollArea className="w-full pb-2">
              <div className="flex gap-3 pr-2">
                {card.team.map((m, i) => (
                  <div key={i} className="flex w-[200px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-border bg-card/60 p-4 text-center">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/15 text-base font-bold text-primary">
                        {m.role.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-sm font-bold">{m.role}</div>
                    <div className="min-h-[2em] text-[11px] leading-snug text-muted-foreground">{m.responsibility || '—'}</div>
                    {m.contact_tg && <div className="text-[11px] text-primary">{m.contact_tg}</div>}
                    {m.is_mentor && <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-300">ментор</Badge>}
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            {!card.team.length && <p className="py-2 text-center text-xs text-muted-foreground">Состав команды пока не заполнен</p>}
          </CardContent>
        </Card>

        {/* Документы */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpenCheck className="h-4 w-4 text-primary" /> Документы к прочтению
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {card.docs.map((d) => (
              <div
                key={d.id}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border p-3 transition-all',
                  d.read ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-border bg-card/60',
                )}
              >
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm',
                  d.read ? 'bg-emerald-500/15 text-emerald-300' : 'bg-primary/10 text-primary',
                )}>
                  {d.read ? <Check className="h-4 w-4" /> : '📄'}
                </div>
                <a href={d.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{d.title}</div>
                  <div className="text-[11px] text-muted-foreground">{d.required ? 'обязательный' : 'для ознакомления'} · открыть → «Я ознакомился»</div>
                </a>
                {!d.read && (
                  <Button type="button" size="sm" onClick={() => void confirm(d.id)} disabled={confirming === d.id} className="min-h-[44px] shrink-0">
                    {confirming === d.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Я ознакомился'}
                  </Button>
                )}
              </div>
            ))}
            {!card.docs.length && <p className="py-2 text-center text-xs text-muted-foreground">Документов пока нет</p>}
          </CardContent>
        </Card>

        {/* Доступы */}
        <Button type="button" onClick={() => void reqAccess()} className="wv-cta w-full">
          <KeyRound className="h-5 w-5" /> Запросить доступы проекта
        </Button>
      </div>
    </div>
  );
}
