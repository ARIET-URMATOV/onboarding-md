import { useMemo } from 'react';
import { TopBar } from '../components/layout/TopBar';
import { useOnboarding, getAllStatuses, getProgress, isDemoUser } from '../store/useOnboarding';
import { usePageMeta } from '../hooks/usePageMeta';
import { IsometricRoadmap } from '../components/isometric/IsometricRoadmap';

export function StagesPage() {
  usePageMeta("Этапы онбординга — MDIGITAL", "Пять этапов онбординга MDIGITAL: документы, команда, видео, доступы и финальный тест. Отмечай выполненные задачи и получай опыт.");
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const pending = useOnboarding((s) => s.pending);
  const email = useOnboarding((s) => s.user?.email);
  const statuses = useMemo(() => getAllStatuses(doneTasks, pending, isDemoUser(email)), [doneTasks, pending, email]);
  const progress = useMemo(() => getProgress(doneTasks), [doneTasks]);

  return (
    <>
      <TopBar />
      <main className="stages-gm">
        <IsometricRoadmap statuses={statuses} done={progress.done} />
      </main>
      <style>{`
        .stages-gm{
          position:relative; width:100%; max-width:100%; margin:0 auto;
          padding:12px 12px 32px;
          font-family: var(--font-sans);
        }
        @media (min-width:861px){
          .stages-gm{ max-width:1220px; padding:18px 18px 40px; }
        }
      `}</style>
    </>
  );
}
