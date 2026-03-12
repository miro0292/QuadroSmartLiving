import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from './supabaseClient'

const AuthContext = createContext(null)
const authDebugEnabled =
  import.meta.env.DEV || String(import.meta.env.VITE_AUTH_DEBUG || '').trim().toLowerCase() === 'true'

function authDebug(...args) {
  if (authDebugEnabled) {
    console.log('[AuthDebug]', ...args)
  }
}

function withTimeout(promise, timeoutMs = 8000, timeoutMessage = 'Auth timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    }),
  ])
}

function normalizeDocumentNumber(value) {
  return String(value || '').replace(/[^0-9A-Za-z]/g, '')
}

function normalizeApartmentNumber(value) {
  return String(value || '').replace(/[^0-9A-Za-z]/g, '')
}

function buildLoginEmailByApartment(apartmentNumber) {
  const normalized = normalizeApartmentNumber(apartmentNumber)
  return normalized ? `apt.${normalized.toLowerCase()}@resident.local` : ''
}

function resolveAuthIdentifier(identifier) {
  const value = String(identifier || '').trim()

  if (value.includes('@')) {
    return value.toLowerCase()
  }

  return buildLoginEmailByApartment(value)
}

function parseApartmentFromLoginEmail(email) {
  const normalized = String(email || '').trim().toLowerCase()
  const match = normalized.match(/^apt\.([a-z0-9]+)@resident\.local$/)
  return match?.[1] || ''
}

