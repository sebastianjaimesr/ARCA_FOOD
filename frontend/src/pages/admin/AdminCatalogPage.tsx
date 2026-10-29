import { Check, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Alert, Button, Loading, PageHeader, Panel, TextInput } from '../../components/admin/ui'
import { useIsAdmin } from '../../features/auth/useIsAdmin'
import { useAdminData } from '../../hooks/useAdminData'
import { formatCOP } from '../../lib/format'
import { adminApi, errorMessage } from '../../services/admin'
import type { AdminCategory, AdminOptionGroup } from '../../types/admin'

const isMoney = (v: string) => /^\d{1,8}(\.\d{1,2})?$/.test(v.trim())

export function AdminCatalogPage() {
  const isAdmin = useIsAdmin()
  const categories = useAdminData(() => adminApi.categories(), [])
  const groups = useAdminData(() => adminApi.optionGroups(), [])
  const [error, setError] = useState<string | null>(null)

  // Ejecuta un cambio, recarga la lista y muestra el error si falla.
  const run = async (fn: () => Promise<unknown>, reload: () => void) => {
    setError(null)
    try {
      await fn()
      reload()
      return true
    } catch (err) {
      setError(errorMessage(err))
      return false
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Catálogo"
        description={isAdmin ? 'Categorías del menú y adicionales con su precio. Los cambios se ven de inmediato en la tienda.' : 'Solo un administrador puede editar el catálogo.'}
      />
      {error && <Alert tone="error">{error}</Alert>}

      <Panel title="Categorías">
        {!categories.data ? (
          <Loading />
        ) : (
          <CategoriesEditor
            items={categories.data}
            editable={isAdmin}
            onSave={(id, body) => run(() => adminApi.updateCategory(id, body), categories.reload)}
            onCreate={(body) => run(() => adminApi.createCategory(body), categories.reload)}
          />
        )}
      </Panel>

      {!groups.data ? (
        <Loading />
      ) : (
        groups.data.map((group) => (
          <OptionGroupEditor
            key={group.id}
            group={group}
            editable={isAdmin}
            onUpdateGroup={(body) => run(() => adminApi.updateOptionGroup(group.id, body), groups.reload)}
            onUpdateOption={(id, body) => run(() => adminApi.updateOption(id, body), groups.reload)}
            onCreateOption={(body) => run(() => adminApi.createOption(group.id, body), groups.reload)}
          />
        ))
      )}

      {isAdmin && groups.data && <NewGroupForm onCreate={(body) => run(() => adminApi.createOptionGroup(body), groups.reload)} />}
    </div>
  )
}

function CategoriesEditor({
  items,
  editable,
  onSave,
  onCreate,
}: {
  items: AdminCategory[]
  editable: boolean
  onSave: (id: string, body: Partial<AdminCategory>) => Promise<boolean>
  onCreate: (body: { name: string; description: string | null; sortOrder: number }) => Promise<boolean>
}) {
  const [newName, setNewName] = useState('')
  return (
    <div className="space-y-2">
      {items.map((c) => (
        <CategoryRow key={c.id} category={c} editable={editable} onSave={(body) => onSave(c.id, body)} />
      ))}
      {editable && (
        <form
          className="flex gap-2 pt-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (newName.trim().length < 2) return
            if (await onCreate({ name: newName.trim(), description: null, sortOrder: items.length + 1 })) setNewName('')
          }}
        >
          <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nueva categoría" aria-label="Nombre de la nueva categoría" className="mt-0" />
          <Button type="submit" disabled={newName.trim().length < 2}>
            <Plus className="size-4" aria-hidden /> Crear
          </Button>
        </form>
      )}
    </div>
  )
}

function CategoryRow({ category, editable, onSave }: { category: AdminCategory; editable: boolean; onSave: (body: Partial<AdminCategory>) => Promise<boolean> }) {
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description ?? '')
  const [order, setOrder] = useState(String(category.sortOrder))
  const dirty = name !== category.name || description !== (category.description ?? '') || order !== String(category.sortOrder)

  return (
    <div className={`grid items-center gap-2 rounded-xl bg-ink-800 p-2 sm:grid-cols-[64px_1fr_1.4fr_auto_auto] ${category.isActive ? '' : 'opacity-60'}`}>
      <TextInput type="number" value={order} onChange={(e) => setOrder(e.target.value)} disabled={!editable} aria-label="Orden" className="mt-0" />
      <TextInput value={name} onChange={(e) => setName(e.target.value)} disabled={!editable} aria-label="Nombre" className="mt-0" />
      <TextInput value={description} onChange={(e) => setDescription(e.target.value)} disabled={!editable} placeholder="Descripción (opcional)" aria-label="Descripción" className="mt-0" />
      <span className="px-2 text-xs text-cream-300">{category.productsCount} productos</span>
      {editable && (
        <span className="flex gap-1">
          {dirty && (
            <Button
              variant="primary"
              onClick={() => onSave({ name: name.trim(), description: description.trim() || null, sortOrder: Number(order) || 0 })}
              aria-label="Guardar categoría"
            >
              <Check className="size-4" aria-hidden />
            </Button>
          )}
          <Button onClick={() => onSave({ isActive: !category.isActive })}>{category.isActive ? 'Desactivar' : 'Activar'}</Button>
        </span>
      )}
    </div>
  )
}

