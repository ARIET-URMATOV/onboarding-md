export type StageId = 1 | 2 | 3 | 4;
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
  iconKey: 'mobile' | 'docs' | 'team' | 'video' | 'check' | 'test';
  subTasks: SubTask[];
}

// Источник — GET /api/stages (БД stages/stage_tasks), этот массив — fallback для тестов/до загрузки
// Порядок v2 для WebView (MPulse): прелогин-этап «Знакомство с компанией» живёт на
// публичной странице, аутентифицированный онбординг начинается со «Скачай приложение».
export const STAGES: StageDef[] = [
  {
    id: 1,
    title: 'Скачай приложение',
    shortLabel: 'Приложение',
    description: 'Установи корпоративное приложение MPulse и свяжи аккаунт: график, check-in/out, новости и уведомления.',
    xpReward: 50,
    rewardName: 'Ачивка «На связи»',
    rewardDesc: 'Откроется после прохождения этапа',
    iconKey: 'mobile',
    subTasks: [
      { id: '1-mpulse', title: 'Установка и авторизация MPulse', xp: 1 },
      { id: '1-mpulse-schedule', title: 'Выбор рабочего графика', xp: 1 },
      { id: '1-mpulse-checkin', title: 'Daily check-in/check-out', xp: 1 },
      { id: '1-mpulse-code', title: 'Ввод проверочного кода', xp: 1 },
      { id: '1-mpulse-news', title: 'Получение новостей и уведомлений', xp: 1 },
    ],
  },
  {
    id: 2,
    title: 'Документы и доступы',
    shortLabel: 'Документы',
    description: 'Подписание документов, получение доступов и изучение базы знаний Confluence.',
    xpReward: 100,
    rewardName: 'Ачивка «Старт»',
    rewardDesc: 'Откроется после прохождения этапа',
    iconKey: 'docs',
    subTasks: [
      { id: '1-dogovor', title: 'Договор об оказании услуг', xp: 1 },
      { id: '1-nda', title: 'NDA Соглашение о неразглашении', xp: 1 },
      { id: '1-pdp', title: 'Соглашение об обработке персональных данных', xp: 1 },
      { id: '1-ip', title: 'Свидетельство ИП', xp: 1 },
      { id: '1-sn', title: 'Справка о несудимости', xp: 1 },
      { id: '1-mbusiness', title: 'MBusiness - открытие', xp: 0 },
      { id: '1-accountant', title: 'Доступ бухгалтеру', xp: 0 },
      { id: '1-wifi', title: 'Доступ к Wi-Fi (MAC адрес)', xp: 0 },
      { id: '1-proxy', title: 'Прокси-карта и Face ID', xp: 0 },
      { id: '1-telegram', title: 'Доступ в Telegram-группы', xp: 0 },
      { id: '1-jira', title: 'Доступ к Jira (AD-логин)', xp: 0 },
      { id: '1-figma', title: 'Доступ к Figma (инвайт)', xp: 0 },
      { id: '1-gitlab', title: 'Доступ к GitLab', xp: 0 },
      { id: '1-confluence-read', title: 'Я ознакомился(ась)', xp: 10 },
    ],
  },
  {
    id: 3,
    title: 'Команда, видео и чек-лист',
    shortLabel: 'Команда',
    description: 'Знакомство с командой, приветственное видео и чек-лист первого дня.',
    xpReward: 100,
    rewardName: 'Ачивка «Знакомство»',
    rewardDesc: 'Откроется после прохождения этапа',
    iconKey: 'team',
    subTasks: [
      { id: '2-team-read', title: 'Ознакомился с командой', xp: 5 },
      { id: '3-watch', title: 'Досмотреть видео до конца', xp: 5 },
      { id: '4-ready', title: 'Чек-лист пройден', xp: 5 },
    ],
  },
  {
    id: 4,
    title: 'Онбординг в департамент',
    shortLabel: 'Департамент',
    description: 'Задачи твоего направления: репозиторий, Figma, style guide и финальный тест.',
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
  mobile: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M11 18h2',
  docs: 'M9 12h6m-6 4h6m-6-8h6m4 12V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2z',
  team: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  video: 'M23 7l-7 5 7 5V7z M1 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1a0 0 0 0 1 0 0V5z',
  check: 'M9 11l3 3L22 4 M1 12a11 11 0 1 0 22 0 11 11 0 0 0-22 0z',
  test: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h6',
};

export const ROLES: { id: Role; title: string; subtitle: string; color: string }[] = [
  { id: 'frontend', title: 'Frontend', subtitle: 'React · TypeScript · Vite', color: '#3B82F6' },
  { id: 'backend', title: 'Backend', subtitle: 'Node · Python · SQL', color: '#2563EB' },
  { id: 'design', title: 'Design', subtitle: 'Figma · UX · UI', color: '#3B82F6' },
];
