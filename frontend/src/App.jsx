import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage      from './pages/LoginPage';
import MeseroPage     from './pages/mesero/MeseroPage';
import BienvenidaPage from './pages/cliente/BienvenidaPage';
import MenuPage       from './pages/cliente/MenuPage';
import UnirstePage        from './pages/cliente/UnirstePage';
import SesionTerminadaPage from './pages/cliente/SesionTerminadaPage';
import QRPage             from './pages/admin/QRPage';
import AdminPage      from './pages/admin/AdminPage';
import ProductosPage  from './pages/admin/ProductosPage';
import CajeroPage     from './pages/cajero/CajeroPage';

const ProtectedRoute = ({ children, roles }) => {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/login" />;
  return children;
};


function AppRoutes() {
  return (
    <Routes>
      {/* Staff */}
      <Route path="/login" element={<LoginPage />} />

      <Route path="/dashboard" element={
        <ProtectedRoute roles={['Administrador']}>
          <AdminPage />
        </ProtectedRoute>
      } />

      <Route path="/mesero" element={
        <ProtectedRoute roles={['Mesero', 'Administrador']}>
          <MeseroPage />
        </ProtectedRoute>
      } />

      <Route path="/cajero" element={
        <ProtectedRoute roles={['Cajero', 'Administrador']}>
          <CajeroPage />
        </ProtectedRoute>
      } />

      <Route path="/admin/qr" element={
        <ProtectedRoute roles={['Administrador']}>
          <QRPage />
        </ProtectedRoute>
      } />

      <Route path="/admin/productos" element={
        <ProtectedRoute roles={['Administrador']}>
          <ProductosPage />
        </ProtectedRoute>
      } />

      {/* Cliente */}
      <Route path="/mesa/:qr_codigo"         element={<BienvenidaPage />} />
      <Route path="/menu/:qr_codigo"         element={<MenuPage />} />
      <Route path="/unirse/:token_invitacion" element={<UnirstePage />} />
      <Route path="/sesion-terminada"        element={<SesionTerminadaPage />} />

      {/* Defaults */}
      <Route path="/"  element={<Navigate to="/login" />} />
      <Route path="*"  element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
