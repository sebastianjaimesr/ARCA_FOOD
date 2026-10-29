import { Check, Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { Alert, Button, Field, Loading, PageHeader, Panel, TextArea, TextInput, Toggle } from '../../components/admin/ui'
import { useIsAdmin } from '../../features/auth/useIsAdmin'
import { useAdminData } from '../../hooks/useAdminData'
import { formatCOP } from '../../lib/format'
import { adminApi, errorMessage } from '../../services/admin'
import type { AdminSettings, DeliveryZone } from '../../types/admin'
import type { OpeningHours } from '../../types/catalog'

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const isMoney = (v: string) => /^\d{1,8}(\.\d{1,2})?$/.test(v.trim())

export function AdminSettingsPage() {
  const isAdmin = useIsAdmin()
  const settings = useAdminData(() => adminApi.settings(), [])

  if (!isAdmin) return <Alert tone="warning">Solo un administrador puede ver y cambiar la configuración del negocio.</Alert>
  if (settings.status === 'error' && !settings.data) return <Alert tone="error">{settings.error}</Alert>
  if (!settings.data) return <Loading />

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Configuración" description="Datos que ve el cliente en la tienda y reglas para recibir pedidos." />
      <BusinessForm key={settings.data.updatedAt} settings={settings.data} onSaved={settings.setData} />
      <ZonesEditor zones={settings.data.deliveryZones} onChange={settings.reload} />
    </div>
  )
}

type DayRow = { open: boolean; from: string; to: string }

const toRows = (hours: OpeningHours | null): DayRow[] =>
  DAYS.map((_, i) => {
    const slot = hours?.find((h) => h.day === i + 1)
    return slot ? { open: true, from: slot.open, to: slot.close } : { open: false, from: '17:00', to: '23:00' }
  })

function BusinessForm({ settings, onSaved }: { settings: AdminSettings; onSaved: (s: AdminSettings) => void }) {
  const [form, setForm] = useState({
    businessName: settings.businessName,
    tagline: settings.tagline ?? '',
    whatsappPhone: settings.whatsappPhone ?? '',
    address: settings.address ?? '',
    city: settings.city ?? '',
    instagramHandle: settings.instagramHandle ?? '',
    deliveryNotes: settings.deliveryNotes ?? '',
    deliveryEnabled: settings.deliveryEnabled,
    pickupEnabled: settings.pickupEnabled,
    acceptingOrders: settings.acceptingOrders,
  })
  const [hasHours, setHasHours] = useState(settings.openingHours !== null)
  const [rows, setRows] = useState<DayRow[]>(toRows(settings.openingHours))
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setRow = (i: number, patch: Partial<DayRow>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)))

  const save = async () => {
    setSaving(true)
    setNotice(null)
    try {
      const updated = await adminApi.updateSettings({
        businessName: form.businessName,
        tagline: form.tagline || null,
        whatsappPhone: form.whatsappPhone || null,
        address: form.address || null,
        city: form.city || null,
        instagramHandle: form.instagramHandle || null,
        deliveryNotes: form.deliveryNotes || null,
        deliveryEnabled: form.deliveryEnabled,
        pickupEnabled: form.pickupEnabled,
        acceptingOrders: form.acceptingOrders,
        openingHours: hasHours ? rows.flatMap((r, i) => (r.open ? [{ day: i + 1, open: r.from, close: r.to }] : [])) : null,
      })
      onSaved({ ...updated, deliveryZones: settings.deliveryZones })
      setNotice({ tone: 'success', text: 'Configuración guardada.' })
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Panel title="Recepción de pedidos">
        <div className="space-y-4">
          <Toggle
            checked={form.acceptingOrders}
            onChange={(v) => set('acceptingOrders', v)}
            label="Recibiendo pedidos en línea"
            description="Apágalo para pausar la tienda (cierre temporal, cocina saturada). El menú sigue visible."
          />
          <Toggle checked={form.deliveryEnabled} onChange={(v) => set('deliveryEnabled', v)} label="Domicilios" />
          <Toggle checked={form.pickupEnabled} onChange={(v) => set('pickupEnabled', v)} label="Recoger en el local" />
          {!form.deliveryEnabled && !form.pickupEnabled && <Alert tone="warning">Con ambas modalidades apagadas nadie podrá completar un pedido.</Alert>}
        </div>
      </Panel>

      <Panel title="Datos del negocio">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre comercial">
            <TextInput value={form.businessName} onChange={(e) => set('businessName', e.target.value)} />
          </Field>
          <Field label="Eslogan">
            <TextInput value={form.tagline} onChange={(e) => set('tagline', e.target.value)} />
          </Field>
          <Field label="WhatsApp de pedidos" hint="Formato internacional sin +, ej. 573006681727. Aquí llegan los pedidos.">
            <TextInput inputMode="tel" value={form.whatsappPhone} onChange={(e) => set('whatsappPhone', e.target.value)} />
          </Field>
          <Field label="Instagram" hint="Sin @.">
            <TextInput value={form.instagramHandle} onChange={(e) => set('instagramHandle', e.target.value)} />
          </Field>
          <Field label="Dirección">
            <TextInput value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label="Ciudad">
            <TextInput value={form.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="Nota sobre domicilios" hint="Se muestra cuando no hay zonas con tarifa. Ej.: “El valor depende del barrio; te lo confirmamos por WhatsApp”." className="sm:col-span-2">
            <TextArea rows={2} value={form.deliveryNotes} onChange={(e) => set('deliveryNotes', e.target.value)} />
          </Field>
        </div>
      </Panel>

      <Panel title="Horario de atención">
        <div className="space-y-4">
          <Toggle
            checked={hasHours}
            onChange={setHasHours}
            label="Usar horario"
            description={hasHours ? 'Fuera de este horario la tienda no acepta pedidos (hora de Bogotá).' : 'Sin horario configurado: se muestra “Pendiente por confirmar” y no se bloquean pedidos.'}
          />
          {hasHours && (
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={DAYS[i]} className="grid grid-cols-[110px_auto_1fr_1fr] items-center gap-2 text-sm">
                  <span className="font-medium text-cream-100">{DAYS[i]}</span>
                  <label className="flex items-center gap-1.5 text-xs text-cream-300">
                    <input type="checkbox" className="accent-brand-500" checked={row.open} onChange={(e) => setRow(i, { open: e.target.checked })} />
                    Abre
                  </label>
                  <TextInput type="time" value={row.from} disabled={!row.open} onChange={(e) => setRow(i, { from: e.target.value })} aria-label={`${DAYS[i]} abre`} className="mt-0" />
                  <TextInput type="time" value={row.to} disabled={!row.open} onChange={(e) => setRow(i, { to: e.target.value })} aria-label={`${DAYS[i]} cierra`} className="mt-0" />
                </div>
              ))}
              <p className="text-xs text-cream-300">Si cierra después de medianoche, escribe la hora de cierre del día siguiente (ej. 17:00 a 01:00).</p>
            </div>
          )}
        </div>
      </Panel>

      <div className="sticky bottom-4 z-10 flex flex-col gap-2 rounded-2xl border border-ink-700 bg-ink-900/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">{notice && <Alert tone={notice.tone}>{notice.text}</Alert>}</div>
        <Button variant="primary" onClick={save} loading={saving}>
          <Save className="size-4" aria-hidden /> Guardar configuración
        </Button>
      </div>
    </>
  )
}

