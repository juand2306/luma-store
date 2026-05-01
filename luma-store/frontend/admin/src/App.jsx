import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './store/authContext'

import Layout from './components/Layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventario from './pages/Inventario'
import Caja from './pages/Caja'
import Ventas from './pages/Ventas'
import Pedidos from './pages/Pedidos'
import Clientes from './pages/Clientes'
import Reportes from './pages/Reportes'
import Configuracion from './pages/Configuracion'
import VentaRapida from './pages/VentaRapida'
import Perfil from './pages/Perfil'
import { PageLoader } from './components/ui/Misc'

// Protect routes from unauthenticated users
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

// Rol-based protection
function RoleRoute({ children, allow }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (allow && !allow.includes(user.role)) return <Navigate to="/" replace />
  return children
}

// Redirect authenticated users away from login
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <PageLoader />
  if (isAuthenticated) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* Venta Rápida — fuera del Layout (sin sidebar) */}
      <Route path="/ventas-rapidas" element={
        <ProtectedRoute>
          <RoleRoute allow={['owner','admin','seller']}><VentaRapida /></RoleRoute>
        </ProtectedRoute>
      } />

      {/* Protected admin routes */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="/inventario"      element={<RoleRoute allow={['owner','admin']}><Inventario /></RoleRoute>} />
        <Route path="/caja"            element={<RoleRoute allow={['owner','admin']}><Caja /></RoleRoute>} />
        <Route path="/ventas"          element={<RoleRoute allow={['owner','admin']}><Ventas /></RoleRoute>} />
        <Route path="/pedidos"         element={<RoleRoute allow={['owner','admin']}><Pedidos /></RoleRoute>} />
        <Route path="/clientes"        element={<RoleRoute allow={['owner','admin']}><Clientes /></RoleRoute>} />
        <Route path="/reportes"        element={<Reportes />} />
        <Route path="/configuracion"   element={<RoleRoute allow={['owner']}><Configuracion /></RoleRoute>} />
        <Route path="/perfil"          element={<Perfil />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#fff',
              color: '#1C1C1E',
              border: '1px solid #E4E0D9',
              borderRadius: '14px',
              fontSize: '13px',
              fontWeight: '500',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              padding: '12px 16px',
            },
            success: { iconTheme: { primary: '#0D8585', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
