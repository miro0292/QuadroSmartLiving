import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { monthToDateString } from '../lib/formatters'
import { downloadPaymentCertificate } from '../lib/pdfReports'
import { hasCloudinaryConfig, uploadReceiptToCloudinary } from '../lib/cloudinaryClient'
import { supabase } from '../lib/supabaseClient'

const REQUEST_TIMEOUT_MS = 25000
const MAX_RECEIPT_SIZE_MB = 10

function formatSupabaseError(error, stage) {
  const message = String(error?.message || '').toLowerCase()
  const statusCode = Number(error?.statusCode || error?.status || 0)

  if (statusCode === 413 || message.includes('payload too large') || message.includes('entity too large')) {
    return `El comprobante supera el tamaño permitido. Usa un archivo menor a ${MAX_RECEIPT_SIZE_MB} MB.`
  }

  if (message.includes('cloudinary')) {
    return error?.message || 'No fue posible subir el comprobante a Cloudinary.'
  }

  if (message.includes('row-level security') || message.includes('new row violates row-level security')) {
    return 'No tienes permisos para esta acción (RLS). Verifica que tu perfil exista y esté activo, y que las políticas de storage/payments estén aplicadas.'
  }

  if (stage === 'upload') {
    return error?.message || 'No fue posible subir el comprobante.'
  }

  if (stage === 'insert') {
    return error?.message || 'No fue posible registrar el pago en la base de datos.'
  }

  return error?.message || 'No fue posible registrar el pago.'
}

function withTimeout(promise, timeoutMessage) {
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, REQUEST_TIMEOUT_MS)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId)
  })
}