function ZonesEditor({ zones, onChange }: { zones: DeliveryZone[]; onChange: () => void }) {
  const [name, setName] = useState('')
  const [fee, setFee] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      onChange()
      return true
    } catch (err) {
      setError(errorMessage(err))
      return false
    }
  }

  const active = zones.filter((z) => z.isActive).length

  return (
    <Panel title="Zonas y tarifas de domicilio">
      <p className="mb-3 text-sm text-cream-300">
        {active === 0
          ? 'Sin zonas activas: el cliente no elige zona y el domicilio queda “por confirmar” por WhatsApp.'
          : `Con ${active} zona(s) activa(s), el cliente debe elegir su zona y se cobra su tarifa. Si su zona no está, no puede pedir domicilio.`}
      </p>
      {error && (
        <div className="mb-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <div className="space-y-2">
        {zones.map((z) => (
          <ZoneRow key={`${z.id}:${z.fee}:${z.name}`} zone={z} onSave={(body) => run(() => adminApi.updateZone(z.id, body))} />
        ))}
      </div>
      <form
        className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_auto]"
        onSubmit={async (e) => {
          e.preventDefault()
          if (name.trim().length < 2 || !isMoney(fee)) return
          if (await run(() => adminApi.createZone({ name: name.trim(), fee: fee.trim(), sortOrder: zones.length + 1 }))) {
            setName('')
            setFee('')
          }
        }}
      >
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Barrio o zona (ej. Cabecera)" aria-label="Nombre de la zona" className="mt-0" />
        <TextInput value={fee} onChange={(e) => setFee(e.target.value)} inputMode="numeric" placeholder="Tarifa (ej. 4000)" aria-label="Tarifa" className="mt-0" />
        <Button type="submit" disabled={name.trim().length < 2 || !isMoney(fee)}>
          <Plus className="size-4" aria-hidden /> Agregar zona
        </Button>
      </form>
    </Panel>
  )
}

function ZoneRow({ zone, onSave }: { zone: DeliveryZone; onSave: (body: Partial<DeliveryZone>) => Promise<boolean> }) {
  const [name, setName] = useState(zone.name)
  const [fee, setFee] = useState(String(Number(zone.fee)))
  const dirty = name !== zone.name || fee !== String(Number(zone.fee))
  return (
    <div className={`grid items-center gap-2 rounded-xl bg-ink-800 p-2 sm:grid-cols-[1fr_140px_100px_auto] ${zone.isActive ? '' : 'opacity-60'}`}>
      <TextInput value={name} onChange={(e) => setName(e.target.value)} aria-label="Zona" className="mt-0" />
      <TextInput value={fee} onChange={(e) => setFee(e.target.value)} inputMode="numeric" aria-label={`Tarifa de ${zone.name}`} className="mt-0" />
      <span className="px-2 text-xs text-cream-300">{formatCOP(zone.fee)}</span>
      <span className="flex gap-1">
        {dirty && (
          <Button variant="primary" disabled={name.trim().length < 2 || !isMoney(fee)} onClick={() => onSave({ name: name.trim(), fee: fee.trim() })} aria-label="Guardar zona">
            <Check className="size-4" aria-hidden />
          </Button>
        )}
        <Button onClick={() => onSave({ isActive: !zone.isActive })}>{zone.isActive ? 'Desactivar' : 'Activar'}</Button>
      </span>
    </div>
  )
}
