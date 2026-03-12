import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { LogOut, Moon, Sun } from 'lucide-react'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './lib/AuthContext'
import BrandLogo from './components/BrandLogo'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const OwnerPaymentsPage = lazy(() => import('./pages/OwnerPaymentsPage'))
const OwnerHistoryPage = lazy(() => import('./pages/OwnerHistoryPage'))
const AdminOverviewPage = lazy(() => import('./pages/AdminOverviewPage'))
const AdminExpensesPage = lazy(() => import('./pages/AdminExpensesPage'))
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'))

function isApartmentAuthUser(email) {
  return /^apt\.[a-z0-9]+@resident\.local$/i.test(String(email || '').trim())
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [isSigningOut, setIsSigningOut] = useState(false)
  const { user, profile, signOut, hasSupabaseConfig, autoRepairNotice } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const themeLabel = useMemo(
    () => (theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'),
    [theme],
  )

  const homePath =
    profile?.role === 'super_admin'
      ? '/super/users'
      : profile?.role === 'admin'
        ? '/admin/overview'
        : '/owner/payments'
  const hasOwnerAccess = profile?.role === 'owner' || (!profile && isApartmentAuthUser(user?.email))

  const onSignOut = async () => {
    if (isSigningOut) {
      return
    }

    setIsSigningOut(true)
    const basePath = window.location.pathname || '/'

    const forceGoLogin = () => {
      try {
        Object.keys(localStorage)
          .filter((key) => key.startsWith('sb-'))
          .forEach((key) => localStorage.removeItem(key))
      } catch {}

      try {
        Object.keys(sessionStorage)
          .filter((key) => key.startsWith('sb-'))
          .forEach((key) => sessionStorage.removeItem(key))
      } catch {}

      window.location.replace(`${basePath}#/?logout=1&t=${Date.now()}`)
      setTimeout(() => {
        window.location.reload()
      }, 50)
    }

    try {
      await signOut()
    } catch {
    } finally {
      navigate('/', { replace: true })
      forceGoLogin()
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <BrandLogo compact />
            {!hasSupabaseConfig && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Falta configurar variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
              </p>
            )}
            {autoRepairNotice && (
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">{autoRepairNotice}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {user && hasOwnerAccess && (
              <>
                <Link className="btn-secondary" to="/owner/payments">
                  Pagos
                </Link>
                <Link className="btn-secondary" to="/owner/history">
                  Historial
                </Link>
              </>
            )}

            {user && profile?.role === 'admin' && (
              <>
                <Link className="btn-secondary" to="/admin/overview">
                  Panel
                </Link>
                <Link className="btn-secondary" to="/admin/expenses">
                  Egresos
                </Link>
              </>
            )}

            {user && profile?.role === 'super_admin' && (
              <>
                <Link className="btn-secondary" to="/super/users">
                  Super panel
                </Link>
                <Link className="btn-secondary" to="/admin/overview">
                  Recaudo
                </Link>
                <Link className="btn-secondary" to="/admin/expenses">
                  Egresos
                </Link>
              </>
            )}

            <button
              type="button"
              aria-label={themeLabel}
              className="btn-secondary"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {user && (
              <button type="button" className="btn-secondary" onClick={onSignOut} disabled={isSigningOut}>
                <LogOut size={16} />
                <span className="ml-2">Cerrar sesión</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Suspense
          fallback={
            <div className="card mx-auto max-w-xl text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">Cargando módulo...</p>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={user ? <Navigate to={homePath} replace /> : <LoginPage />} />

            <Route
              path="/owner/payments"
              element={
                <ProtectedRoute allowedRoles={['owner']}>
                  <OwnerPaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/history"
              element={
                <ProtectedRoute allowedRoles={['owner']}>
                  <OwnerHistoryPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/overview"
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <AdminOverviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/expenses"
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <AdminExpensesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/super/users"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <SuperAdminPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App
