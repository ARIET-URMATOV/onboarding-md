import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Mail, Menu, X,
  Wallet, CreditCard, Calculator, Globe,
  Clock, Home, TrendingUp, Download,
  Smartphone, FileText, Users, Monitor,
  HelpCircle, Timer
} from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { usePublicIntro } from '../api/queries';
import { Button } from '../components/ui/button';
import {
  FadeContent,
  AccordionGallery,
  BlurText,
  ScrollReveal,
  GradientWaves,
  LightRays,
  ParticleText,
  SplitText,
  type GalleryItem,
} from '../components/bits';
import companyLogo from "/mdigital-logo.svg";

const ACTIVITY_GALLERY: GalleryItem[] = [
  { image: '/md-conf-image.png', label: 'MD CONF', caption: 'День технологий, реальных кейсов и разговоров о том, куда движется IT.' },
  { image: '/kit-forum-image.png', label: 'KIT Forum', caption: 'Общение с представителями бизнеса и IT-сообщества, новые знакомства и обмен опытом.' },
  { image: '/royal-cp-conf-image.jpg', label: 'Выступления команды', caption: 'Наши специалисты выходят на сцену, чтобы рассказывать о своём опыте.' },
  { image: '/mitap-hr-image.png', label: 'Митапы и нетворкинг', caption: 'Знакомимся с людьми из индустрии, обсуждаем идеи и делимся опытом.' },
];

// Локальные фолбэки слота FR-102 (зеркалят дефолты GET /api/public/intro):
// страница обязана выглядеть целостно, даже если бэкенд недоступен.
const FALLBACK_TITLE = 'Добро пожаловать в';
const FALLBACK_MISSION =
  'Мы создаём цифровое будущее, разрабатывая инновационные финтех-решения, такие как MBusiness и MPulse. Твоя роль здесь очень важна.';
const FALLBACK_VALUES = ['Скорость', 'Инновации', 'Ответственность', 'Команда'];
const FALLBACK_INSTRUCTION =
  'Заполни заявку, чтобы получить доступ к корпоративной сети и начать онбординг. Решение HR занимает до 2 рабочих дней. Как только мы будем готовы, ты получишь логин AD и пароль на указанную личную почту.';
const FALLBACK_GOALS = [
  { title: 'Доступный финтех', text: 'Делаем банковские сервисы понятными — MBusiness для бизнеса, MPulse для каждого сотрудника и клиента.' },
  { title: 'Скорость без хаоса', text: 'Быстрые решения, короткие циклы, ответственность за результат с первого дня.' },
  { title: 'Команда рядом', text: 'Наставник, тимлид и HR ведут тебя через каждый этап — ты никогда не останешься один на один с вопросом.' },
];

