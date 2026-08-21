export type StageId = 1 | 2 | 3 | 4 | 5;
export type Role = 'frontend' | 'backend' | 'design';

export interface SubTask {
  id: string;
  title: string;
  xp: number;
}

export interface StageDef {
  id: StageId;
  title: string;
  shortLabel: string;
  description: string;
  xpReward: number;
  rewardName: string;
  rewardDesc: string;
  iconKey: 'docs' | 'team' | 'video' | 'check' | 'test';
  subTasks: SubTask[];
}

export const STAGES: StageDef[] = [
  {
    id: 1,
    title: 'Документы и mPlus',
    shortLabel: 'Документы',
    description: 'Заполни документы, познакомься с руководителем и установи корпоративный мессенджер mPLuse.',
    xpReward: 150,
    rewardName: 'Ачивка «Старт»',
    rewardDesc: 'Откроется после прохождения этапа',
    iconKey: 'docs',
    subTasks: [
      { id: '1-docs', title: 'Заполнить документы', xp: 40 },
      { id: '1-lead', title: 'Ознакомиться с руководителем', xp: 40 },
      { id: '1-mplus', title: 'Скачать и установить mPLuse', xp: 50 },
    ],
  },
  {
    id: 2,
    title: 'Команда и руководство',
    shortLabel: 'Команда',
    description: 'Открой карточки ключевых сотрудников, познакомься с тимлидом и задай первый вопрос.',
    xpReward: 150,
    rewardName: 'Ачивка «Знакомство»',
    rewardDesc: 'Откроется после прохождения этапа',
    iconKey: 'team',
    subTasks: [
      { id: '2-studio', title: 'Студия у лида: знакомство', xp: 40 },
      { id: '2-profiles', title: 'Прочитать профили команды', xp: 40 },
      { id: '2-lead', title: 'Познакомиться с тимлидом', xp: 40 },
      { id: '2-chat', title: 'Задать вопрос в чат команды', xp: 30 },
    ],
  },
  {
    id: 3,
    title: 'Видеообращение',
    shortLabel: 'Видео',
    description: 'Посмотри приветственное видео от руководства. Узнай о миссии, ценностях и планах команды.',
    xpReward: 100,
    rewardName: 'Ачивка «Вдохновение»',
    rewardDesc: 'Откроется после прохождения этапа',
    iconKey: 'video',
    subTasks: [
      { id: '3-watch', title: 'Досмотреть видео до конца', xp: 100 },
    ],
  },
  {
    id: 4,
    title: 'Тех. чек-лист',
    shortLabel: 'Чек-лист',
    description: 'Проверь, что у тебя есть всё необходимое для работы: доступы, инструменты, инструкции.',
    xpReward: 150,
    rewardName: 'Ачивка «Готовность»',
    rewardDesc: 'Откроется после прохождения этапа',
    iconKey: 'check',
    subTasks: [
      { id: '4-workspace', title: 'Рабочее место готово', xp: 25 },
      { id: '4-repo', title: 'Доступ к репозиторию', xp: 25 },
      { id: '4-figma', title: 'Доступ к Figma', xp: 25 },
      { id: '4-mail', title: 'Корпоративная почта', xp: 25 },
      { id: '4-messenger', title: 'Мессенджер настроен', xp: 25 },
      { id: '4-style', title: 'Прочитать инструкцию по стилю кода', xp: 25 },
    ],
  },
  {
    id: 5,
    title: 'Итоговый тест',
    shortLabel: 'Тест',
    description: 'Пройди финальный тест по материалам онбординга. Удачи!',
    xpReward: 200,
    rewardName: 'Ачивка «Мастер»',
    rewardDesc: 'Откроется после прохождения этапа',
    iconKey: 'test',
    subTasks: [
      { id: '5-take', title: 'Пройти тест по ссылке', xp: 100 },
      { id: '5-confirm', title: 'Подтвердить прохождение теста', xp: 100 },
    ],
  },
];

export const STAGE_ICONS: Record<StageDef['iconKey'], string> = {
  docs: 'M9 12h6m-6 4h6m-6-8h6m4 12V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2z',
  team: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  video: 'M23 7l-7 5 7 5V7z M1 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1a0 0 0 0 1 0 0V5z',
  check: 'M9 11l3 3L22 4 M1 12a11 11 0 1 0 22 0 11 11 0 0 0-22 0z',
  test: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h6',
};

export const STAGE_TOTAL_XP = STAGES.reduce((sum, s) => sum + s.xpReward, 0);

export const ROLES: { id: Role; title: string; subtitle: string; color: string }[] = [
  { id: 'frontend', title: 'Frontend', subtitle: 'React · TypeScript · Vite', color: '#f472b6' },
  { id: 'backend', title: 'Backend', subtitle: 'Node · Python · SQL', color: '#8B5CF6' },
  { id: 'design', title: 'Design', subtitle: 'Figma · UX · UI', color: '#F472B6' },
];
