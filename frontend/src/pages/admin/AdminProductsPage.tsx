import { Plus, Search, UtensilsCrossed } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CategoryArt } from '../../components/brand/CategoryArt'
import { Alert, Empty, Loading, PageHeader, Select, TextInput } from '../../components/admin/ui'
import { useIsAdmin } from '../../features/auth/useIsAdmin'
import { useAdminData } from '../../hooks/useAdminData'
import { formatCOP } from '../../lib/format'
import { matches } from '../../lib/search'
import { adminApi, errorMessage } from '../../services/admin'
import type { AdminProduct } from '../../types/admin'

export function AdminProductsPage() {
  const isAdmin = useIsAdmin()
  const products = useAdminData(() => adminApi.products({ status: 'all' }), [])
  const categories = useAdminData(() => adminApi.categories(), [])
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive' | 'unavailable'>('all')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      (products.data ?? []).filter(
        (p) =>
          matches(q, p.name, p.categoryName) &&
          (!categoryId || p.categoryId === categoryId) &&
          (status === 'all' ||
            (status === 'active' && p.isActive) ||
            (status === 'inactive' && !p.isActive) ||
            (status === 'unavailable' && p.isActive && !p.isAvailable)),
      ),
    [products.data, q, categoryId, status],
  )

  // Cambio rápido de "activo" / "disponible" desde la lista.
  const quickToggle = async (product: AdminProduct, field: 'isActive' | 'isAvailable') => {
    setSaving(`${product.id}:${field}`)
    setError(null)
    try {
      const updated = await adminApi.updateProduct(product.id, { [field]: !product[field] })
      products.setData((products.data ?? []).map((p) => (p.id === updated.id ? updated : p)))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Productos"
        description={`${products.data?.length ?? '…'} productos. Los desactivados no aparecen en la tienda; los no disponibles se muestran como agotados.`}
        actions={
          isAdmin && (
            <Link
              to="/admin/productos/nuevo"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-ink-900 hover:bg-brand-400"
            >
              <Plus className="size-4" aria-hidden /> Nuevo producto
            </Link>
          )
        }
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4 sm:grid-cols-[1fr_200px_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 mt-0.5 size-4 -translate-y-1/2 text-cream-300" aria-hidden />
          <TextInput type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" aria-label="Buscar producto" className="pl-9" />
        </div>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Estado">
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="unavailable">Agotados</option>
          <option value="inactive">Desactivados</option>
        </Select>
      </div>

      {error && (
        <div className="mb-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {products.status === 'error' && <Alert tone="error">{products.error}</Alert>}
      {!products.data && products.status === 'loading' && <Loading />}
      {products.data && filtered.length === 0 && <Empty icon={UtensilsCrossed} title="Ningún producto coincide con los filtros" />}

      {filtered.length > 0 && (
        <ul className="divide-y divide-ink-700 overflow-hidden rounded-2xl border border-ink-700 bg-ink-950">
          {filtered.map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center gap-4 px-4 py-3 ${p.isActive ? '' : 'opacity-60'}`}>
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink-900">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <CategoryArt slug={categories.data?.find((c) => c.id === p.categoryId)?.slug ?? ''} className="size-8 text-brand-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link to={`/admin/productos/${p.id}`} className="font-bold text-cream-50 hover:text-brand-400">
                  {p.name}
                </Link>
                <p className="text-xs text-cream-300">
                  {p.categoryName} · {p.variants.filter((v) => v.isActive).length > 0 ? `${p.variants.filter((v) => v.isActive).length} variantes · desde ` : ''}
                  {formatCOP(p.price)}
                  {p.trackStock && (
                    <span className={p.stockQuantity <= p.minStock ? 'font-semibold text-amber-300' : ''}> · Stock {p.stockQuantity}</span>
                  )}
                  {p.isFeatured && <span className="text-brand-400"> · Destacado</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <QuickSwitch
                  label="Activo"
                  checked={p.isActive}
                  disabled={!isAdmin || saving !== null}
                  onClick={() => quickToggle(p, 'isActive')}
                />
                <QuickSwitch
                  label="Disponible"
                  checked={p.isAvailable}
                  disabled={!isAdmin || saving !== null || !p.isActive}
                  onClick={() => quickToggle(p, 'isAvailable')}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function QuickSwitch({ label, checked, disabled, onClick }: { label: string; checked: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition disabled:cursor-not-allowed ${
        checked ? 'bg-emerald-400/15 text-emerald-200 ring-emerald-400/30' : 'bg-ink-800 text-cream-300 ring-ink-600'
      } ${disabled ? 'opacity-70' : 'hover:brightness-125'}`}
    >
      {checked ? '✓ ' : ''}
      {label}
    </button>
  )
}