function OptionGroupEditor({
  group,
  editable,
  onUpdateGroup,
  onUpdateOption,
  onCreateOption,
}: {
  group: AdminOptionGroup
  editable: boolean
  onUpdateGroup: (body: Partial<AdminOptionGroup>) => Promise<boolean>
  onUpdateOption: (id: string, body: { name?: string; price?: string; isActive?: boolean }) => Promise<boolean>
  onCreateOption: (body: { name: string; price: string; sortOrder: number }) => Promise<boolean>
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  return (
    <Panel
      title={`Grupo: ${group.name}`}
      actions={
        editable && (
          <Button variant="ghost" onClick={() => onUpdateGroup({ isActive: !group.isActive })}>
            {group.isActive ? 'Desactivar grupo' : 'Activar grupo'}
          </Button>
        )
      }
    >
      <p className="mb-3 text-xs text-cream-300">
        {group.minSelect > 0 ? `Mínimo ${group.minSelect}` : 'Opcional'} · {group.maxSelect ? `máximo ${group.maxSelect}` : 'sin máximo'} ·{' '}
        {group.isActive ? 'activo' : 'inactivo (no se ofrece en la tienda)'}
      </p>
      <div className="space-y-2">
        {group.options.map((o) => (
          <OptionRow key={o.id} option={o} editable={editable} onSave={(body) => onUpdateOption(o.id, body)} />
        ))}
      </div>
      {editable && (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_auto]"
          onSubmit={async (e) => {
            e.preventDefault()
            if (name.trim().length < 1 || !isMoney(price)) return
            if (await onCreateOption({ name: name.trim(), price: price.trim(), sortOrder: group.options.length + 1 })) {
              setName('')
              setPrice('')
            }
          }}
        >
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuevo adicional (ej. Salsa de ajo)" aria-label="Nombre del adicional" className="mt-0" />
          <TextInput value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="Precio" aria-label="Precio del adicional" className="mt-0" />
          <Button type="submit" disabled={!name.trim() || !isMoney(price)}>
            <Plus className="size-4" aria-hidden /> Agregar
          </Button>
        </form>
      )}
    </Panel>
  )
}

function OptionRow({
  option,
  editable,
  onSave,
}: {
  option: AdminOptionGroup['options'][number]
  editable: boolean
  onSave: (body: { name?: string; price?: string; isActive?: boolean }) => Promise<boolean>
}) {
  const [name, setName] = useState(option.name)
  const [price, setPrice] = useState(String(Number(option.price)))
  const dirty = name !== option.name || price !== String(Number(option.price))
  const valid = name.trim().length > 0 && isMoney(price)

  return (
    <div className={`grid items-center gap-2 rounded-xl bg-ink-800 p-2 sm:grid-cols-[1fr_140px_110px_auto] ${option.isActive ? '' : 'opacity-60'}`}>
      <TextInput value={name} onChange={(e) => setName(e.target.value)} disabled={!editable} aria-label="Nombre del adicional" className="mt-0" />
      <TextInput value={price} onChange={(e) => setPrice(e.target.value)} disabled={!editable} inputMode="numeric" aria-label={`Precio de ${option.name}`} aria-invalid={!isMoney(price)} className="mt-0" />
      <span className="px-2 text-xs text-cream-300">{formatCOP(option.price)}</span>
      {editable && (
        <span className="flex gap-1">
          {dirty && (
            <>
              <Button variant="primary" disabled={!valid} onClick={() => onSave({ name: name.trim(), price: price.trim() })} aria-label={`Guardar ${option.name}`}>
                <Check className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setName(option.name)
                  setPrice(String(Number(option.price)))
                }}
                aria-label="Descartar cambios"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </>
          )}
          <Button onClick={() => onSave({ isActive: !option.isActive })}>{option.isActive ? 'Desactivar' : 'Activar'}</Button>
        </span>
      )}
    </div>
  )
}

function NewGroupForm({ onCreate }: { onCreate: (body: { name: string; minSelect: number; maxSelect: number | null }) => Promise<boolean> }) {
  const [name, setName] = useState('')
  const [max, setMax] = useState('')
  return (
    <Panel title="Nuevo grupo de opciones">
      <p className="mb-3 text-xs text-cream-300">
        Ejemplo: “Salsas” con máximo 3. Después asígnalo a los productos desde su ficha. (La carta todavía no define las salsas disponibles.)
      </p>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_160px_auto]"
        onSubmit={async (e) => {
          e.preventDefault()
          if (name.trim().length < 2) return
          if (await onCreate({ name: name.trim(), minSelect: 0, maxSelect: max ? Number(max) : null })) {
            setName('')
            setMax('')
          }
        }}
      >
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del grupo" aria-label="Nombre del grupo" className="mt-0" />
        <TextInput type="number" min={1} max={20} value={max} onChange={(e) => setMax(e.target.value)} placeholder="Máximo (opcional)" aria-label="Máximo de opciones" className="mt-0" />
        <Button type="submit" disabled={name.trim().length < 2}>
          <Plus className="size-4" aria-hidden /> Crear grupo
        </Button>
      </form>
    </Panel>
  )
}
