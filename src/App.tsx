import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { RoleSelectPage } from './pages/RoleSelectPage';
import { DashboardPage } from './pages/DashboardPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { MapPage } from './pages/MapPage';
import { CompletePage } from './pages/CompletePage';
import { AuthGate, GuestOnly } from './components/auth/AuthGate';
import './styles/global.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
            <Route path="/role" element={<AuthGate><RoleSelectPage /></AuthGate>} />
            <Route path="/dashboard" element={<AuthGate><DashboardPage /></AuthGate>} />
            <Route path="/roadmap" element={<AuthGate><RoadmapPage /></AuthGate>} />
            <Route path="/map" element={<AuthGate><MapPage /></AuthGate>} />
            <Route path="/complete" element={<AuthGate><CompletePage /></AuthGate>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
