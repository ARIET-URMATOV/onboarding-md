import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useOnboarding } from '../../store/useOnboarding';
import { useMe } from '../../api/queries';
import type { JSX } from 'react';

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
  const role = useOnboarding((s) => s.role);
  const loc = useLocation();

  useEffect(() => {
    if (data && !hydrated) hydrate(data);
    if (isError && !hydrated) {
      useOnboarding.setState({ hydrated: true });
    }
  }, [data, isError, hydrated, hydrate]);

  if (isLoading && !hydrated) return <BootLoader />;
  if (!hydrated) return <BootLoader />;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (!role && loc.pathname !== '/role') return <Navigate to="/role" replace />;
  return children;
}

export function GuestOnly({ children }: { children: JSX.Element }) {
  const { data, isLoading, isError } = useMe();
  const hydrate = useOnboarding((s) => s.hydrate);
  const hydrated = useOnboarding((s) => s.hydrated);
  const user = useOnboarding((s) => s.user);

  useEffect(() => {
    if (data && !hydrated) hydrate(data);
    if (isError && !hydrated) {
      useOnboarding.setState({ hydrated: true });
    }
  }, [data, isError, hydrated, hydrate]);

  if (isLoading && !hydrated) return <BootLoader />;
  if (!hydrated) return <BootLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}
