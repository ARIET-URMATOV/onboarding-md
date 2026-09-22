import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGate, GuestOnly } from './components/auth/AuthGate';
import { ToastProvider } from './components/ui/ToastProvider';
import './styles/global.css';

// Eager: auth pages (small, needed before hydration)
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AuthStartPage } from './pages/AuthStartPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';

// Lazy: heavy / authenticated pages — code-split per route
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
              <Route path="/auth/start" element={<AuthStartPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/dashboard" element={<AuthGate><DashboardPage /></AuthGate>} />
              <Route path="/stages" element={<AuthGate><StagesPage /></AuthGate>} />
              <Route path="/roadmap" element={<Navigate to="/stages" replace />} />
              <Route path="/map" element={<AuthGate><MapPage /></AuthGate>} />
              <Route path="/profile" element={<AuthGate><ProfilePage /></AuthGate>} />
              <Route path="/complete" element={<AuthGate><CompletePage /></AuthGate>} />
              <Route path="/admin" element={<AuthGate><AdminPage /></AuthGate>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
      </ToastProvider>
    </BrowserRouter>
  );
}
