import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth';
import Layout from './components/Layout';
import LoginPage from './pages/Login';
import TodayPage from './pages/Today';
import DeliveriesPage from './pages/Deliveries';
import FailedPage from './pages/Failed';
import PackagesPage from './pages/Packages';
import CouriersPage from './pages/Couriers';
import CourierRoutesPage from './pages/CourierRoutes';
import RoutePathPage from './pages/RoutePath';
import ZonesPage from './pages/Zones';
import ReportsPage from './pages/Reports';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<TodayPage />} />
        <Route path="entregas/:id?" element={<DeliveriesPage />} />
        <Route path="no-entregados" element={<FailedPage />} />
        <Route path="paquetes" element={<PackagesPage />} />
        <Route path="repartidores" element={<CouriersPage />} />
        <Route path="repartidores/:courierId/recorridos" element={<CourierRoutesPage />} />
        <Route path="recorridos/:routeId" element={<RoutePathPage />} />
        <Route path="zonas" element={<ZonesPage />} />
        <Route path="reportes" element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
