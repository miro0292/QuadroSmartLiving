import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

const roleOptions = ['owner', 'admin', 'super_admin']

function SuperAdminPage() {
  const { hasSupabaseConfig, user } = useAuth()
  const [ownerForm, setOwnerForm] = useState({
    documentNumber: '',
    fullName: '',
    apartmentNumber: '',
    password: '',
    contactEmail: '',
  })
  const [profiles, setProfiles] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [creatingOwner, setCreatingOwner] = useState(false)
  const [message, setMessage] = useState('')

  const loadData = async () => {
    if (!supabase || !hasSupabaseConfig) {
      setProfiles([])
      setAuditLogs([])
      setLoading(false)
      return
    }

    setLoading(true)

    const [profilesResult, logsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, apartment_number, role, is_active, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('admin_audit_logs')
        .select('id, actor_id, target_profile_id, action, details, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (!profilesResult.error) {
      setProfiles(profilesResult.data || [])
    }

    if (!logsResult.error) {
      setAuditLogs(logsResult.data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [hasSupabaseConfig])

  const nameMap = useMemo(() => {
    const map = new Map()
    profiles.forEach((profile) => {
      map.set(profile.id, profile.full_name || profile.apartment_number || profile.id)
    })
    return map
  }, [profiles])

  const stats = useMemo(() => {
    const owners = profiles.filter((p) => p.role === 'owner').length
    const admins = profiles.filter((p) => p.role === 'admin').length
    const superAdmins = profiles.filter((p) => p.role === 'super_admin').length
    const blocked = profiles.filter((p) => p.is_active === false).length

    return { owners, admins, superAdmins, blocked }
  }, [profiles])

  const updateProfile = async (id, payload) => {
    if (!supabase) {
      return
    }

    setSavingId(id)
    setMessage('')

    const { error } = await supabase.from('profiles').update(payload).eq('id', id)

    if (error) {
      setMessage(error.message || 'No fue posible actualizar el perfil.')
      setSavingId(null)
      return
    }

    await supabase.from('admin_audit_logs').insert({
      actor_id: user?.id ?? null,
      target_profile_id: id,
      action: 'super_admin_profile_updated',
      details: payload,
    })

    setMessage('Perfil actualizado correctamente.')
    await loadData()
    setSavingId(null)
  }

  const onFieldChange = (id, key, value) => {
    setProfiles((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)))
  }

  const onOwnerFieldChange = (key, value) => {
    setOwnerForm((prev) => ({ ...prev, [key]: value }))
  }

  const createOwner = async (event) => {
    event.preventDefault()
    if (!supabase) {
      return
    }

    setCreatingOwner(true)
    setMessage('')

    const { error } = await supabase.rpc('create_owner_with_document', {
      p_document_number: ownerForm.documentNumber,
      p_full_name: ownerForm.fullName,
      p_apartment_number: ownerForm.apartmentNumber,
      p_password: ownerForm.password,
      p_contact_email: ownerForm.contactEmail || null,
    })

    if (error) {
      setMessage(error.message || 'No fue posible crear el propietario.')
      setCreatingOwner(false)
      return
    }

    await supabase.from('admin_audit_logs').insert({
      actor_id: user?.id ?? null,
      action: 'owner_created_by_super_admin',
      details: {
        document_number: ownerForm.documentNumber,
        apartment_number: ownerForm.apartmentNumber,
        contact_email: ownerForm.contactEmail || null,
      },
    })

    setOwnerForm({
      documentNumber: '',
      fullName: '',
      apartmentNumber: '',
      password: '',
      contactEmail: '',
    })
    setMessage('Propietario creado correctamente.')
    await loadData()
    setCreatingOwner(false)
  }

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold">Superusuario · Control avanzado</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Gestión global de usuarios, roles, bloqueo de cuentas y auditoría de cambios.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <article className="card">
          <p className="text-sm text-slate-500 dark:text-slate-400">Propietarios</p>
          <p className="mt-2 text-2xl font-bold">{stats.owners}</p>
        </article>
        <article className="card">
          <p className="text-sm text-slate-500 dark:text-slate-400">Administradores</p>
          <p className="mt-2 text-2xl font-bold">{stats.admins}</p>
        </article>
        <article className="card">
          <p className="text-sm text-slate-500 dark:text-slate-400">Super usuarios</p>
          <p className="mt-2 text-2xl font-bold">{stats.superAdmins}</p>
        </article>
        <article className="card">
          <p className="text-sm text-slate-500 dark:text-slate-400">Cuentas bloqueadas</p>
          <p className="mt-2 text-2xl font-bold">{stats.blocked}</p>
        </article>
      </div>

      {message && (
        <p className="rounded-xl bg-brand-100 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
          {message}
        </p>
      )}

      <div className="card">
        <h3 className="mb-3 text-lg font-semibold">Registrar nuevo propietario</h3>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={createOwner}>
          <input
            required
            value={ownerForm.documentNumber}
            onChange={(event) => onOwnerFieldChange('documentNumber', event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            placeholder="Número de documento"
          />
          <input
            required
            value={ownerForm.fullName}
            onChange={(event) => onOwnerFieldChange('fullName', event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            placeholder="Nombre completo"
          />
          <input
            required
            value={ownerForm.apartmentNumber}
            onChange={(event) => onOwnerFieldChange('apartmentNumber', event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            placeholder="Apartamento"
          />
          <input
            type="email"
            value={ownerForm.contactEmail}
            onChange={(event) => onOwnerFieldChange('contactEmail', event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            placeholder="Correo de contacto (opcional)"
          />
          <input
            type="password"
            required
            minLength={8}
            value={ownerForm.password}
            onChange={(event) => onOwnerFieldChange('password', event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            placeholder="Contraseña"
          />
          <div className="flex items-center">
            <button type="submit" className="btn-primary" disabled={creatingOwner || !hasSupabaseConfig}>
              {creatingOwner ? 'Creando...' : 'Crear propietario'}
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <h3 className="mb-3 text-lg font-semibold">Gestión de usuarios</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="py-2 pr-3">Nombre</th>
              <th className="py-2 pr-3">Apartamento</th>
              <th className="py-2 pr-3">Rol</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3">ID</th>
              <th className="py-2 pr-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="py-3" colSpan={6}>
                  Cargando usuarios...
                </td>
              </tr>
            )}

            {!loading && profiles.length === 0 && (
              <tr>
                <td className="py-3" colSpan={6}>
                  No hay perfiles registrados.
                </td>
              </tr>
            )}

            {!loading &&
              profiles.map((profile) => (
                <tr key={profile.id} className="border-b border-slate-100 align-top dark:border-slate-900">
                  <td className="py-3 pr-3">
                    <input
                      value={profile.full_name || ''}
                      onChange={(event) => onFieldChange(profile.id, 'full_name', event.target.value)}
                      className="w-44 rounded-xl border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <input
                      value={profile.apartment_number || ''}
                      onChange={(event) => onFieldChange(profile.id, 'apartment_number', event.target.value)}
                      className="w-32 rounded-xl border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <select
                      value={profile.role}
                      onChange={(event) => onFieldChange(profile.id, 'role', event.target.value)}
                      className="w-36 rounded-xl border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-3">
                    <select
                      value={profile.is_active ? 'active' : 'blocked'}
                      onChange={(event) =>
                        onFieldChange(profile.id, 'is_active', event.target.value === 'active')
                      }
                      className="w-32 rounded-xl border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="active">Activo</option>
                      <option value="blocked">Bloqueado</option>
                    </select>
                  </td>
                  <td className="py-3 pr-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{profile.id}</span>
                  </td>
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={savingId === profile.id}
                      onClick={() =>
                        updateProfile(profile.id, {
                          full_name: profile.full_name || null,
                          apartment_number: profile.apartment_number || 'SIN_APTO',
                          role: profile.role,
                          is_active: profile.is_active,
                        })
                      }
                    >
                      {savingId === profile.id ? 'Guardando...' : 'Guardar'}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h3 className="mb-3 text-lg font-semibold">Bitácora de seguridad</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="py-2 pr-3">Fecha</th>
              <th className="py-2 pr-3">Actor</th>
              <th className="py-2 pr-3">Usuario objetivo</th>
              <th className="py-2 pr-3">Acción</th>
              <th className="py-2 pr-3">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 && (
              <tr>
                <td className="py-3" colSpan={5}>
                  Sin registros aún.
                </td>
              </tr>
            )}

            {auditLogs.map((log) => (
              <tr key={log.id} className="border-b border-slate-100 align-top dark:border-slate-900">
                <td className="py-3 pr-3">{new Date(log.created_at).toLocaleString('es-CO')}</td>
                <td className="py-3 pr-3">{nameMap.get(log.actor_id) || log.actor_id || 'Sistema'}</td>
                <td className="py-3 pr-3">{nameMap.get(log.target_profile_id) || log.target_profile_id || '-'}</td>
                <td className="py-3 pr-3">{log.action}</td>
                <td className="py-3 pr-3">
                  <pre className="max-w-md overflow-auto whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default SuperAdminPage
