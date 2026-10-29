import { Check, ShoppingBag } from 'lucide-react'
import { useId, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { QuantityStepper } from '../../components/ui/QuantityStepper'
import { formatCOP } from '../../lib/format'
import type { Product } from '../../types/catalog'
import { clampQuantity, estimateUnitPrice, type CartSelection } from '../cart/cart-logic'
import { ProductVisual } from './ProductVisual'

type ProductSheetProps = {
  product: Product | null
  open: boolean
  onClose: () => void
  onSubmit: (product: Product, selection: CartSelection) => void
  // Al editar una línea del carrito se precargan sus opciones.
  initial?: CartSelection
  submitLabel?: string
}

export function ProductSheet({ product, open, onClose, onSubmit, initial, submitLabel = 'Agregar' }: ProductSheetProps) {
  return (
    <Modal open={open && product !== null} onClose={onClose} labelledBy="product-sheet-title">
      {product && (
        // key: al cambiar de producto se reinicia el formulario.
        <ProductForm key={product.id} product={product} initial={initial} onSubmit={onSubmit} submitLabel={submitLabel} />
      )}
    </Modal>
  )
}

function ProductForm({
  product,
  initial,
  onSubmit,
  submitLabel,
}: Pick<ProductSheetProps, 'initial' | 'onSubmit'> & { product: Product; submitLabel: string }) {
  const notesId = useId()
  const [variantId, setVariantId] = useState<string | null>(initial?.variantId ?? product.variants[0]?.id ?? null)
  const [optionIds, setOptionIds] = useState<string[]>(initial?.optionIds ?? [])
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1)
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const unitPrice = estimateUnitPrice(product, { variantId, optionIds })
  const total = Number(unitPrice) * quantity

  const groupCount = (groupId: string) =>
    product.optionGroups.find((g) => g.id === groupId)!.options.filter((o) => optionIds.includes(o.id)).length

  const missingGroup = product.optionGroups.find((g) => groupCount(g.id) < g.minSelect)

  const toggleOption = (groupId: string, optionId: string, maxSelect: number | null) => {
    setOptionIds((prev) => {
      if (prev.includes(optionId)) return prev.filter((id) => id !== optionId)
      if (maxSelect !== null && groupCount(groupId) >= maxSelect) return prev
      return [...prev, optionId]
    })
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        if (!product.available || missingGroup) return
        onSubmit(product, { variantId, optionIds, quantity: clampQuantity(quantity), notes: notes.trim() || null })
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="aspect-[16/9] w-full bg-ink-950">
          <ProductVisual product={product} />
        </div>

        <div className="space-y-6 p-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-brand-500 uppercase">{product.category.name}</p>
            <h2 id="product-sheet-title" className="mt-1 text-2xl font-black text-cream-50 uppercase">
              {product.name}
            </h2>
            {product.description && <p className="mt-2 text-sm leading-relaxed text-cream-300">{product.description}</p>}
            {!product.available && (
              <p className="mt-3 inline-block rounded-full bg-red-500/15 px-3 py-1 text-sm font-semibold text-red-300">
                Agotado por ahora
              </p>
            )}
          </div>

          {product.variants.length > 0 && (
            <fieldset>
              <legend className="flex w-full items-center justify-between text-sm font-bold text-cream-50">
                Elige tu opción
                <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[11px] font-semibold text-cream-300">Obligatorio</span>
              </legend>
              <div className="mt-3 space-y-2">
                {product.variants.map((variant) => (
                  <label
                    key={variant.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 transition has-[:checked]:border-brand-500 has-[:checked]:bg-brand-500/10"
                  >
                    <input
                      type="radio"
                      name="variant"
                      value={variant.id}
                      checked={variantId === variant.id}
                      onChange={() => setVariantId(variant.id)}
                      className="size-4 accent-brand-500"
                    />
                    <span className="flex-1 text-sm font-semibold">{variant.name}</span>
                    <span className="text-sm font-bold text-cream-50">{formatCOP(variant.price)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {product.optionGroups.map((group) => {
            const count = groupCount(group.id)
            const full = group.maxSelect !== null && count >= group.maxSelect
            return (
              <fieldset key={group.id}>
                <legend className="flex w-full items-center justify-between text-sm font-bold text-cream-50">
                  {group.name}
                  <span className="text-[11px] font-semibold text-cream-300">
                    {group.minSelect > 0 ? `Elige al menos ${group.minSelect}` : 'Opcional'}
                    {group.maxSelect !== null && ` · máx. ${group.maxSelect}`}
                  </span>
                </legend>
                <div className="mt-3 divide-y divide-ink-700 rounded-xl border border-ink-600 bg-ink-800">
                  {group.options.map((option) => {
                    const checked = optionIds.includes(option.id)
                    return (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-center gap-3 px-4 py-3 ${!checked && full ? 'cursor-not-allowed opacity-40' : ''}`}
                      >
                        <span
                          className={`grid size-5 shrink-0 place-items-center rounded-md border transition ${
                            checked ? 'border-brand-500 bg-brand-500 text-ink-900' : 'border-ink-400'
                          }`}
                          aria-hidden
                        >
                          {checked && <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          disabled={!checked && full}
                          onChange={() => toggleOption(group.id, option.id, group.maxSelect)}
                        />
                        <span className="flex-1 text-sm">{option.name}</span>
                        <span className="text-sm font-semibold text-cream-300">+{formatCOP(option.price)}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}

          <div>
            <label htmlFor={notesId} className="text-sm font-bold text-cream-50">
              Observaciones <span className="font-normal text-cream-300">(opcional)</span>
            </label>
            <textarea
              id={notesId}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 200))}
              rows={2}
              placeholder="Ej.: sin cebolla, salsas aparte"
              className="mt-2 w-full resize-none rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-sm text-cream-50 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-ink-700 bg-ink-900 p-4">
        <QuantityStepper value={quantity} onChange={(v) => setQuantity(clampQuantity(v))} label="Cantidad" />
        <button
          type="submit"
          disabled={!product.available || Boolean(missingGroup)}
          className="inline-flex flex-1 items-center justify-between gap-2 rounded-full bg-brand-500 px-5 py-3 font-bold text-ink-900 transition hover:bg-brand-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-cream-300"
        >
          <span className="inline-flex items-center gap-2">
            <ShoppingBag className="size-5" aria-hidden />
            {product.available ? submitLabel : 'Agotado'}
          </span>
          {product.available && <span>{formatCOP(total)}</span>}
        </button>
      </div>
    </form>
  )
}