export function PublicIntroPage() {
  usePageMeta('MDIGITAL — Компания', 'Знакомство с компанией и подача заявки в команду.');
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  // FR-102: редактируемые HR слоты этапа 1; при недоступности API — локальные фолбэки.
  const { data: intro } = usePublicIntro();
  const heroTitle = intro?.title?.trim() ? intro.title : FALLBACK_TITLE;
  const mission = intro?.mission?.trim() ? intro.mission : FALLBACK_MISSION;
  const values = intro?.values?.length ? intro.values : FALLBACK_VALUES;
  const goals = intro?.goals?.length ? intro.goals : FALLBACK_GOALS;
  const instruction = intro?.instruction?.trim() ? intro.instruction : FALLBACK_INSTRUCTION;
  const apiGallery = intro?.gallery?.filter((g) => g.image?.trim()) ?? [];
  const galleryItems: GalleryItem[] = apiGallery.length ? apiGallery : ACTIVITY_GALLERY;

  const scrollToId = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const NAV_LINKS = [
    { id: 'about', label: 'О компании' },
    { id: 'products', label: 'Продукты' },
    { id: 'life', label: 'Жизнь' },
    { id: 'process', label: 'Твой путь' },
  ];

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#060B14]">
      {/* ── Navbar (fixed) ── */}
      <header className="fixed left-0 right-0 top-0 z-50 bg-[#060B14]/70 backdrop-blur-xl border-b border-white/5 transition-all w-full">
        <div className="flex w-full items-center justify-between py-3 sm:py-4 px-8 max-w-[1440px] mx-auto">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center transition-opacity hover:opacity-80" aria-label="MDigital — наверх">
           <img src={companyLogo} alt="MDigital" className="h-5 sm:h-8 w-auto" />
          </button>
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollToId(l.id)}
                className="text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                {l.label}
              </button>
            ))}
          </nav>
          <div className="hidden md:block">
            <Button className="h-10 px-6 text-sm rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" onClick={() => nav('/application-form')}>
              Заполнить заявку
            </Button>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-md border border-white/10 md:hidden text-white"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <nav className="border-t border-white/10 py-4 md:hidden bg-[#060B14]/95 backdrop-blur-2xl absolute left-0 right-0 px-6 pb-6 shadow-2xl z-50">
            {NAV_LINKS.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollToId(l.id)}
                className="block w-full rounded-lg px-4 py-3 text-left text-base font-medium text-white hover:bg-white/5"
              >
                {l.label}
              </button>
            ))}
            <Button className="mt-6 w-full h-12 text-base rounded-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => nav('/application-form')}>
              Заполнить заявку
            </Button>
          </nav>
        )}
      </header>
      {/* Компенсация fixed-шапки (моб. 44px / десктоп 64px) */}
      <div aria-hidden className="h-[44px] w-full shrink-0 sm:h-[64px]" />

      <main className="flex-1 w-full flex flex-col items-center">
        {/* ── 1. Hero ── */}
        <section className="relative w-full flex min-h-[85vh] sm:min-h-[90vh] flex-col justify-center items-center text-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <GradientWaves
              speed={0.4}
              amplitude={2.5}
              waveScale={0.6}
              waveRatio={0.9}
              swell={35}
              turbulence={20}
              tilt={1.11}
              zoom={1.0}
              height={5.5}
              fogDepth={15}
              detail="medium"
              brightness={1.0}
              opacity={1.0}
              mouseInteraction={true}
              parallaxStrength={0.5}
              grain={true}
              grainIntensity={0.05}
            />
          </div>
          
          <div className="relative z-10 flex flex-col items-center px-8 w-full max-w-[1440px] mx-auto">
            <SplitText 
              text={heroTitle} 
              className="font-sans text-xl sm:text-2xl md:text-3xl font-medium tracking-wide text-white/80 z-10 relative mb-[-40px] sm:mb-[-60px] md:mb-[-80px]"
              delay={80}
              duration={1.8}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 20 }}
              to={{ opacity: 1, y: 0 }}
            />
            
            <div className="w-full h-[200px] sm:h-[280px] md:h-[400px] flex items-center justify-center pointer-events-none relative z-0">
              <ParticleText
                text="MDIGITAL"
                particleSize={2.2}
                density={4}
                color="#0015ff"
                highlightColor="#afc1e9"
                scatter={190}
                gatherDuration={1600}
                stagger={420}
                pointerRepel={42}
                repelRadius={120}
                idleDrift={0.8}
                trigger="mount"
                fontSize="clamp(3.5rem, 15vw, 10rem)"
                fontWeight={800}
                fontFamily="Unbounded"
                glow
              />
            </div>
            
            <FadeContent delay={1.8} className="mt-0 md:mt-8 z-20 pointer-events-auto">
              <Button size="lg" className="h-16 px-12 text-base font-semibold rounded-full bg-white text-black hover:bg-white/90 transition-transform hover:scale-105 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]" onClick={() => nav('/application-form')}>
                Хочу в команду <ArrowRight className="ml-3 h-5 w-5" />
              </Button>
            </FadeContent>
          </div>
        </section>

        {/* ── 2. О компании ── */}
        <section id="about" className="w-full max-w-[1440px] px-8 py-16 sm:py-20 md:py-32 scroll-mt-20">
          <FadeContent>
            <div className="mb-6 text-xs sm:text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-4">
              <div className="h-[1px] w-8 bg-primary"></div> О нас
            </div>
            <SplitText
              text="Миссия и Ценности"
              className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white mb-8"
              delay={50}
              duration={1.25}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 40 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.1}
              rootMargin="-100px"
              textAlign="left"
            />
          </FadeContent>

          <FadeContent delay={0.1}>
            <p className="mt-12 sm:mt-16 max-w-4xl text-lg sm:text-xl md:text-2xl leading-relaxed text-white/80">
              {mission}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {values.map((v) => (
                <span
                  key={v}
                  className="rounded-full border border-primary/30 bg-primary/10 px-5 py-2 text-sm font-medium text-white/90"
                >
                  {v}
                </span>
              ))}
            </div>
          </FadeContent>

          <div className="mt-12 sm:mt-16 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 lg:gap-24">
            <ScrollReveal className="text-lg sm:text-xl md:text-2xl leading-relaxed text-white/70">
              <p className="mb-6">
                Компания работает с 2019 года. За это время небольшая команда выросла в крупный центр разработки. Наша миссия — трансформировать бизнес через надежные и инновационные IT-решения.
              </p>
              <p>
                Сегодня в компании работает <strong className="text-white">более 200 специалистов</strong>. Мы ценим открытость, ответственность за результат и стремление к постоянному развитию. Мы создаем продукты, которыми пользуются миллионы.
              </p>
            </ScrollReveal>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8 text-center flex flex-col items-center justify-center backdrop-blur-sm">
                <div className="font-display text-4xl sm:text-5xl font-bold text-white mb-2">10<span className="text-primary">+</span></div>
                <div className="text-sm text-white/50 font-medium">Лет на рынке</div>
              </div>
              <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8 text-center flex flex-col items-center justify-center backdrop-blur-sm">
                <div className="font-display text-4xl sm:text-5xl font-bold text-white mb-2">60<span className="text-primary">+</span></div>
                <div className="text-sm text-white/50 font-medium">Проектов</div>
              </div>
            </div>
          </div>

          <div className="mt-12 sm:mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            {goals.map((g, i) => (
              <FadeContent key={g.title} delay={0.1 + i * 0.1} className="h-full">
                <div className="h-full rounded-3xl border border-white/5 bg-white/[0.02] p-8 backdrop-blur-sm">
                  <h3 className="font-display text-xl font-bold text-white mb-3">{g.title}</h3>
                  <p className="text-base leading-relaxed text-white/60">{g.text}</p>
                </div>
              </FadeContent>
            ))}
          </div>
        </section>

        {/* ── 2.5 Продукты ── */}
        <section id="products" className="w-full max-w-[1440px] px-8 py-16 sm:py-20 md:py-32 scroll-mt-20 border-t border-white/5">
           <FadeContent>
            <div className="mb-6 text-xs sm:text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-4">
              <div className="h-[1px] w-8 bg-primary"></div> Наши продукты
            </div>
            <BlurText 
              text="Цифровая экосистема"
              className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white mb-16"
              delay={0.1}
            />
          </FadeContent>

          <div className="flex flex-col gap-10">
            {/* MBusiness Card */}
            <FadeContent delay={0.2}>
              <div className="group relative overflow-hidden rounded-[32px] border border-white/5 bg-zinc-900/40 p-8 lg:p-12 transition-all hover:bg-zinc-900/60 flex flex-col lg:flex-row gap-10 lg:gap-20 backdrop-blur-xl shadow-2xl">
                <div className="absolute top-0 right-0 -mr-32 -mt-32 h-[500px] w-[500px] rounded-full bg-zinc-500/5 blur-[100px] transition-all group-hover:bg-zinc-500/10 pointer-events-none"></div>
                
                {/* Суть продукта */}
                <div className="lg:w-1/3 flex flex-col items-start z-10">
                  <div className="h-14 w-14 sm:h-16 sm:w-16 bg-white rounded-2xl p-2.5 mb-8 shadow-sm flex items-center justify-center shrink-0">
                    <img src="/mbusiness-logo.png" alt="MBusiness" className="h-full w-full object-contain" />
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white mb-4">MBusiness</h3>
                  <p className="text-lg text-zinc-300 leading-relaxed font-medium mb-6">
                    Цифровой банк для компаний от «МБАНК». Именно через него мы моментально и без ошибок начисляем вам зарплату.
                  </p>
                </div>

                {/* Фичи продукта */}
                <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-8 z-10">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-300 border border-white/10">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white mb-2">Моментальная зарплата</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">Деньги приходят всей команде одновременно. Отпускные, бонусы и налоги рассчитываются автоматически.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-300 border border-white/10">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white mb-2">Карты Visa MBusiness</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">Для удобной оплаты командировок, бензина или покупок для офиса. Никакой бумажной волокиты с чеками.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-300 border border-white/10">
                      <Calculator className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white mb-2">Умная бухгалтерия</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">Платформа сама сдает отчеты в налоговую и принимает платежи по QR-коду абсолютно без комиссий.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-300 border border-white/10">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white mb-2">Переводы по всему миру</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">Бизнес может отправлять деньги партнерам в любую точку мира в режиме 24/7.</p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeContent>

            {/* MPulse Card */}
            <FadeContent delay={0.3}>
              <div className="group relative overflow-hidden rounded-[32px] border border-blue-900/30 bg-blue-950/40 p-8 lg:p-12 transition-all hover:bg-blue-950/60 flex flex-col lg:flex-row gap-10 lg:gap-20 backdrop-blur-xl shadow-2xl">
                <div className="absolute top-0 right-0 -mr-32 -mt-32 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[100px] transition-all group-hover:bg-blue-500/20 pointer-events-none"></div>
                
                {/* Суть продукта */}
                <div className="lg:w-1/3 flex flex-col items-start z-10">
                  <div className="h-14 w-14 sm:h-16 sm:w-16 bg-white rounded-2xl p-2 sm:p-2.5 mb-8 shadow-sm flex items-center justify-center shrink-0">
                    <img src="/mpulse-logo.png" alt="MPulse" className="h-full w-full object-contain" />
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white mb-4">MPulse</h3>
                  <p className="text-lg text-blue-100/90 leading-relaxed font-medium mb-6">
                    Ваше главное рабочее приложение. Удобный HR-портал в смартфоне, где всё под рукой: от отметки времени до плана развития.
                  </p>
                </div>

                {/* Фичи продукта */}
                <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-8 z-10">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white mb-2">Учет времени</h4>
                      <p className="text-sm text-blue-200/60 leading-relaxed">Отмечайте начало и конец рабочего дня прямо в телефоне. Приложение подтверждает, что вы на месте.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Home className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white mb-2">Для гибридного графика</h4>
                      <p className="text-sm text-blue-200/60 leading-relaxed">Команда и руководители всегда видят, кто сегодня работает из офиса, а кто подключился из дома.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white mb-2">Личное развитие</h4>
                      <p className="text-sm text-blue-200/60 leading-relaxed">Следите за своими успехами, смотрите статистику и ведите Индивидуальный план развития (ИПР).</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Download className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white mb-2">Простой старт</h4>
                      <p className="text-sm text-blue-200/60 leading-relaxed">Скачиваете приложение и входите по корпоративному логину и паролю, выданному в первый день.</p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeContent>
          </div>
        </section>

        {/* ── 3. Жизнь компании (Карусель) ── */}
        <section id="life" className="w-full max-w-[1440px] px-8 py-16 sm:py-20 md:py-32 scroll-mt-20 border-t border-white/5">
          <FadeContent>
            <div className="mb-6 text-xs sm:text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-4">
              <div className="h-[1px] w-8 bg-primary"></div> Сообщество
            </div>
            <BlurText 
              text="Больше, чем работа"
              className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white mb-8"
              delay={0.1}
            />
            <div className="max-w-3xl">
              <ScrollReveal className="text-xl md:text-2xl font-medium leading-relaxed text-white/90">
                Мы организуем митапы, участвуем в профильных конференциях и постоянно делимся опытом. У нас принято поддерживать коллег и расти вместе.
              </ScrollReveal>
            </div>
          </FadeContent>

          <FadeContent delay={0.3} className="mt-12 sm:mt-16 w-full">
            <AccordionGallery
              items={galleryItems}
              defaultIndex={2}
              expandRatio={0.52}
              trigger="hover"
              accentColor="#2563EB"
              overlayColor="#060010"
              textColor="#ffffff"
              grayscale
              showLabels
              duration={0.6}
              ease="power3.out"
              parallax={0.5}
              tilt={8}
              stagger={0.06}
              height={460}
              gap={10}
              radius={16}
              orientation="horizontal"
            />
          </FadeContent>
        </section>

        {/* ── 4. Детализированный Workflow (Твой путь к нам / Первый день) ── */}
        <section id="process" className="w-full px-8 py-16 sm:py-20 md:py-32 scroll-mt-20 border-t border-white/5 relative bg-[#060B14]">
          <div className="absolute inset-0 pointer-events-none z-0 opacity-20">
            <LightRays
              raysOrigin="top-center"
              raysColor="#2563EB"
              raysSpeed={1}
              lightSpread={0.5}
              rayLength={3}
              followMouse={true}
              mouseInfluence={0.1}
              noiseAmount={0}
              distortion={0}
              className="custom-rays"
              pulsating={false}
              fadeDistance={1}
              saturation={1}
            />
          </div>
          
          <div className="relative z-10 max-w-[1440px] mx-auto">
            <FadeContent>
              <div className="mb-6 text-xs sm:text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-4">
                <div className="h-[1px] w-8 bg-primary"></div> Онбординг
              </div>
              <SplitText 
                text="Как проходит первый день"
                className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white mb-8 text-left"
                delay={30}
                duration={1.25}
                ease="power3.out"
                splitType="chars"
                from={{ opacity: 0, y: 40 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.1}
                rootMargin="-100px"
                textAlign="left"
              />
              <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-4xl mb-12 sm:mb-16">
                Мы хотим, чтобы вы пришли в первый день уже с готовыми доступами и не тратили время на организационные мелочи. Поэтому всё главное можно сделать заранее, а в сам день останется познакомиться с командой и начать работу.
              </p>
            </FadeContent>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
              
              {/* Колонна 1: До первого дня */}
              <div className="space-y-8">
                <h3 className="font-display text-2xl font-bold text-white border-b border-white/10 pb-4 mb-8">До первого дня</h3>
                
                <div className="flex gap-5 sm:gap-6">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white font-mono font-bold text-base sm:text-lg">1</div>
                  <div>
                    <h4 className="text-lg font-bold text-white mb-2">Подача заявки</h4>
                    <p className="text-white/60 leading-relaxed text-sm sm:text-base">Вы подали заявку и получили решение. Мы проверяем её в течение <strong>2 рабочих дней</strong> и сообщаем результат на вашу личную почту.</p>
                  </div>
                </div>

                <div className="flex gap-5 sm:gap-6">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white font-mono font-bold text-base sm:text-lg">2</div>
                  <div>
                    <h4 className="text-lg font-bold text-white mb-2">Рабочая учетная запись</h4>
                    <p className="text-white/60 leading-relaxed text-sm sm:text-base">Мы создаём вашу учётную запись. Когда она готова, вы получаете письмо с логином. Временный пароль придёт отдельно в сообщении от HR в Telegram.</p>
                  </div>
                </div>

                <div className="flex gap-5 sm:gap-6">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white font-mono font-bold text-base sm:text-lg">3</div>
                  <div>
                    <h4 className="text-lg font-bold text-white mb-2">Вход в систему</h4>
                    <p className="text-white/60 leading-relaxed text-sm sm:text-base">Откройте ссылку из письма и войдите с рабочей учётной записью. При первом входе система попросит заменить временный пароль на свой. Знакомство с компанией засчитается автоматически.</p>
                  </div>
                </div>
              </div>

              {/* Колонна 2: В первый день (Bento cards) */}
              <div>
                <h3 className="font-display text-2xl font-bold text-white border-b border-white/10 pb-4 mb-8">Что вас ждёт в первый день</h3>
                <p className="text-white/60 mb-8 text-sm sm:text-base">Онбординг состоит из нескольких этапов. Они открываются по порядку, а вы видите свой прогресс и получаете баллы (XP) за каждый пройденный шаг.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
                    <Smartphone className="h-8 w-8 text-blue-400 mb-4" />
                    <h4 className="font-bold text-white mb-2">Приложения</h4>
                    <p className="text-sm text-white/60 leading-relaxed">Установите MPulse и MBusiness. Вход выполняется той же рабочей учётной записью.</p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
                    <FileText className="h-8 w-8 text-green-400 mb-4" />
                    <h4 className="font-bold text-white mb-2">Документы и доступы</h4>
                    <p className="text-sm text-white/60 leading-relaxed">Загрузите 5 документов для HR. Затем получите доступы к Wi-Fi и рабочему чату.</p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
                    <Users className="h-8 w-8 text-purple-400 mb-4" />
                    <h4 className="font-bold text-white mb-2">Команда и чек-лист</h4>
                    <p className="text-sm text-white/60 leading-relaxed">Познакомьтесь с командой, посмотрите видео о компании и пройдите технический чек-лист.</p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
                    <Monitor className="h-8 w-8 text-orange-400 mb-4" />
                    <h4 className="font-bold text-white mb-2">Ваше направление</h4>
                    <p className="text-sm text-white/60 leading-relaxed">Последний этап зависит от департамента: репозитории, Figma-макеты или регламенты.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Info Blocks */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4 rounded-2xl border border-primary/20 bg-primary/10 p-6">
                <Timer className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-white mb-2">Что дальше</h4>
                  <p className="text-sm text-white/70 leading-relaxed">Когда вы пройдёте всё до конца, система сообщит об этом вам, HR и вашему лиду, и онбординг будет завершён. На всё отведено <strong>7 дней</strong> с момента первого входа.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <HelpCircle className="h-6 w-6 text-white/50 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-white mb-2">Если что-то пошло не так</h4>
                  <p className="text-sm text-white/70 leading-relaxed">Не получается войти или нужна помощь с доступами? Напишите нам: <strong>hr@mdigital.kg</strong> или обратитесь в Service Desk.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. CTA: заявка на отдельной странице ── */}
        <section className="w-full max-w-[1440px] px-8 py-16 sm:py-20 md:py-32 scroll-mt-20 border-t border-white/5">
          <FadeContent>
            <div className="relative overflow-hidden rounded-[32px] border border-white/5 bg-[#080C14] p-8 sm:p-12 md:p-16 shadow-2xl">
              <div className="pointer-events-none absolute -top-32 right-0 h-[400px] w-[400px] rounded-full bg-white/[0.04] blur-[100px]"></div>
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-center">
                <div>
                  <div className="mb-6 text-xs sm:text-sm font-bold uppercase tracking-widest text-white/50 flex items-center gap-4">
                    <div className="h-[1px] w-8 bg-white/50"></div> Анкета кандидата
                  </div>
                  <BlurText
                    text="Оставить заявку"
                    className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white mb-6"
                    delay={0.1}
                  />
                  <p className="text-lg text-white/60 leading-relaxed max-w-xl">
                    {instruction}
                  </p>
                </div>
                <div className="flex flex-col gap-4 w-full lg:w-auto lg:min-w-[280px]">
                  <Button
                    size="lg"
                    className="w-full h-14 text-base font-semibold rounded-2xl bg-white text-black hover:bg-neutral-200 transition-colors"
                    onClick={() => nav('/application-form')}
                  >
                    Заполнить заявку <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-14 rounded-2xl border-white/10 text-white bg-transparent hover:bg-white/5 hover:text-white transition-colors"
                    onClick={() => nav('/status')}
                  >
                    Проверить статус
                  </Button>
                </div>
              </div>
            </div>
          </FadeContent>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-[#03060C] px-8 py-16 w-full relative z-10">
        <div className="max-w-[1440px] mx-auto grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-12">
          <div>
            <div className="flex items-center gap-3 mb-6">
           <img src={companyLogo} alt="MDigital Logo" className="h-6 sm:h-8 w-auto" />
            </div>
            <p className="text-sm leading-relaxed text-white/60 max-w-sm">
              Трансформируем бизнес через технологии. Создаем надежные IT-инфраструктуры и цифровые продукты для корпоративного сектора.
            </p>
          </div>
          
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-8 md:col-span-2">
            <div>
              <div className="mb-4 text-xs font-bold uppercase tracking-widest text-white/40">Навигация</div>
              <ul className="space-y-3 text-sm">
                {NAV_LINKS.map((l) => (
                  <li key={l.id}>
                    <button onClick={() => scrollToId(l.id)} className="text-white/60 transition-colors hover:text-white">
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <div className="mb-4 text-xs font-bold uppercase tracking-widest text-white/40">Документы</div>
              <ul className="space-y-3 text-sm text-white/60">
                <li><button onClick={() => nav('/status')} className="transition-colors hover:text-white">Статус заявки</button></li>
                <li><a href="#" className="transition-colors hover:text-white">Политика конфиденциальности</a></li>
                <li className="pt-4 flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> hr@mdigital.kg</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="max-w-[1440px] mx-auto mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/30">
          <span>© {new Date().getFullYear()} MDIGITAL. Все права защищены.</span>
          <span>Портал адаптации сотрудников</span>
        </div>
      </footer>
    </div>
  );
}
