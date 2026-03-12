import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { formatCurrency, monthToDateString } from '../lib/formatters'
import { supabase } from '../lib/supabaseClient'

function AdminExpensesPage() {
  const { user, hasSupabaseConfig } = useAuth()
  const [concept, setConcept] = useState('')
  const [expenseMonth, setExpenseMonth] = useState(new Date().toISOString().slice(0, 7))
  const [amount, setAmount] = useState('')
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadExpenses = async () => {
    if (!supabase || !hasSupabaseConfig) {
      setExpenses([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('id, concept, expense_month, amount, created_at')
      .order('created_at', { ascending: false })

    if (!error) {
      setExpenses(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadExpenses()
  }, [hasSupabaseConfig])

  const onSubmit = async (event) => {
    event.preventDefault()

    if (!supabase || !user?.id) {
      return
    }

    setSaving(true)
    const { error } = await supabase.from('expenses').insert({
      concept,
      expense_month: monthToDateString(expenseMonth),
      amount: Number(amount),
      created_by: user.id,
    })

    if (!error) {
      setConcept('')
      setAmount('')
      await loadExpenses()
    }

    setSaving(false)
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Registro de egresos</h2>

      <form className="card space-y-3" onSubmit={onSubmit}>
        <input
          required
          value={concept}
          onChange={(event) => setConcept(event.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          placeholder="Concepto del gasto"
        />

        <input
          type="month"
          required
          value={expenseMonth}
          onChange={(event) => setExpenseMonth(event.target.value)}
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
          placeholder="Monto"
        />

        <button type="submit" className="btn-primary" disabled={saving || !hasSupabaseConfig}>
          {saving ? 'Guardando...' : 'Guardar egreso'}
        </button>
      </form>

      <div className="card overflow-x-auto">
        <h3 className="mb-3 text-lg font-semibold">Egresos registrados</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="py-2 pr-3">Concepto</th>
              <th className="py-2 pr-3">Mes</th>
              <th className="py-2 pr-3">Monto</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="py-3" colSpan={3}>
                  Cargando egresos...
                </td>
              </tr>
            )}

            {!loading && expenses.length === 0 && (
              <tr>
                <td className="py-3" colSpan={3}>
                  No hay egresos cargados.
                </td>
              </tr>
            )}

            {!loading &&
              expenses.map((expense) => (
                <tr key={expense.id} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="py-3 pr-3">{expense.concept}</td>
                  <td className="py-3 pr-3">{expense.expense_month.slice(0, 7)}</td>
                  <td className="py-3 pr-3">{formatCurrency(expense.amount)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AdminExpensesPage
