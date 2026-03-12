import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { dateToMonth, formatCurrency } from '../lib/formatters'
import { downloadAdminDetailedReport } from '../lib/pdfReports'
import { supabase } from '../lib/supabaseClient'

const statusAction = {
  approved: 'Aprobar',
  rejected: 'Rechazar',
}

function AdminOverviewPage() {
  const { user, hasSupabaseConfig } = useAuth()
  const [payments, setPayments] = useState([])
  const [ownerMap, setOwnerMap] = useState({})
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)

  const loadPayments = async () => {
    if (!supabase || !hasSupabaseConfig) {
      setPayments([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('payments')
      .select('id, owner_id, apartment_number, paid_month, amount, status, receipt_url, created_at')
      .order('created_at', { ascending: false })

    if (!error) {
      setPayments(data || [])

      const ownerIds = [...new Set((data || []).map((item) => item.owner_id).filter(Boolean))]
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from('profiles')
          .select('id, full_name, apartment_number, document_number')
          .in('id', ownerIds)

        const mappedOwners = (owners || []).reduce((acc, owner) => {
          acc[owner.id] = owner
          return acc
        }, {})

        setOwnerMap(mappedOwners)
      } else {
        setOwnerMap({})
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    loadPayments()
  }, [hasSupabaseConfig])

  const approvedPayments = useMemo(
    () => payments.filter((payment) => payment.status === 'approved'),
    [payments],
  )

  const approvedInMonth = useMemo(
    () => approvedPayments.filter((payment) => dateToMonth(payment.paid_month) === selectedMonth),
    [approvedPayments, selectedMonth],
  )

  const monthTotals = useMemo(() => {
    const grouped = approvedPayments.reduce((acc, payment) => {
      const month = dateToMonth(payment.paid_month)
      acc[month] = (acc[month] || 0) + Number(payment.amount || 0)
      return acc
    }, {})

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, total]) => ({ month, total }))
  }, [approvedPayments])

  const totalMonth = approvedInMonth.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const averageTotal =
    monthTotals.length > 0
      ? monthTotals.reduce((sum, item) => sum + item.total, 0) / monthTotals.length
      : 0

  const updatePaymentStatus = async (paymentId, status) => {
    if (!supabase || !user?.id || !statusAction[status]) {
      return
    }

    const { error } = await supabase
      .from('payments')
      .update({ status, validated_at: new Date().toISOString(), validated_by: user.id })
      .eq('id', paymentId)

    if (!error) {
      await supabase.from('admin_audit_logs').insert({
        actor_id: user.id,
        action: 'payment_status_updated',
        details: { payment_id: paymentId, new_status: status },
      })
      await loadPayments()
    }
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Panel administrador</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Validación de pagos, recaudo mensual y promedio histórico.
          </p>
        </div>
        <Link className="btn-secondary" to="/admin/expenses">
          Cargar egresos
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="card">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total recaudado en {selectedMonth}</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(totalMonth)}</p>
        </article>
        <article className="card">
          <p className="text-sm text-slate-500 dark:text-slate-400">Pagos validados</p>
          <p className="mt-2 text-2xl font-bold">{approvedPayments.length}</p>
        </article>
        <article className="card">
          <p className="text-sm text-slate-500 dark:text-slate-400">Promedio recaudo mensual</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(averageTotal)}</p>
        </article>
      </div>

      <div className="card">
        <label className="mb-2 block text-sm font-medium" htmlFor="monthFilter">
          Mes para cálculo de recaudo
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="monthFilter"
            type="month"
            className="w-full max-w-xs rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              await downloadAdminDetailedReport({
                payments,
                ownerMap,
                selectedMonth,
              })
            }}
            disabled={payments.length === 0}
          >
            Descargar reporte detallado PDF
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h3 className="mb-3 text-lg font-semibold">Pagos de propietarios</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="py-2 pr-3">Apartamento</th>
              <th className="py-2 pr-3">Mes</th>
              <th className="py-2 pr-3">Monto</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3">Comprobante</th>
              <th className="py-2 pr-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="py-3" colSpan={6}>
                  Cargando pagos...
                </td>
              </tr>
            )}

            {!loading && payments.length === 0 && (
              <tr>
                <td className="py-3" colSpan={6}>
                  No hay pagos registrados.
                </td>
              </tr>
            )}

            {!loading &&
              payments.map((payment) => (
                <tr key={payment.id} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="py-3 pr-3">{payment.apartment_number}</td>
                  <td className="py-3 pr-3">{dateToMonth(payment.paid_month)}</td>
                  <td className="py-3 pr-3">{formatCurrency(payment.amount)}</td>
                  <td className="py-3 pr-3">{payment.status}</td>
                  <td className="py-3 pr-3">
                    {payment.receipt_url ? (
                      <a className="text-brand-600 underline" href={payment.receipt_url} target="_blank" rel="noreferrer">
                        Ver
                      </a>
                    ) : (
                      'No'
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => updatePaymentStatus(payment.id, 'approved')}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => updatePaymentStatus(payment.id, 'rejected')}
                      >
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h3 className="mb-3 text-lg font-semibold">Recaudo por mes</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="py-2 pr-3">Mes</th>
              <th className="py-2 pr-3">Total aprobado</th>
            </tr>
          </thead>
          <tbody>
            {monthTotals.length === 0 && (
              <tr>
                <td className="py-3" colSpan={2}>
                  Sin recaudo aprobado aún.
                </td>
              </tr>
            )}
            {monthTotals.map((item) => (
              <tr key={item.month} className="border-b border-slate-100 dark:border-slate-900">
                <td className="py-3 pr-3">{item.month}</td>
                <td className="py-3 pr-3">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AdminOverviewPage
