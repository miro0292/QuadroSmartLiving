import { useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../lib/AuthContext'

function LoginPage() {
  const { signIn, resetPasswordWithApartmentAndEmail, hasSupabaseConfig } = useAuth()
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [recoveryApartment, setRecoveryApartment] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryPassword, setRecoveryPassword] = useState('')
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const onLoginSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })
    setLoading(true)

    try {
      await signIn(loginIdentifier, loginPassword)
      setFeedback({ type: 'success', message: 'Ingreso exitoso.' })
    } catch (error) {
      const errorMessage = String(error?.message || '')
      if (
        errorMessage.includes('Failed to fetch') ||
        errorMessage.toLowerCase().includes('invalid login credentials') ||
        errorMessage.toLowerCase().includes('invalid_credentials')
      ) {
        setFeedback({ type: 'error', message: 'Usuario o contraseña incorrectos' })
      } else {
        setFeedback({ type: 'error', message: error.message || 'No fue posible iniciar sesión.' })
      }
    } finally {
      setLoading(false)
    }
  }

  const onResetPasswordSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })
    setRecoveryLoading(true)

    try {
      await resetPasswordWithApartmentAndEmail({
        apartmentNumber: recoveryApartment,
        contactEmail: recoveryEmail,
        newPassword: recoveryPassword,
      })

      setRecoveryPassword('')
      setFeedback({
        type: 'success',
        message: 'Contraseña actualizada. Ya puedes iniciar sesión con tu nueva clave.',
      })
      setShowForgotPassword(false)
    } catch (error) {
      const errorMessage = String(error?.message || '')
      const isNetworkError =
        errorMessage.includes('Failed to fetch') ||
        errorMessage.toLowerCase().includes('networkerror') ||
        errorMessage.toLowerCase().includes('network request failed')

      setFeedback({
        type: 'error',
        message: isNetworkError
          ? 'No fue posible conectar con el servidor. Verifica VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y que el script SQL de recuperación esté ejecutado en Supabase.'
          : error?.message || 'No fue posible restablecer la contraseña.',
      })
    } finally {
      setRecoveryLoading(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-lg py-4">
      <article className="card border-zinc-300 dark:border-zinc-700">
        <div className="flex justify-center">
          <BrandLogo />
        </div>

        <h2 className="mt-6 text-center text-xl font-semibold text-zinc-900 dark:text-white">
          Iniciar sesión
        </h2>

        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-300">
          Registro de propietarios Quadro Smartliving.
        </p>

        {!hasSupabaseConfig && (
          <p className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            Configura `.env` para habilitar autenticación real.
          </p>
        )}

        <form className="mt-5 space-y-3" onSubmit={onLoginSubmit}>
          <input
            type="text"
            required
            value={loginIdentifier}
            onChange={(event) => setLoginIdentifier(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="Número de apartamento "
          />
          <input
            type="password"
            required
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="Contraseña"
          />
          <button type="submit" className="btn-primary w-full" disabled={loading || !hasSupabaseConfig}>
            {loading ? 'Validando...' : 'Entrar'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setShowForgotPassword((prev) => !prev)
            setFeedback({ type: '', message: '' })
          }}
          className="mt-3 w-full text-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
          disabled={!hasSupabaseConfig || loading || recoveryLoading}
        >
          {showForgotPassword ? 'Cancelar recuperación' : 'Olvidé mi contraseña'}
        </button>

        {showForgotPassword && (
          <form className="mt-4 space-y-3 rounded-xl border border-zinc-300 p-4 dark:border-zinc-700" onSubmit={onResetPasswordSubmit}>
            <p className="text-sm text-zinc-700 dark:text-zinc-200">
              Ingresa apartamento y correo de contacto para restablecer la contraseña.
            </p>

            <input
              type="text"
              required
              value={recoveryApartment}
              onChange={(event) => setRecoveryApartment(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="Número de apartamento"
            />

            <input
              type="email"
              required
              value={recoveryEmail}
              onChange={(event) => setRecoveryEmail(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="Correo de contacto"
            />

            <input
              type="password"
              required
              minLength={8}
              value={recoveryPassword}
              onChange={(event) => setRecoveryPassword(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="Nueva contraseña (mínimo 8 caracteres)"
            />

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={recoveryLoading || loading || !hasSupabaseConfig}
            >
              {recoveryLoading ? 'Actualizando...' : 'Restablecer contraseña'}
            </button>
          </form>
        )}

        {feedback.message && (
          <p
            className={`mt-4 rounded-xl px-3 py-2 text-sm ${
              feedback.type === 'error'
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
            }`}
          >
            {feedback.message}
          </p>
        )}
      </article>
    </section>
  )
}

export default LoginPage
