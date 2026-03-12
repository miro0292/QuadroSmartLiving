import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { dateToMonth, formatCurrency } from '../lib/formatters'
import { downloadOwnerHistoryPdf, downloadPaymentCertificate } from '../lib/pdfReports'
import { supabase } from '../lib/supabaseClient'

const statusLabel = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

function OwnerHistoryPage() {
  const { user, profile, hasSupabaseConfig } = useAuth()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPayments = async () => {
      if (!supabase || !hasSupabaseConfig || !user?.id) {
        setPayments([])
        setLoading(false)
        return
      }

      setLoading(true)
      const { data, error } = await supabase
        .from('payments')
        .select('id, apartment_number, paid_month, amount, status, receipt_url, channel, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (!error) {
        setPayments(data || [])
      }
      setLoading(false)
    }

    loadPayments()
  }, [hasSupabaseConfig, user?.id])

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Historial de pagos</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              await downloadOwnerHistoryPdf(payments, profile)
            }}
            disabled={payments.length === 0}
          >
            Descargar historial PDF
          </button>
          <Link className="btn-secondary" to="/owner/payments">
            Registrar nuevo pago
          </Link>
        </div>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="py-2 pr-3">Apartamento</th>
              <th className="py-2 pr-3">Mes</th>
              <th className="py-2 pr-3">Monto</th>
              <th className="py-2 pr-3">Canal</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3">Comprobante</th>
              <th className="py-2 pr-3">Certificado PDF</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="py-3" colSpan={7}>
                  Cargando pagos...
                </td>
              </tr>
            )}

            {!loading && payments.length === 0 && (
              <tr>
                <td className="py-3" colSpan={7}>
                  Aún no tienes pagos registrados.
                </td>
              </tr>
            )}

            {!loading &&
              payments.map((payment) => (
                <tr key={payment.id} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="py-3 pr-3">{payment.apartment_number}</td>
                  <td className="py-3 pr-3">{dateToMonth(payment.paid_month)}</td>
                  <td className="py-3 pr-3">{formatCurrency(payment.amount)}</td>
                  <td className="py-3 pr-3">{payment.channel === 'mipagoamigo' ? 'Mi Pago Amigo' : 'Manual'}</td>
                  <td className="py-3 pr-3">{statusLabel[payment.status] || payment.status}</td>
                  <td className="py-3 pr-3">
                    {payment.receipt_url ? (
                      <a className="text-brand-600 underline" href={payment.receipt_url} target="_blank" rel="noreferrer">
                        Ver
                      </a>
                    ) : (
                      'No cargado'
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={async () => {
                        await downloadPaymentCertificate(payment, profile)
                      }}
                    >
                      Descargar
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default OwnerHistoryPage
