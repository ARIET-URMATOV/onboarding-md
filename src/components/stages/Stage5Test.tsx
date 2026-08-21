import { useState } from 'react';
import type { StageId } from '../../data/stages';

interface Props { stageId: StageId }

export function Stage5Test({ }: Props) {
  const [opened, setOpened] = useState(false);
  return (
    <div className="test-card">
      <div className="test-banner">
        <div className="test-icon">🎯</div>
        <div>
          <div className="test-title">Финальный тест · 20 вопросов</div>
          <div className="test-sub">Время: 25 минут · 1 попытка</div>
        </div>
      </div>
      <div className="test-actions">
        <a
          href="https://example.com/mdigital-frontend-test"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          onClick={() => setOpened(true)}
        >
          ПЕРЕЙТИ К ТЕСТУ ↗
        </a>
      </div>
      {opened && (
        <div className="test-hint">
          После прохождения теста вернись сюда и отметь чек-бокс выше.
        </div>
      )}
      <style>{`
        .test-card{ margin-bottom:6px }
        .test-banner{
          display:flex; align-items:center; gap:12px;
          padding:14px;
          background:linear-gradient(135deg, rgba(244,114,182,.08), rgba(139,92,246,.08));
          border:1px solid rgba(244,114,182,.25);
          border-radius:11px;
          margin-bottom:12px;
        }
        .test-icon{ font-size:24px }
        .test-title{ font-size:13px; color:#fff; font-weight:600 }
        .test-sub{ font-size:10.5px; color:var(--muted); margin-top:3px }
        .test-actions{ display:flex; justify-content:center }
        .test-hint{
          margin-top:10px; padding:9px 12px;
          font-size:11px; color:var(--cyan-l);
          border:1px dashed rgba(244,114,182,.3); border-radius:8px;
          background:rgba(244,114,182,.05);
        }
      `}</style>
    </div>
  );
}