function OwnerPaymentsPage() {
  const { user, profile, hasSupabaseConfig } = useAuth()
  const [apartmentNumber, setApartmentNumber] = useState('')
  const [paidMonth, setPaidMonth] = useState(new Date().toISOString().slice(0, 7))
  const [amount, setAmount] = useState('')
  const [channel, setChannel] = useState('mipagoamigo')
  const [receiptFile, setReceiptFile] = useState(null)
  const [lastPayment, setLastPayment] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savingStage, setSavingStage] = useState('')
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  useEffect(() => {
    if (profile?.apartment_number) {
      setApartmentNumber(profile.apartment_number)
    }
  }, [profile])

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!supabase || !hasSupabaseConfig) {
      setFeedback({ type: 'error', message: 'Configura Supabase para registrar pagos.' })
      return
    }

    if (!user?.id) {
      setFeedback({ type: 'error', message: 'Sesión inválida. Vuelve a ingresar.' })
      return
    }

    if (channel === 'manual_upload' && !receiptFile) {
      setFeedback({ type: 'error', message: 'Adjunta el comprobante para registrar un pago manual.' })
      return
    }

    if (receiptFile && !hasCloudinaryConfig) {
      setFeedback({
        type: 'error',
        message: 'Falta configurar Cloudinary para subir comprobantes. Revisa variables VITE_CLOUDINARY_*.',
      })
      return
    }

    if (receiptFile && receiptFile.size > MAX_RECEIPT_SIZE_MB * 1024 * 1024) {
      setFeedback({
        type: 'error',
        message: `El archivo es demasiado grande. Tamaño máximo: ${MAX_RECEIPT_SIZE_MB} MB.`,
      })
      return
    }

    setSaving(true)
    setSavingStage('Preparando registro...')
    const failsafeTimerId = window.setTimeout(() => {
      setSaving(false)
      setSavingStage('')
      setFeedback({
        type: 'error',
        message:
          'La operación sigue tardando más de lo esperado. Verifica tu conexión a internet o intenta de nuevo en unos segundos.',
      })
    }, REQUEST_TIMEOUT_MS + 5000)

    let failedStage = 'insert'

    try {
      const paymentInserted = await (async () => {
        let receiptUrl = null
        let receiptUploadWarning = ''

          if (receiptFile) {
            failedStage = 'upload'
            setSavingStage('Subiendo comprobante...')

            try {
              const cloudinaryUpload = await withTimeout(
                uploadReceiptToCloudinary(receiptFile, { userId: user.id }),
                'La carga del comprobante tardó demasiado. Verifica la conexión e inténtalo de nuevo.'
              )
              receiptUrl = cloudinaryUpload.secureUrl
            } catch (uploadError) {
              const uploadMessage = String(uploadError?.message || '').trim()
              const fallbackMessage =
                'No fue posible adjuntar el comprobante por un problema de red o de Cloudinary.'

              receiptUploadWarning = `Pago registrado sin comprobante. ${uploadMessage || fallbackMessage}`

              console.warn('No se pudo subir comprobante, se continúa con registro de pago:', {
                message: uploadError?.message,
                statusCode: uploadError?.statusCode || uploadError?.status,
                uploadError,
              })
            }
          }

        failedStage = 'insert'
        setSavingStage('Guardando pago en la base de datos...')

        const payload = {
          owner_id: user.id,
          apartment_number: apartmentNumber,
          paid_month: monthToDateString(paidMonth),
          amount: Number(amount),
          channel,
          receipt_url: receiptUrl,
        }

        const { data, error: insertError } = await withTimeout(
          supabase
            .from('payments')
            .insert(payload)
            .select('id, apartment_number, paid_month, amount, status, channel, created_at')
            .single(),
          'El registro del pago tardó demasiado. Inténtalo nuevamente.'
        )

        if (insertError) {
          throw insertError
        }

        return { payment: data, receiptUploadWarning }
      })()

      setLastPayment(paymentInserted.payment)

      setFeedback({
        type: 'success',
        message: paymentInserted.receiptUploadWarning || 'Pago registrado correctamente. Estado: pendiente.',
      })
      setAmount('')
      setReceiptFile(null)
    } catch (error) {
      setFeedback({ type: 'error', message: formatSupabaseError(error, failedStage) })
      console.error('Error registrando pago manual:', {
        stage: failedStage,
        message: error?.message,
        statusCode: error?.statusCode || error?.status,
        error,
      })
    } finally {
      window.clearTimeout(failsafeTimerId)
      setSaving(false)
      setSavingStage('')
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Pagos del propietario</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Registra pagos realizados por pasarela o con comprobante manual.
          </p>
        </div>
        <Link className="btn-secondary" to="/owner/history">
          Ver historial
        </Link>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="card">
          <h3 className="text-lg font-semibold">Pagar por Mi Pago Amigo</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Completa el proceso de pago y luego regresa para registrar el resultado.
          </p>
          <a
            className="btn-primary mt-4"
            href="http://mipagoamigo.com/MPA_WebSite/OwnProducts"
            target="_blank"
            rel="noreferrer"
          >
            Ir a Mi Pago Amigo
          </a>
        </article>

        <article className="card">
          <h3 className="text-lg font-semibold">Registrar pago</h3>
          <form className="mt-3 space-y-3" onSubmit={onSubmit}>
            <input
              required
              value={apartmentNumber}
              onChange={(event) => setApartmentNumber(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Número de apartamento"
            />

            <input
              type="month"
              required
              value={paidMonth}
              onChange={(event) => setPaidMonth(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />

            <input
              type="number"
              min="0"
              step="1"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Monto pagado"
            />

            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="mipagoamigo">Pago por Mi Pago Amigo</option>
              <option value="manual_upload">Pago manual con comprobante</option>
            </select>

            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => setReceiptFile(event.target.files?.[0] || null)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />

            <button type="submit" className="btn-primary w-full" disabled={saving || !hasSupabaseConfig}>
              {saving ? 'Guardando...' : 'Guardar registro'}
            </button>

            {saving && savingStage && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{savingStage}</p>
            )}
          </form>

          {feedback.message && (
            <p
              className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                feedback.type === 'error'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
              }`}
            >
              {feedback.message}
            </p>
          )}

          {lastPayment && (
            <button
              type="button"
              className="btn-secondary mt-3 w-full"
              onClick={async () => {
                await downloadPaymentCertificate(lastPayment, profile)
              }}
            >
              Descargar certificado del último pago (PDF)
            </button>
          )}
        </article>
      </div>
    </section>
  )
}

export default OwnerPaymentsPage
