import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGate, GuestOnly } from './components/auth/AuthGate';
import './styles/global.css';

// Eager: auth pages (small, needed before hydration)
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

// Lazy: heavy / authenticated pages — code-split per route
const RoleSelectPage = lazy(() => import('./pages/RoleSelectPage').then((m) => ({ default: m.RoleSelectPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const RoadmapPage = lazy(() => import('./pages/RoadmapPage').then((m) => ({ default: m.RoadmapPage })));
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const CompletePage = lazy(() => import('./pages/CompletePage').then((m) => ({ default: m.CompletePage })));

function PageFallback() {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', color: '#60A5FA', fontSize: 14 }}>Загрузка...</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <div className="app-content">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
              <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
              <Route path="/role" element={<AuthGate><RoleSelectPage /></AuthGate>} />
              <Route path="/dashboard" element={<AuthGate><DashboardPage /></AuthGate>} />
              <Route path="/roadmap" element={<AuthGate><RoadmapPage /></AuthGate>} />
              <Route path="/map" element={<AuthGate><MapPage /></AuthGate>} />
              <Route path="/profile" element={<AuthGate><ProfilePage /></AuthGate>} />
              <Route path="/complete" element={<AuthGate><CompletePage /></AuthGate>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </BrowserRouter>
  );
}
