import { useOnboarding, type SlaStatus } from '../../store/useOnboarding';
import { Clock, XCircle, CheckCircle } from 'lucide-react';

const slaColors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  active:    { bg: 'rgba(34,197,94,.08)',  border: 'rgba(34,197,94,.3)',  text: '#86EFAC', icon: '#86EFAC' },
  due_today: { bg: 'rgba(239,68,68,.08)',  border: 'rgba(239,68,68,.35)', text: '#FCA5A5', icon: '#FCA5A5' },
  overdue:   { bg: 'rgba(239,68,68,.12)',  border: 'rgba(239,68,68,.45)', text: '#FCA5A5', icon: '#FCA5A5' },
  done:      { bg: 'rgba(34,197,94,.06)',  border: 'rgba(34,197,94,.2)',  text: '#86EFAC', icon: '#86EFAC' },
  done_late: { bg: 'rgba(251,191,36,.06)', border: 'rgba(251,191,36,.2)', text: '#FDE68A', icon: '#FDE68A' },
};

function slaLabel(sla: SlaStatus): string {
  switch (sla.status) {
    case 'overdue':   return `Просрочено на ${Math.floor((Date.now() - new Date(sla.deadline).getTime()) / 86400000)} дн.`;
    case 'due_today': return 'Сегодня последний день';
    case 'done':      return 'Онбординг завершён';
    case 'done_late': return 'Завершён с просрочкой';
    default:
      return sla.days_left === 1
        ? 'Остался 1 день'
        : `Осталось ${sla.days_left} дн. из ${sla.total_days}`;
  }
}

export function SlaBanner() {
  const sla = useOnboarding((s) => s.sla);
  if (!sla) return null;

  const c = slaColors[sla.status] ?? slaColors.active;
  const isOverdue = sla.status === 'overdue';
  const isDone = sla.status === 'done' || sla.status === 'done_late';

  return (
    <div className="sla-banner" style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
      borderRadius: 10, background: c.bg, border: `1px solid ${c.border}`,
      fontSize: 12.5, color: c.text, lineHeight: 1.5,
    }}>
      <span style={{ flexShrink: 0 }}>
        {isDone ? <CheckCircle size={15} style={{ color: c.icon }} />
          : isOverdue ? <XCircle size={15} style={{ color: c.icon }} />
          : <Clock size={15} style={{ color: c.icon }} />}
      </span>
      <span style={{ flex: 1 }}>{slaLabel(sla)}</span>
      {!isDone && (
        <span style={{ fontSize: 11, opacity: 0.7, whiteSpace: 'nowrap' }}>
          Дедлайн: {new Date(sla.deadline).toLocaleDateString('ru-RU')}
        </span>
      )}
      {isDone && (
        <span style={{ fontSize: 11, opacity: 0.6 }}>
          Старт: {new Date(sla.started_at).toLocaleDateString('ru-RU')}
        </span>
      )}
    </div>
  );
}
