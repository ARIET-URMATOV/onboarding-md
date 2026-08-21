import { Navigate, useLocation } from 'react-router-dom';
import { useOnboarding } from '../../store/useOnboarding';
import type { JSX } from 'react';

export function AuthGate({ children }: { children: JSX.Element }) {
  const user = useOnboarding((s) => s.user);
  const role = useOnboarding((s) => s.role);
  const loc = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (!role && loc.pathname !== '/role') return <Navigate to="/role" replace />;
  return children;
}

export function GuestOnly({ children }: { children: JSX.Element }) {
  const user = useOnboarding((s) => s.user);
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}
