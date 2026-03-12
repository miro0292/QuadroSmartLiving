import { useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

function isApartmentAuthUser(email) {
  return /^apt\.[a-z0-9]+@resident\.local$/i.test(String(email || '').trim())
}

function ProtectedRoute({ children, allowedRoles }) {
  const { loading, user, profile, signOut } = useAuth()
  const blockedHandledRef = useRef(false)
  const allowOwnerFallback =
    !profile &&
    Boolean(user?.id) &&
    isApartmentAuthUser(user?.email) &&
    (!allowedRoles || allowedRoles.includes('owner'))

  useEffect(() => {
    if (profile?.is_active === false && !blockedHandledRef.current) {
      blockedHandledRef.current = true
      signOut()
    }

    if (profile?.is_active !== false) {
      blockedHandledRef.current = false
    }
  }, [profile?.is_active, signOut])

  if (loading) {
    return (
      <div className="card mx-auto max-w-xl text-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">Cargando sesión...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (!profile) {
    if (allowOwnerFallback) {
      return children
    }

    return (
      <div className="card mx-auto max-w-xl text-center">
        <h2 className="text-lg font-semibold">Perfil no encontrado</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Tu cuenta existe, pero no tiene perfil en la tabla profiles. Contacta al administrador.
        </p>
      </div>
    )
  }

  if (profile.is_active === false) {
    return (
      <div className="card mx-auto max-w-xl text-center">
        <h2 className="text-lg font-semibold">Cuenta bloqueada</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Tu acceso fue deshabilitado por un superusuario. Contacta a la administración.
        </p>
      </div>
    )
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return (
      <Navigate
        to={
          profile.role === 'super_admin'
            ? '/super/users'
            : profile.role === 'admin'
              ? '/admin/overview'
              : '/owner/payments'
        }
        replace
      />
    )
  }

  return children
}

export default ProtectedRoute
