import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGate, GuestOnly, RequireRole } from './components/auth/AuthGate';
import { ToastProvider } from './components/ui/ToastProvider';
import './styles/global.css';

// Eager: auth pages (small, needed before hydration)
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

// Lazy: heavy / authenticated pages — code-split per route
const RoleSelectPage = lazy(() => import('./pages/RoleSelectPage').then((m) => ({ default: m.RoleSelectPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const StagesPage = lazy(() => import('./pages/StagesPage').then((m) => ({ default: m.StagesPage })));
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const CompletePage = lazy(() => import('./pages/CompletePage').then((m) => ({ default: m.CompletePage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

function PageFallback() {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', color: '#60A5FA', fontSize: 14 }}>Загрузка...</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <div className="app-shell">
        <div className="app-content">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
              <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
              <Route path="/role" element={<AuthGate><RoleSelectPage /></AuthGate>} />
              <Route path="/dashboard" element={<AuthGate><RequireRole><DashboardPage /></RequireRole></AuthGate>} />
              <Route path="/stages" element={<AuthGate><RequireRole><StagesPage /></RequireRole></AuthGate>} />
              <Route path="/roadmap" element={<Navigate to="/stages" replace />} />
              <Route path="/map" element={<AuthGate><RequireRole><MapPage /></RequireRole></AuthGate>} />
              <Route path="/profile" element={<AuthGate><RequireRole><ProfilePage /></RequireRole></AuthGate>} />
              <Route path="/complete" element={<AuthGate><RequireRole><CompletePage /></RequireRole></AuthGate>} />
              <Route path="/admin" element={<AuthGate><RequireRole><AdminPage /></RequireRole></AuthGate>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
      </ToastProvider>
    </BrowserRouter>
  );
}
