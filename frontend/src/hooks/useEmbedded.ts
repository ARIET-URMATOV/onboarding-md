import { useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';

/** Открыт ли портал внутри нативного MPulse (?embedded=1): своя навигация, без веб-шапки. */
export function useEmbedded(): boolean {
  const [params] = useSearchParams();
  return params.get('embedded') === '1';
}

/** Тогглит body.webview-embedded — CSS в styles/webview.css прячет сайтную шапку. */
export function EmbeddedBodyClass() {
  const [params] = useSearchParams();
  useEffect(() => {
    document.body.classList.toggle('webview-embedded', params.get('embedded') === '1');
  }, [params]);
  return null;
}

const STANDARD_VIEWPORT = 'width=device-width, initial-scale=1.0';
const WEBVIEW_VIEWPORT =
  'viewport-fit=cover, width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no';

// Публичный сайт: WebView-подготовка НЕ применяется вообще.
const PUBLIC_ROUTES = ['/intro', '/status', '/login', '/register'];

/**
 * Граница WebView/сайт: на аутентифицированных маршрутах онбординга включает
 * body.wv (к нему привязаны все правила styles/webview.css) и лочит viewport
 * под MPulse WebView; на публичных маршрутах (/intro, /status, …) — снимает оба,
 * сайт остаётся байт-в-байт как до WebView-трека.
 */
export function WebViewScope() {
  const { pathname } = useLocation();
  useEffect(() => {
    const scoped = !PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
    document.body.classList.toggle('wv', scoped);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (meta) meta.setAttribute('content', scoped ? WEBVIEW_VIEWPORT : STANDARD_VIEWPORT);
  }, [pathname]);
  return null;
}