async function fetchProfile(userId) {
  if (!supabase || !userId) {
    return null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, apartment_number, role, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

async function ensureOwnerProfileForApartmentLogin(authUser) {
  if (!supabase || !authUser?.id) {
    return null
  }

  const apartmentFromEmail = parseApartmentFromLoginEmail(authUser.email)

  if (!apartmentFromEmail) {
    return null
  }

  const payload = {
    id: authUser.id,
    full_name: authUser.user_metadata?.full_name || 'Propietario',
    apartment_number: apartmentFromEmail,
    role: 'owner',
    is_active: true,
  }

  const contactEmail = String(authUser.user_metadata?.contact_email || '').trim().toLowerCase()

  if (contactEmail && contactEmail.includes('@')) {
    payload.contact_email = contactEmail
  }

  const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })

  if (error) {
    throw error
  }

  return fetchProfile(authUser.id)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [autoRepairNotice, setAutoRepairNotice] = useState('')

  useEffect(() => {
    if (!autoRepairNotice) {
      return
    }

    const timer = setTimeout(() => {
      setAutoRepairNotice('')
    }, 5000)

    return () => clearTimeout(timer)
  }, [autoRepairNotice])

  const refreshProfile = useCallback(async (userId, authUser = null) => {
    if (!userId) {
      setProfile(null)
      return null
    }

    try {
      authDebug('refreshProfile:start', { userId })
      const profileData = await fetchProfile(userId)

      if (!profileData && authUser) {
        authDebug('refreshProfile:missing-profile, trying auto-repair', { userId, email: authUser?.email })
        const recoveredProfile = await ensureOwnerProfileForApartmentLogin(authUser)
        setProfile(recoveredProfile)

        if (recoveredProfile) {
          setAutoRepairNotice('Perfil recuperado automáticamente. Ya puedes usar pagos e historial.')
          authDebug('refreshProfile:auto-repair-success', { userId })
        }

        return recoveredProfile
      }

      setProfile(profileData)
      authDebug('refreshProfile:done', { userId, hasProfile: Boolean(profileData) })
      return profileData
    } catch {
      authDebug('refreshProfile:error', { userId })
      setProfile(null)
      return null
    }
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setLoading(false)
      return
    }

    const hasForcedLogout = window.location.hash.includes('logout=1')

    if (hasForcedLogout) {
      const basePath = window.location.pathname || '/'

      ;(async () => {
        try {
          await supabase.auth.signOut({ scope: 'local' })
        } catch {
        } finally {
          setSession(null)
          setProfile(null)

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

          setLoading(false)
          window.history.replaceState(null, '', `${basePath}#/`)
        }
      })()

      return
    }

    let isMounted = true

    const initializeAuth = async () => {
      try {
        authDebug('initializeAuth:start')
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          'No fue posible validar la sesión con el servidor.',
        )

        if (!isMounted) {
          return
        }

        if (error) {
          throw error
        }

        const currentSession = data?.session ?? null
        setSession(currentSession)
        authDebug('initializeAuth:session', { hasSession: Boolean(currentSession), userId: currentSession?.user?.id })

        if (currentSession?.user?.id) {
          await withTimeout(
            refreshProfile(currentSession.user.id, currentSession.user),
            8000,
            'No fue posible cargar el perfil del usuario.',
          )
        }
      } catch {
        authDebug('initializeAuth:error')
        if (isMounted) {
          setSession(null)
          setProfile(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)

      if (nextSession?.user?.id) {
        await refreshProfile(nextSession.user.id, nextSession.user)
      } else {
        setProfile(null)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [refreshProfile])

  const signIn = useCallback(async (identifier, password) => {
    if (!supabase) {
      throw new Error('Configura Supabase en el archivo .env para iniciar sesión.')
    }

    const email = resolveAuthIdentifier(identifier)
    authDebug('signIn:attempt', { identifier, email })

    if (!email) {
      throw new Error('Debes ingresar apartamento o correo válido.')
    }

    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      10000,
      'No fue posible iniciar sesión en este momento. Intenta nuevamente.',
    )

    if (error) {
      authDebug('signIn:error', { email, message: error.message })
      throw error
    }

    authDebug('signIn:success', { email })
  }, [])

  const resetPasswordWithApartmentAndEmail = useCallback(async ({ apartmentNumber, contactEmail, newPassword }) => {
    if (!supabase) {
      throw new Error('Configura Supabase en el archivo .env para restablecer contraseña.')
    }

    const normalizedApartment = normalizeApartmentNumber(apartmentNumber)
    const normalizedEmail = String(contactEmail || '').trim().toLowerCase()

    if (!normalizedApartment) {
      throw new Error('Debes ingresar el número de apartamento.')
    }

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Debes ingresar un correo válido.')
    }

    if (String(newPassword || '').length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres.')
    }

    authDebug('resetPassword:attempt', { apartmentNumber: normalizedApartment, contactEmail: normalizedEmail })

    const { error } = await withTimeout(
      supabase.rpc('reset_password_by_apartment_and_email', {
        p_apartment_number: normalizedApartment,
        p_contact_email: normalizedEmail,
        p_new_password: newPassword,
      }),
      10000,
      'La solicitud tardó demasiado. Verifica conexión y vuelve a intentar.',
    )

    if (error) {
      authDebug('resetPassword:error', { apartmentNumber: normalizedApartment, message: error.message })
      throw error
    }

    authDebug('resetPassword:success', { apartmentNumber: normalizedApartment })
  }, [])

  const signUpOwner = useCallback(async ({ documentNumber, contactEmail, password, fullName, apartmentNumber }) => {
    if (!supabase) {
      throw new Error('Configura Supabase en el archivo .env para registrar usuarios.')
    }

    const normalizedDocument = normalizeDocumentNumber(documentNumber)

    if (!normalizedDocument) {
      throw new Error('Número de documento inválido.')
    }

    const email = buildLoginEmailByApartment(apartmentNumber)

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      throw error
    }

    const userId = data.user?.id

    if (!userId) {
      return
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        document_number: normalizedDocument,
        contact_email: contactEmail?.trim().toLowerCase() || null,
        full_name: fullName,
        apartment_number: apartmentNumber,
        role: 'owner',
        is_active: true,
      },
      { onConflict: 'id' },
    )

    if (profileError) {
      throw profileError
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) {
      setSession(null)
      setProfile(null)
      return
    }

    try {
      await supabase.auth.signOut({ scope: 'local' })
    } finally {
      setSession(null)
      setProfile(null)

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
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      autoRepairNotice,
      hasSupabaseConfig,
      signIn,
      resetPasswordWithApartmentAndEmail,
      signUpOwner,
      signOut,
      refreshProfile,
      buildLoginEmailByApartment,
    }),
    [
      session,
      profile,
      loading,
      autoRepairNotice,
      signIn,
      resetPasswordWithApartmentAndEmail,
      signUpOwner,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }

  return context
}
