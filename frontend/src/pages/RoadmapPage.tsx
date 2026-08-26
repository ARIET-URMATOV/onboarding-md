import { useMemo } from 'react';
import { TopBar } from '../components/layout/TopBar';
import { useOnboarding, getAllStatuses, getProgress } from '../store/useOnboarding';
import { usePageMeta } from '../hooks/usePageMeta';
import { IsometricRoadmap } from '../components/isometric/IsometricRoadmap';

export function RoadmapPage() {
  usePageMeta("Этапы онбординга — MDIGITAL", "Пять этапов онбординга MDIGITAL: документы, команда, видео, доступы и финальный тест. Отмечай выполненные задачи и получай опыт.");
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const statuses = useMemo(() => getAllStatuses(doneTasks), [doneTasks]);
  const progress = useMemo(() => getProgress(doneTasks), [doneTasks]);

  return (
    <>
      <TopBar />
      <main className="roadmap-gm">
        <IsometricRoadmap statuses={statuses} done={progress.done} />
      </main>
      <style>{`
        .roadmap-gm{
          position:relative; width:100%; max-width:100%; margin:0 auto;
          padding:12px 12px 32px;
          font-family:'Open Sans',sans-serif;
        }
        @media (min-width:861px){
          .roadmap-gm{ max-width:1220px; padding:18px 18px 40px; }
        }
      `}</style>
    </>
  );
}
