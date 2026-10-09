import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useOnboarding } from '../../store/useOnboarding';
import { useMe } from '../../api/queries';
import type { JSX } from 'react';

// Safety net: if /api/me never settles (dead backend / hung proxy),
// don't trap the user on the boot splash forever.
const BOOT_TIMEOUT_MS = 8000;

function useBootTimeout(active: boolean) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setTimedOut(true), BOOT_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [active]);
  return timedOut;
}

function BootLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0A0F1E' }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 10, height: 10, borderRadius: '50%', background: '#2563EB',
              boxShadow: '0 0 12px rgba(37,99,235,.6)',
              animation: `bootBounce 1s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
        <style>{`@keyframes bootBounce { 0%,100%{ transform:translateY(0); opacity:.5 } 50%{ transform:translateY(-8px); opacity:1 } }`}</style>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: JSX.Element }) {
  const { data, isLoading, isError } = useMe();
  const hydrate = useOnboarding((s) => s.hydrate);
  const hydrated = useOnboarding((s) => s.hydrated);
  const user = useOnboarding((s) => s.user);
  const loc = useLocation();

  const timedOut = useBootTimeout(!hydrated);

  useEffect(() => {
    if (data && !hydrated) hydrate(data);
    if (isError && !hydrated) {
      useOnboarding.setState({ hydrated: true });
    }
  }, [data, isError, hydrated, hydrate]);

  if (timedOut && !hydrated) {
    // Backend unreachable: fail open to login instead of hanging forever.
    useOnboarding.setState({ hydrated: true });
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }
  if (isLoading && !hydrated) return <BootLoader />;
  if (!hydrated) return <BootLoader />;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

export function RequireRole({ children }: { children: JSX.Element }) {
  // FR-406: департамент подставляется из заявки/AD, ручного выбора роли нет.
  // Оставлен как pass-through для совместимости старых импортов.
  return children;
}

export function GuestOnly({ children }: { children: JSX.Element }) {
  const { data, isLoading, isError } = useMe();
  const hydrate = useOnboarding((s) => s.hydrate);
  const hydrated = useOnboarding((s) => s.hydrated);
  const user = useOnboarding((s) => s.user);

  const timedOut = useBootTimeout(!hydrated);

  useEffect(() => {
    if (data && !hydrated) hydrate(data);
    if (isError && !hydrated) {
      useOnboarding.setState({ hydrated: true });
    }
  }, [data, isError, hydrated, hydrate]);

  if (timedOut && !hydrated) {
    // Backend unreachable: fail open to the public page instead of hanging forever.
    // If /api/me resolves late with a user, hydration will redirect to /dashboard then.
    useOnboarding.setState({ hydrated: true });
  }
  if (isLoading && !hydrated) return <BootLoader />;
  if (!hydrated) return <BootLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}
